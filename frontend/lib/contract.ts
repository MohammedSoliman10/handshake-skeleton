import { getContract, type Address, type Hex, type PublicClient } from "viem";
import { usePublicClient, useWalletClient } from "wagmi";
import { useMemo } from "react";

/// @dev viem's getContract() infers away the `write` namespace when the
///      `wallet` client passed in has a type that includes `undefined`
///      (exactly the case here, since useWalletClient() returns undefined
///      before a wallet connects) — so we give the hooks an explicit,
///      hand-written shape instead of relying on that inference. `write.*`
///      is only ever called from components gated on `authenticated`, at
///      which point a wallet client always exists.
interface HandshakeContract {
  address: Address;
  publicClient: PublicClient;
  read: {
    getDeal(args: readonly [bigint]): Promise<RawDeal>;
    nextDealId(args?: readonly []): Promise<bigint>;
  };
  write: {
    createDeal(args: readonly [Address, bigint, bigint, bigint, Address]): Promise<Hex>;
    fundDeal(args: readonly [bigint]): Promise<Hex>;
    acceptDeal(args: readonly [bigint]): Promise<Hex>;
    requestCompletion(args: readonly [bigint]): Promise<Hex>;
    confirmCompletion(args: readonly [bigint]): Promise<Hex>;
    openDispute(args: readonly [bigint]): Promise<Hex>;
    resolveDispute(args: readonly [bigint, Address]): Promise<Hex>;
    claimExpired(args: readonly [bigint]): Promise<Hex>;
  };
}

interface UsdcContract {
  address: Address;
  publicClient: PublicClient;
  read: {
    allowance(args: readonly [Address, Address]): Promise<bigint>;
    balanceOf(args: readonly [Address]): Promise<bigint>;
  };
  write: {
    approve(args: readonly [Address, bigint]): Promise<Hex>;
  };
}

// ABI trimmed to what the frontend actually calls — generated from a real
// solc compile of contracts/src/Handshake.sol (see contracts/out-abi/ if
// you want the full auto-generated version after `forge build`).
export const HANDSHAKE_ABI = [
  {
    type: "function",
    name: "createDeal",
    stateMutability: "nonpayable",
    inputs: [
      { name: "counterparty", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "collateral", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "reviewer", type: "address" },
    ],
    outputs: [{ name: "dealId", type: "uint256" }],
  },
  {
    type: "function",
    name: "fundDeal",
    stateMutability: "nonpayable",
    inputs: [{ name: "dealId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "acceptDeal",
    stateMutability: "nonpayable",
    inputs: [{ name: "dealId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "requestCompletion",
    stateMutability: "nonpayable",
    inputs: [{ name: "dealId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "confirmCompletion",
    stateMutability: "nonpayable",
    inputs: [{ name: "dealId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "openDispute",
    stateMutability: "nonpayable",
    inputs: [{ name: "dealId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "resolveDispute",
    stateMutability: "nonpayable",
    inputs: [
      { name: "dealId", type: "uint256" },
      { name: "winner", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "claimExpired",
    stateMutability: "nonpayable",
    inputs: [{ name: "dealId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "nextDealId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "getDeal",
    stateMutability: "view",
    inputs: [{ name: "dealId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "creator", type: "address" },
          { name: "counterparty", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "collateral", type: "uint256" },
          { name: "deadline", type: "uint256" },
          { name: "reviewer", type: "address" },
          { name: "completionRequested", type: "bool" },
          { name: "state", type: "uint8" },
          { name: "createdAt", type: "uint256" },
          { name: "completedAt", type: "uint256" },
        ],
      },
    ],
  },
  {
    type: "event",
    name: "DealCreated",
    inputs: [
      { indexed: true, name: "dealId", type: "uint256" },
      { indexed: true, name: "creator", type: "address" },
      { indexed: true, name: "counterparty", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
      { indexed: false, name: "collateral", type: "uint256" },
      { indexed: false, name: "deadline", type: "uint256" },
      { indexed: false, name: "reviewer", type: "address" },
    ],
  },
  { type: "event", name: "DealFunded", inputs: [{ indexed: true, name: "dealId", type: "uint256" }, { indexed: false, name: "timestamp", type: "uint256" }] },
  { type: "event", name: "DealAccepted", inputs: [{ indexed: true, name: "dealId", type: "uint256" }, { indexed: false, name: "timestamp", type: "uint256" }] },
  { type: "event", name: "CompletionRequested", inputs: [{ indexed: true, name: "dealId", type: "uint256" }, { indexed: false, name: "timestamp", type: "uint256" }] },
  { type: "event", name: "DealCompleted", inputs: [{ indexed: true, name: "dealId", type: "uint256" }, { indexed: false, name: "timestamp", type: "uint256" }] },
  { type: "event", name: "DisputeOpened", inputs: [{ indexed: true, name: "dealId", type: "uint256" }, { indexed: false, name: "timestamp", type: "uint256" }] },
  { type: "event", name: "DisputeResolved", inputs: [{ indexed: true, name: "dealId", type: "uint256" }, { indexed: true, name: "winner", type: "address" }, { indexed: false, name: "timestamp", type: "uint256" }] },
  { type: "event", name: "DealExpired", inputs: [{ indexed: true, name: "dealId", type: "uint256" }, { indexed: false, name: "timestamp", type: "uint256" }] },
] as const;

export const USDC_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const HANDSHAKE_ADDRESS = process.env.NEXT_PUBLIC_HANDSHAKE_ADDRESS as Address;
export const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS as Address;

export const DEAL_STATES = ["CREATED", "FUNDED", "ACTIVE", "DISPUTED", "COMPLETED", "EXPIRED"] as const;
export type DealState = (typeof DEAL_STATES)[number];

export interface Deal {
  creator: Address;
  counterparty: Address;
  amount: bigint;
  collateral: bigint;
  deadline: bigint;
  reviewer: Address;
  completionRequested: boolean;
  state: DealState;
  createdAt: bigint;
  completedAt: bigint;
}

/// @dev getDeal()'s ABI declares named tuple components, so viem decodes
///      the return value as a plain object keyed by those names — not a
///      positional array. (Easy to get backwards once, worth the comment:
///      raw.creator, not raw[0].)
export interface RawDeal {
  creator: Address;
  counterparty: Address;
  amount: bigint;
  collateral: bigint;
  deadline: bigint;
  reviewer: Address;
  completionRequested: boolean;
  state: number;
  createdAt: bigint;
  completedAt: bigint;
}

/// @dev Maps `state`'s raw uint8 onto the DealState enum so the UI never
///      juggles magic numbers.
export function parseDeal(raw: RawDeal): Deal {
  return {
    creator: raw.creator,
    counterparty: raw.counterparty,
    amount: raw.amount,
    collateral: raw.collateral,
    deadline: raw.deadline,
    reviewer: raw.reviewer,
    completionRequested: raw.completionRequested,
    state: DEAL_STATES[raw.state],
    createdAt: raw.createdAt,
    completedAt: raw.completedAt,
  };
}

/// @dev USDC uses 6 decimals — keep every $ <-> smallest-unit conversion
///      here so it's not re-implemented (and possibly gotten wrong) in
///      four different components.
export function toUsdcUnits(dollars: string | number): bigint {
  const [whole, frac = ""] = String(dollars).split(".");
  const fracPadded = (frac + "000000").slice(0, 6);
  return BigInt(whole || "0") * 1_000_000n + BigInt(fracPadded || "0");
}

export function fromUsdcUnits(units: bigint): string {
  const whole = units / 1_000_000n;
  const frac = units % 1_000_000n;
  return `${whole}.${frac.toString().padStart(6, "0")}`.replace(/\.?0+$/, "") || "0";
}

export function useHandshake(): HandshakeContract | null {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  return useMemo(() => {
    if (!publicClient) return null;
    const client = walletClient ? { public: publicClient, wallet: walletClient } : { public: publicClient };
    const contract = getContract({ address: HANDSHAKE_ADDRESS, abi: HANDSHAKE_ABI, client });
    return { ...contract, publicClient } as unknown as HandshakeContract;
  }, [publicClient, walletClient]);
}

export function useUsdc(): UsdcContract | null {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  return useMemo(() => {
    if (!publicClient) return null;
    const client = walletClient ? { public: publicClient, wallet: walletClient } : { public: publicClient };
    const contract = getContract({ address: USDC_ADDRESS, abi: USDC_ABI, client });
    return { ...contract, publicClient } as unknown as UsdcContract;
  }, [publicClient, walletClient]);
}