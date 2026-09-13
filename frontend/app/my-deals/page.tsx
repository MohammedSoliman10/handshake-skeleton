"use client";

import { useEffect, useState } from "react";
import { useWallets, usePrivy } from "@privy-io/react-auth";
import { useHandshake, parseDeal } from "@/lib/contract";
import { DealCard } from "@/components/DealCard";

/// @dev Scans every deal and filters client-side. Fine at hackathon scale
///      (dozens of deals); a real deployment would index DealCreated events
///      by participant instead of iterating nextDealId sequentially.
export default function MyDealsPage() {
  const handshake = useHandshake();
  const { authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const myAddress = wallets[0]?.address?.toLowerCase();

  const [myDealIds, setMyDealIds] = useState<bigint[] | null>(null);

  useEffect(() => {
    if (!handshake || !myAddress) return;
    let cancelled = false;

    async function load() {
      const total = (await handshake!.read.nextDealId([])) as bigint;
      const ids: bigint[] = [];
      for (let i = 0n; i < total; i++) {
        const raw = await handshake!.read.getDeal([i]);
        const deal = parseDeal(raw as never);
        if (deal.creator.toLowerCase() === myAddress || deal.counterparty.toLowerCase() === myAddress) {
          ids.push(i);
        }
      }
      if (!cancelled) setMyDealIds(ids.reverse());
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [handshake, myAddress]);

  if (!authenticated) {
    return (
      <div className="text-center">
        <p className="text-ink/60">Sign in to see your deals.</p>
        <button onClick={login} className="mt-4 rounded-full bg-ink px-5 py-2.5 text-sm text-paper">
          Continue with Google
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink">My Deals</h1>

      {myDealIds === null && (
        <div className="mt-4 space-y-3">
          <div className="h-20 animate-pulse rounded-2xl bg-ink/5" />
          <div className="h-20 animate-pulse rounded-2xl bg-ink/5" />
        </div>
      )}

      {myDealIds?.length === 0 && <p className="mt-4 text-sm text-ink/60">No deals yet.</p>}

      <div className="mt-4 space-y-3">
        {myDealIds?.map((id) => (
          <DealCard key={id.toString()} dealId={id} />
        ))}
      </div>
    </div>
  );
}
