"use client";

import { useEffect, useState } from "react";
import { useHandshake, parseDeal, fromUsdcUnits, HANDSHAKE_ABI, type Deal } from "@/lib/contract";
import { ENSName } from "./ENSName";
import { decodeEventLog, pad, toHex, type PublicClient } from "viem";

interface TimelineEntry {
  label: string;
  timestamp: bigint;
}

const EVENT_LABELS: Record<string, string> = {
  DealFunded: "Creator funded escrow",
  DealAccepted: "Counterparty accepted + staked collateral",
  CompletionRequested: "Counterparty marked complete",
  DealCompleted: "Settled — funds released",
  DisputeOpened: "Dispute opened",
  DisputeResolved: "Dispute resolved",
  DealExpired: "Deadline passed — refunded",
};

// Set this to the block Handshake.sol was deployed at (printed by
// DeployHandshake.s.sol) — required for this to be usable. Without it,
// falling back to block 0 would mean chunking Sepolia's multi-million-block
// history into 10-block windows, which never finishes; the fallback below
// instead scans only the last ~5000 blocks (~a day) and warns loudly, since
// that's a bug to notice and fix, not a silent slow path.
const DEPLOY_BLOCK_ENV = process.env.NEXT_PUBLIC_HANDSHAKE_DEPLOY_BLOCK;
if (!DEPLOY_BLOCK_ENV && typeof window !== "undefined") {
  console.error(
    "NEXT_PUBLIC_HANDSHAKE_DEPLOY_BLOCK is not set — Deal Passport will only scan the last ~5000 blocks, which may miss older deals. Set it to the block number DeployHandshake.s.sol printed."
  );
}

// Free-tier RPC providers (Alchemy included) cap eth_getLogs at a small
// block range per call (10 blocks on Alchemy's free tier) AND rate-limit
// rapid successive calls. Querying each of the 7 event types separately
// per chunk multiplied the request count 7x and tripped that limit,
// surfacing as a generic "Failed to fetch". Fix: every event this page
// cares about has `dealId` as its first (and only) indexed parameter, so
// topics[1] — the dealId's padded hex — is identical across all of them.
// One getLogs call per chunk, filtered on just that topic, retrieves every
// relevant event regardless of type; decodeEventLog then figures out which
// event each log actually is from its topic0, since it accepts an array of
// event ABIs and matches automatically.
const CHUNK_SIZE = 9n;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getLogsWithRetry(
  publicClient: PublicClient,
  params: { address: `0x${string}`; topics: (`0x${string}` | null)[]; fromBlock: bigint; toBlock: bigint }
) {
  const MAX_ATTEMPTS = 4;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      // Cast needed: viem's overload resolution here doesn't surface
      // `topics` as valid alongside fromBlock/toBlock in this version's
      // types, even though raw topic filtering is a real, documented
      // getLogs parameter that maps directly to the eth_getLogs JSON-RPC
      // call.
      return await (
        publicClient.getLogs as (p: typeof params) => ReturnType<PublicClient["getLogs"]>
      )(params);
    } catch (err) {
      if (attempt === MAX_ATTEMPTS) throw err;
      // Free-tier rate limits are usually per-second — a short exponential
      // backoff (300ms, 600ms, 1200ms) clears them without the user
      // needing to know this happened.
      await sleep(300 * 2 ** (attempt - 1));
    }
  }
  throw new Error("unreachable");
}

async function getDealEventsChunked(publicClient: PublicClient, address: `0x${string}`, dealId: bigint) {
  const latest = await publicClient.getBlockNumber();
  const deployBlock = DEPLOY_BLOCK_ENV ? BigInt(DEPLOY_BLOCK_ENV) : latest > 5000n ? latest - 5000n : 0n;
  const dealIdTopic = pad(toHex(dealId), { size: 32 });

  const entries: TimelineEntry[] = [];

  for (let start = deployBlock; start <= latest; start += CHUNK_SIZE + 1n) {
    const end = start + CHUNK_SIZE > latest ? latest : start + CHUNK_SIZE;
    const logs = await getLogsWithRetry(publicClient, {
      address,
      topics: [null, dealIdTopic],
      fromBlock: start,
      toBlock: end,
    });

    for (const log of logs) {
      try {
        const decoded = decodeEventLog({ abi: HANDSHAKE_ABI, data: log.data, topics: log.topics });
        const label = EVENT_LABELS[decoded.eventName];
        if (!label) continue; // DealCreated matches too (shares the dealId topic) — handled separately via d.createdAt
        const ts = (decoded.args as { timestamp?: bigint }).timestamp;
        if (ts !== undefined) entries.push({ label, timestamp: ts });
      } catch {
        // Doesn't match any event in our ABI (shouldn't happen given the
        // topic filter) — skip rather than crash the whole page over it.
      }
    }

    // Small pacing gap between chunk requests — smooths out bursts that
    // can trip a per-second rate limit even when the total request count
    // over the whole load is modest.
    if (start + CHUNK_SIZE + 1n <= latest) await sleep(150);
  }

  return entries;
}

/// @notice The "factual history, not a reputation score" view from the
///         project brief. Every row here is read from an on-chain event —
///         nothing is stored or computed off-chain, so this is exactly
///         what `<dealId>.handshake.eth`'s text records describe, just
///         rendered as a timeline instead of a single status string.
export function DealPassport({ dealId }: { dealId: bigint }) {
  const handshake = useHandshake();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!handshake) return;
    let cancelled = false;

    async function load() {
      try {
        const raw = await handshake!.read.getDeal([dealId]);
        const d = parseDeal(raw as never);
        if (cancelled) return;
        setDeal(d);

        const entries = await getDealEventsChunked(handshake!.publicClient, handshake!.address, dealId);
        entries.push({ label: "Deal created", timestamp: d.createdAt });
        entries.sort((a, b) => Number(a.timestamp - b.timestamp));

        if (!cancelled) {
          setTimeline(entries);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load deal history");
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [handshake, dealId]);

  if (error) {
    return (
      <div className="rounded-3xl bg-white p-6 text-sm text-red-600 ring-1 ring-ink/5">
        Couldn't load this deal's history: {error}
      </div>
    );
  }

  if (loading || !deal) {
    return <div className="h-64 animate-pulse rounded-3xl bg-ink/5" />;
  }

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-ink/5">
      <div className="text-xs uppercase tracking-wide text-gold">Deal Passport</div>
      <div className="mt-1 font-mono text-sm text-ink/50">{dealId.toString()}.handshake.eth</div>

      <div className="mt-4 flex items-center gap-2 text-lg font-medium text-ink">
        <ENSName address={deal.creator} />
        <span className="text-ink/30">🤝</span>
        <ENSName address={deal.counterparty} />
      </div>

      <div className="mt-2 text-sm text-ink/60">
        ${fromUsdcUnits(deal.amount)} USDC · ${fromUsdcUnits(deal.collateral)} collateral each
      </div>

      <div className="mt-6 space-y-4 border-l border-ink/10 pl-4">
        {timeline.map((entry, i) => (
          <div key={i} className="relative">
            <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-accent" />
            <div className="text-sm text-ink">{entry.label}</div>
            <div className="text-xs text-ink/40">
              {new Date(Number(entry.timestamp) * 1000).toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl bg-ink/5 px-3 py-2 text-center text-sm font-medium text-ink">
        {deal.state === "COMPLETED" ? "✅ COMPLETED" : deal.state === "DISPUTED" ? "⚠️ DISPUTED" : deal.state}
      </div>
    </div>
  );
}