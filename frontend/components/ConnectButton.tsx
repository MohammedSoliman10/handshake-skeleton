"use client";

import { useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { ENSName } from "./ENSName";

export function ConnectButton() {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const activeWallet = wallets[0];
  const [copied, setCopied] = useState(false);

  if (!ready) {
    return <div className="h-9 w-28 animate-pulse rounded-full bg-ink/10" />;
  }

  if (!authenticated) {
    return (
      <button
        onClick={login}
        className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:bg-ink/80"
      >
        Continue with Google
      </button>
    );
  }

  async function copyAddress() {
    if (!activeWallet?.address) return;
    await navigator.clipboard.writeText(activeWallet.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={copyAddress}
        title={activeWallet?.address ?? ""}
        className="rounded-full bg-white px-3 py-1.5 text-sm shadow-sm ring-1 ring-ink/10 hover:ring-ink/30"
      >
        {copied ? "Copied!" : <ENSName address={activeWallet?.address} />}
      </button>
      <button onClick={logout} className="text-sm text-ink/50 hover:text-ink">
        Sign out
      </button>
    </div>
  );
}