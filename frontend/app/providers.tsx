"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { privyAppId, privyConfig, wagmiConfig } from "@/lib/privy";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  if (!privyAppId) {
    // Fails loudly and early instead of a cryptic downstream error — the
    // single most common setup mistake is forgetting .env.local.
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper p-8 text-center">
        <div className="max-w-md">
          <h1 className="text-xl font-semibold text-ink">Missing NEXT_PUBLIC_PRIVY_APP_ID</h1>
          <p className="mt-2 text-sm text-ink/70">
            Copy <code>.env.local.example</code> to <code>.env.local</code>, add your Privy App ID from{" "}
            <a className="underline" href="https://dashboard.privy.io" target="_blank" rel="noreferrer">
              dashboard.privy.io
            </a>
            , and restart the dev server.
          </p>
        </div>
      </div>
    );
  }

  return (
    <PrivyProvider appId={privyAppId} config={privyConfig}>
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
