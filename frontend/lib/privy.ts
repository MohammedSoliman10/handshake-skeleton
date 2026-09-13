import { sepolia } from "viem/chains";
import { http } from "viem";
import { createConfig } from "@privy-io/wagmi";

/// @dev Sepolia only — this project targets ENSv2 (Sepolia-only right now)
///      and Sepolia USDC, so there is no multi-chain story for the MVP.
export const wagmiConfig = createConfig({
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL),
  },
});

export const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

export const privyConfig = {
  appearance: {
    theme: "light" as const,
    accentColor: "#3D5A80" as const,
    logo: undefined,
  },
  defaultChain: sepolia,
  supportedChains: [sepolia],
  embeddedWallets: {
    // This is the load-bearing setting for the Privy "Best Financial Flow"
    // bounty: users with no existing wallet get one created automatically
    // on login, so "Continue with Google" -> funded escrow deposit is a
    // real, unbroken flow with no MetaMask install step in between.
    createOnLogin: "users-without-wallets" as const,
  },
};
