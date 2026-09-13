"use client";

import { useState } from "react";
import type { Address } from "viem";
import { useHandshake } from "@/lib/contract";
import { ENSName } from "./ENSName";

/// @notice Shown only to a deal's `reviewer` once it's DISPUTED. The
///         reviewer answers exactly one question — who gets the pot — the
///         same restraint the project brief calls out: no scoring, no
///         partial refunds, no AI judge.
export function DisputeModal({
  dealId,
  creator,
  counterparty,
  onClose,
  onResolved,
}: {
  dealId: bigint;
  creator: Address;
  counterparty: Address;
  onClose: () => void;
  onResolved: () => void;
}) {
  const handshake = useHandshake();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resolve(winner: Address) {
    if (!handshake) return;
    setSubmitting(true);
    setError(null);
    try {
      const hash = await handshake.write.resolveDispute([dealId, winner]);
      await handshake.publicClient?.waitForTransactionReceipt({ hash });
      onResolved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transaction failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-paper p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-ink">Resolve dispute</h2>
        <p className="mt-1 text-sm text-ink/60">
          Deal #{dealId.toString()} — pick who receives the full pot (payment + both collaterals). This is final.
        </p>

        <div className="mt-4 space-y-2">
          <button
            disabled={submitting}
            onClick={() => resolve(creator)}
            className="w-full rounded-xl border border-ink/10 bg-white p-3 text-left text-sm hover:border-accent disabled:opacity-50"
          >
            Creator wins — <ENSName address={creator} />
          </button>
          <button
            disabled={submitting}
            onClick={() => resolve(counterparty)}
            className="w-full rounded-xl border border-ink/10 bg-white p-3 text-left text-sm hover:border-accent disabled:opacity-50"
          >
            Counterparty wins — <ENSName address={counterparty} />
          </button>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <button onClick={onClose} disabled={submitting} className="mt-4 text-sm text-ink/50 hover:text-ink">
          Cancel
        </button>
      </div>
    </div>
  );
}
