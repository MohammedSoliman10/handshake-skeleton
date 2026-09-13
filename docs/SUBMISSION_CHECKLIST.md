# Submission checklist

## Core
- [x] `forge test -vvv` run locally, all 18 tests passing (11 Handshake +
      7 HandshakeResolver)
- [x] `Handshake.sol` deployed to Sepolia: `0xE4e1a354CfeC8F127f7C823bC872A20eDDa0c15A`
- [x] `HandshakeResolver.sol` deployed to Sepolia: `0xCC041e7693D363d796c0E31E9F99D992434b7843`
- [ ] Frontend deployed publicly (Vercel or similar) — currently only run
      locally; optional, video covers the demo either way
- [x] Repo is public, README is accurate, code is what's actually deployed

## Privy — Best Financial Flow
- [x] Embedded wallet created on login demonstrated live
- [x] `fundDeal` USDC deposit is a real signed transaction (shown in video)
- [x] Confirm submission is under "Best Financial Flow," not the B2B track

## ENS — Best Use of ENSv2
- [x] `handshakedeal.eth` registered on Sepolia (real `handshake.eth` was
      already taken on this ENSv2 Sepolia deployment)
- [x] Resolver set on `handshakedeal.eth` via explorer.ens.dev's
      "Change resolver" UI, pointing at `HandshakeResolver`
- [x] Live demo shows a `<dealId>.handshakedeal.eth` query returning
      correct, changing state (not a hardcoded value) — proven via direct
      `cast call` before/after a real state transition, shown in the video
- [x] Video recording included in submission

## Uniswap — Best Stack Contribution
- [ ] Not attempted — deliberately deferred. See
      `contracts/test/UniswapFunding.t.sol` for reasoning.

## General
- [ ] Deadline: Sunday, Sept 13, 2026, 12:00pm EDT — confirm against
      ethglobal.com right before final submit
- [x] Submitting under Start Fresh / Classic track