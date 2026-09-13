# Submission checklist

## Core
- [ ] `forge test -vvv` run locally, all 17 tests passing (11 Handshake +
      6 HandshakeResolver)
- [ ] `Handshake.sol` deployed to Sepolia, address recorded
- [ ] `HandshakeResolver.sol` deployed to Sepolia, address recorded
- [ ] Frontend deployed (Vercel or similar) with the two addresses wired
      into env vars
- [ ] Repo is public, README is accurate, code is what's actually deployed

## Privy — Best Financial Flow
- [ ] Embedded wallet created on login demonstrated live
- [ ] `fundDeal` USDC deposit is a real signed transaction (show tx hash
      in the demo/video, not just a UI state change)
- [ ] Confirm submission is under "Best Financial Flow," not the B2B track

## ENS — Best Use of ENSv2
- [ ] `handshake.eth` registered on Sepolia
- [ ] Resolver set on `handshake.eth` via `SetupENS.s.sol`
- [ ] Live demo shows a `<dealId>.handshake.eth` query returning correct,
      changing state (not a hardcoded value) — this is the qualification
      requirement most likely to be checked closely, don't skip it in the
      video
- [ ] Video recording or live demo link included in submission

## Uniswap — Best Stack Contribution (only if resumed)
- [ ] `FEEDBACK.md` filled in at repo root
- [ ] Uniswap Developer Feedback Form submitted, linking `FEEDBACK.md`
- [ ] README points to the exact contract + lines implementing the
      integration

## General
- [ ] Deadline: Sunday, Sept 13, 2026, 12:00pm EDT — confirm against
      ethglobal.com before final submit, in case of any last-minute change
- [ ] Submitting under Start Fresh / Classic track
