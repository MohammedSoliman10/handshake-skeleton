"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useHandshake, parseDeal, fromUsdcUnits, type Deal } from "@/lib/contract";
import { ENSName } from "./ENSName";

const STATE_STYLES: Record<Deal["state"], string> = {
  CREATED: "bg-ink/10 text-ink/70",
  FUNDED: "bg-accent/10 text-accent",
  ACTIVE: "bg-accent/20 text-accent",
  DISPUTED: "bg-red-100 text-red-700",
  COMPLETED: "bg-green-100 text-green-700",
  EXPIRED: "bg-ink/10 text-ink/40",
};

export function DealCard({ dealId }: { dealId: bigint }) {
  const handshake = useHandshake();
  const [deal, setDeal] = useState<Deal | null>(null);

  useEffect(() => {
    if (!handshake) return;
    let cancelled = false;
    handshake.read.getDeal([dealId]).then((raw) => {
      if (!cancelled) setDeal(parseDeal(raw as never));
    });
    return () => {
      cancelled = true;
    };
  }, [handshake, dealId]);

  if (!deal) {
    return <div className="h-20 animate-pulse rounded-2xl bg-ink/5" />;
  }

  return (
    <Link
      href={`/deal/${dealId}`}
      className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink/5 transition hover:ring-ink/15"
    >
      <div>
        <div className="flex items-center gap-2 text-sm text-ink/60">
          <span>Deal #{dealId.toString()}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATE_STYLES[deal.state]}`}>
            {deal.state}
          </span>
        </div>
        <div className="mt-1 text-sm text-ink">
          <ENSName address={deal.creator} /> <span className="text-ink/40">→</span>{" "}
          <ENSName address={deal.counterparty} />
        </div>
      </div>
      <div className="text-right">
        <div className="font-medium text-ink">${fromUsdcUnits(deal.amount)} USDC</div>
        <div className="text-xs text-ink/50">
          due {new Date(Number(deal.deadline) * 1000).toLocaleDateString()}
        </div>
      </div>
    </Link>
  );
}
