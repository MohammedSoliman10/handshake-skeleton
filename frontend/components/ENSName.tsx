"use client";

import { useEnsName, truncateAddress } from "@/lib/ens";
import type { Address } from "viem";

/// @notice Shows an address's ENS name when it has one, otherwise a
///         truncated address. This is the "no raw 0x addresses in the UI"
///         piece the ENS bounty writeup calls for.
export function ENSName({ address, className }: { address?: Address | string; className?: string }) {
  const { name } = useEnsName(address);

  if (!address) return <span className={className}>—</span>;

  return <span className={className}>{name ?? truncateAddress(address)}</span>;
}
