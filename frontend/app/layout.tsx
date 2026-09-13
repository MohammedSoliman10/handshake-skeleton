import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { NavBar } from "@/components/NavBar";

// Every page reads live wallet/contract state via Privy + wagmi, so there
// is no meaningful static version of any route to prerender — force
// dynamic rendering instead of letting Next.js attempt (and fail) to
// build static HTML for pages that only make sense client-side.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Handshake — deals with an identity",
  description: "Two people make a deal. Both stake collateral. The agreement becomes a verifiable on-chain object with its own ENS identity and history.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <NavBar />
          <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
