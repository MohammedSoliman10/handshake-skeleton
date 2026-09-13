// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Uniswap ETH→USDC funding path — deferred (P2/stretch per project
// priority order). Cut deliberately: Privy + Solidity + ENS is the
// guaranteed-qualifying scope, and this is the one piece safe to drop
// under time pressure without weakening the other two submissions.
//
// If picked back up, this file should test a funding flow along the lines
// of: user holds ETH -> quote via Uniswap -> swap to USDC -> USDC lands in
// Handshake's escrow via fundDeal(). It needs its own contract (e.g. a thin
// HandshakeUniswapRouter that wraps a swap + fundDeal call) — Handshake.sol
// itself intentionally has no ETH-handling code path, so this would be an
// additive wrapper, not a change to the audited/tested core contract.
