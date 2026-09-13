"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useHandshake, toUsdcUnits } from "@/lib/contract";
import { resolveEnsOrAddress } from "@/lib/ens";
import { decodeEventLog } from "viem";
import { HANDSHAKE_ABI } from "@/lib/contract";

export default function CreateDealPage() {
  const router = useRouter();
  const { authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const handshake = useHandshake();

  const [counterparty, setCounterparty] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("100");
  const [collateral, setCollateral] = useState("20");
  const [deadline, setDeadline] = useState("");
  const [reviewer, setReviewer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!authenticated) return login();
    if (!handshake || !wallets[0]) return;

    setSubmitting(true);
    setError(null);
    try {
      const counterpartyAddress = await resolveEnsOrAddress(counterparty);
      if (!counterpartyAddress) throw new Error("Couldn't resolve counterparty — enter a valid address or .eth name");

      const reviewerAddress = reviewer.trim()
        ? await resolveEnsOrAddress(reviewer)
        : ("0x0000000000000000000000000000000000000000" as const);
      if (reviewer.trim() && !reviewerAddress) throw new Error("Couldn't resolve reviewer — enter a valid address or .eth name");

      const deadlineTimestamp = BigInt(Math.floor(new Date(deadline).getTime() / 1000));

      const hash = await handshake.write.createDeal([
        counterpartyAddress,
        toUsdcUnits(amount),
        toUsdcUnits(collateral),
        deadlineTimestamp,
        reviewerAddress!,
      ]);

      const receipt = await handshake.publicClient!.waitForTransactionReceipt({ hash });

      // Pull the dealId straight out of the DealCreated event rather than
      // assuming it's nextDealId-1 (safe even if txs race).
      let dealId: bigint | null = null;
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({ abi: HANDSHAKE_ABI, data: log.data, topics: log.topics });
          if (decoded.eventName === "DealCreated") {
            dealId = (decoded.args as { dealId: bigint }).dealId;
            break;
          }
        } catch {
          // not a Handshake log, ignore
        }
      }

      router.push(dealId !== null ? `/deal/${dealId}` : "/my-deals");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink">Create a Handshake</h1>
      <p className="mt-1 text-sm text-ink/60">
        This creates the deal object only — no funds move until you call "Fund" on the deal page.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <Field label="Counterparty" hint="address or name.eth">
          <input
            required
            value={counterparty}
            onChange={(e) => setCounterparty(e.target.value)}
            placeholder="alex.eth"
            className="input"
          />
        </Field>

        <Field label="What's the deal?" hint="for your own reference — not stored on-chain in the MVP">
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Build landing page" className="input" />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Amount (USDC)">
            <input required type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="input" />
          </Field>
          <Field label="Collateral each (USDC)">
            <input required type="number" min="0" step="0.01" value={collateral} onChange={(e) => setCollateral(e.target.value)} className="input" />
          </Field>
        </div>

        <Field label="Deadline">
          <input required type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="input" />
        </Field>

        <Field label="Trusted reviewer" hint="optional — required only if you want dispute resolution enabled">
          <input value={reviewer} onChange={(e) => setReviewer(e.target.value)} placeholder="reviewer.eth (optional)" className="input" />
        </Field>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-ink py-3 text-sm font-medium text-paper hover:bg-ink/80 disabled:opacity-50"
        >
          {submitting ? "Creating…" : authenticated ? "Create Handshake" : "Sign in to create"}
        </button>
      </form>

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid rgba(11, 14, 20, 0.1);
          background: white;
          padding: 0.625rem 0.875rem;
          font-size: 0.875rem;
        }
        .input:focus {
          outline: 2px solid #3d5a80;
          outline-offset: 1px;
        }
      `}</style>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-sm font-medium text-ink">{label}</div>
      {children}
      {hint && <div className="mt-1 text-xs text-ink/40">{hint}</div>}
    </label>
  );
}
