import Link from "next/link";

export default function HomePage() {
  return (
    <div className="text-center">
      <h1 className="text-4xl font-semibold tracking-tight text-ink">
        A deal that becomes<br />an onchain object.
      </h1>
      <p className="mx-auto mt-4 max-w-md text-ink/60">
        Two people stake collateral. The agreement locks. Its full history —
        created, funded, active, settled — is permanent and verifiable, with
        its own ENS identity.
      </p>
      <Link
        href="/create"
        className="mt-8 inline-block rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper hover:bg-ink/80"
      >
        Create a deal in under 60 seconds
      </Link>

      <div className="mx-auto mt-16 grid max-w-lg grid-cols-3 gap-4 text-left text-sm text-ink/60">
        <div>
          <div className="font-medium text-ink">1. Create</div>
          Set the deal, amount, and collateral.
        </div>
        <div>
          <div className="font-medium text-ink">2. Fund & accept</div>
          Both sides stake. Terms lock.
        </div>
        <div>
          <div className="font-medium text-ink">3. Settle</div>
          Complete or dispute. History is permanent.
        </div>
      </div>
    </div>
  );
}
