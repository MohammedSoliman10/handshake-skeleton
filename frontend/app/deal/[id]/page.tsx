"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useWallets } from "@privy-io/react-auth";
import { useHandshake, useUsdc, parseDeal, fromUsdcUnits, HANDSHAKE_ADDRESS, type Deal } from "@/lib/contract";
import { ENSName } from "@/components/ENSName";
import { DisputeModal } from "@/components/DisputeModal";

export default function DealPage({ params }: { params: { id: string } }) {
  const dealId = BigInt(params.id);
  const handshake = useHandshake();
  const usdc = useUsdc();
  const { wallets } = useWallets();
  const myAddress = wallets[0]?.address?.toLowerCase();

  const [deal, setDeal] = useState<Deal | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDispute, setShowDispute] = useState(false);

  const refresh = useCallback(async () => {
    if (!handshake) return;
    const raw = await handshake.read.getDeal([dealId]);
    setDeal(parseDeal(raw as never));
  }, [handshake, dealId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function ensureAllowance(amountNeeded: bigint) {
    if (!usdc || !wallets[0]) return;
    const allowance = (await usdc.read.allowance([wallets[0].address as `0x${string}`, HANDSHAKE_ADDRESS])) as bigint;
    if (allowance < amountNeeded) {
      const hash = await usdc.write.approve([HANDSHAKE_ADDRESS, amountNeeded]);
      await usdc.publicClient!.waitForTransactionReceipt({ hash });
    }
  }

  async function runAction(name: string, action: () => Promise<`0x${string}`>) {
    if (!handshake) return;
    setBusy(name);
    setError(null);
    try {
      const hash = await action();
      await handshake.publicClient!.waitForTransactionReceipt({ hash });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transaction failed");
    } finally {
      setBusy(null);
    }
  }

  if (!deal) return <div className="h-48 animate-pulse rounded-3xl bg-ink/5" />;

  const isCreator = myAddress === deal.creator.toLowerCase();
  const isCounterparty = myAddress === deal.counterparty.toLowerCase();
  const isReviewer = myAddress === deal.reviewer.toLowerCase() && deal.reviewer !== "0x0000000000000000000000000000000000000000";
  const isPastDeadline = BigInt(Math.floor(Date.now() / 1000)) > deal.deadline;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-ink">Deal #{dealId.toString()}</h1>
        <Link href={`/passport/${dealId}`} className="text-sm text-accent hover:underline">
          View Deal Passport →
        </Link>
      </div>

      <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink/5">
        <div className="flex justify-between text-sm">
          <span className="text-ink/60">Creator</span>
          <ENSName address={deal.creator} />
        </div>
        <div className="mt-2 flex justify-between text-sm">
          <span className="text-ink/60">Counterparty</span>
          <ENSName address={deal.counterparty} />
        </div>
        <div className="mt-2 flex justify-between text-sm">
          <span className="text-ink/60">Amount</span>
          <span>${fromUsdcUnits(deal.amount)} USDC</span>
        </div>
        <div className="mt-2 flex justify-between text-sm">
          <span className="text-ink/60">Collateral (each)</span>
          <span>${fromUsdcUnits(deal.collateral)} USDC</span>
        </div>
        <div className="mt-2 flex justify-between text-sm">
          <span className="text-ink/60">Deadline</span>
          <span>{new Date(Number(deal.deadline) * 1000).toLocaleString()}</span>
        </div>
        <div className="mt-2 flex justify-between text-sm">
          <span className="text-ink/60">Status</span>
          <span className="font-medium">{deal.state}</span>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-6 space-y-3">
        {deal.state === "CREATED" && isCreator && (
          <ActionButton
            busy={busy === "fund"}
            onClick={() =>
              runAction("fund", async () => {
                await ensureAllowance(deal.amount + deal.collateral);
                return handshake!.write.fundDeal([dealId]);
              })
            }
          >
            Fund deal (${fromUsdcUnits(deal.amount + deal.collateral)} USDC)
          </ActionButton>
        )}

        {deal.state === "FUNDED" && isCounterparty && (
          <ActionButton
            busy={busy === "accept"}
            onClick={() =>
              runAction("accept", async () => {
                await ensureAllowance(deal.collateral);
                return handshake!.write.acceptDeal([dealId]);
              })
            }
          >
            Accept deal (stake ${fromUsdcUnits(deal.collateral)} USDC)
          </ActionButton>
        )}

        {deal.state === "ACTIVE" && isCounterparty && !deal.completionRequested && (
          <ActionButton busy={busy === "requestCompletion"} onClick={() => runAction("requestCompletion", () => handshake!.write.requestCompletion([dealId]))}>
            Mark as complete
          </ActionButton>
        )}

        {deal.state === "ACTIVE" && isCreator && deal.completionRequested && (
          <ActionButton busy={busy === "confirm"} onClick={() => runAction("confirm", () => handshake!.write.confirmCompletion([dealId]))}>
            Confirm completion — release funds
          </ActionButton>
        )}

        {deal.state === "ACTIVE" && (isCreator || isCounterparty) && (
          <button
            onClick={() => runAction("dispute", () => handshake!.write.openDispute([dealId]))}
            disabled={busy !== null}
            className="w-full rounded-full border border-red-200 py-3 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Open dispute
          </button>
        )}

        {deal.state === "DISPUTED" && isReviewer && (
          <button
            onClick={() => setShowDispute(true)}
            className="w-full rounded-full bg-ink py-3 text-sm font-medium text-paper hover:bg-ink/80"
          >
            Resolve dispute
          </button>
        )}

        {isPastDeadline && (deal.state === "CREATED" || deal.state === "FUNDED" || deal.state === "ACTIVE") && (
          <ActionButton busy={busy === "expire"} onClick={() => runAction("expire", () => handshake!.write.claimExpired([dealId]))}>
            Claim expired — refund
          </ActionButton>
        )}
      </div>

      {showDispute && (
        <DisputeModal
          dealId={dealId}
          creator={deal.creator}
          counterparty={deal.counterparty}
          onClose={() => setShowDispute(false)}
          onResolved={() => {
            setShowDispute(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function ActionButton({ children, onClick, busy }: { children: React.ReactNode; onClick: () => void; busy: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="w-full rounded-full bg-ink py-3 text-sm font-medium text-paper hover:bg-ink/80 disabled:opacity-50"
    >
      {busy ? "Confirming…" : children}
    </button>
  );
}
