// Deferred — see contracts/test/UniswapFunding.t.sol for the reasoning.
// This file exists so the planned import path (`@/lib/uniswap`) doesn't
// need to change if the ETH->USDC funding flow gets picked back up as a
// stretch feature after the P0/P1 scope (Solidity + Privy + ENS) is solid.
//
// Sketch of what belongs here if resumed: a quote() call against Uniswap's
// quoter for ETH->USDC on Sepolia, and a swapAndFund() that executes the
// swap then calls Handshake.fundDeal in the same user-facing action (via a
// small wrapper contract, since Handshake.sol itself takes no ETH).

export const UNISWAP_INTEGRATION_STATUS = "deferred" as const;
