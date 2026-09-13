"use client";

import { useEffect, useState } from "react";
import { createPublicClient, http, type Address, isAddress } from "viem";
import { mainnet } from "viem/chains";

/// @dev ENS names (mohammed.eth) resolve against L1 mainnet regardless of
///      which chain the app itself runs on — that's a deliberate ENS
///      design property, not a bug, so this client is intentionally
///      separate from the Sepolia client the rest of the app uses for
///      Handshake/USDC calls. Deal-identity subnames (42.handshake.eth)
///      are a different thing entirely: those resolve on Sepolia through
///      HandshakeResolver, see the ENS bounty writeup in docs/ARCHITECTURE.md.
const ensClient = createPublicClient({
  chain: mainnet,
  transport: http(),
});

const cache = new Map<string, string | null>();

/// @notice Resolves an address to its primary ENS name, falling back to a
///         truncated address if none is set (or lookup fails/is offline —
///         mainnet ENS lookups from a hackathon demo environment shouldn't
///         ever be a hard requirement for the UI to render).
export function useEnsName(address?: Address | string) {
  const [name, setName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address || !isAddress(address)) {
      setName(null);
      return;
    }
    const cached = cache.get(address.toLowerCase());
    if (cached !== undefined) {
      setName(cached);
      return;
    }

    let cancelled = false;
    setLoading(true);
    ensClient
      .getEnsName({ address: address as Address })
      .then((result) => {
        if (cancelled) return;
        cache.set(address.toLowerCase(), result);
        setName(result);
      })
      .catch(() => {
        if (!cancelled) setName(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [address]);

  return { name, loading };
}

export function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/// @notice Accepts either a raw address or an ENS name (mohammed.eth) from
///         a form field and resolves it to an address. This is what lets
///         "create deal with alex.eth" work directly in the create-deal
///         form instead of forcing the user to paste a 0x address.
export async function resolveEnsOrAddress(input: string): Promise<Address | null> {
  const trimmed = input.trim();
  if (isAddress(trimmed)) return trimmed as Address;
  if (trimmed.endsWith(".eth")) {
    try {
      const resolved = await ensClient.getEnsAddress({ name: trimmed });
      return resolved;
    } catch {
      return null;
    }
  }
  return null;
}
