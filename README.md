# Handshake

A deal between two people becomes an on-chain object. Both sides stake USDC
collateral, funds lock in escrow, and the agreement's full lifecycle —
created → funded → active → completed/disputed/expired — is permanent and
verifiable. Every deal has its own ENS identity: `<dealId>.handshake.eth`
resolves live to the deal's current state via a custom ENSIP-10 wildcard
resolver.

Built for ETHGlobal ETHOnline 2026 (Start Fresh / Classic track).

## Status

| Piece | Status |
|---|---|
| `Handshake.sol` (escrow, state machine, disputes) | ✅ Written, compiled, 11 tests |
| `HandshakeResolver.sol` (ENSIP-10 wildcard resolver) | ✅ Written, compiled, 6 tests |
| Deploy scripts | ✅ Written |
| Frontend (Next.js + Privy + wagmi) | ✅ Written, builds clean |
| ENS `handshake.eth` registration | ⬜ Manual step — see `contracts/script/SetupENS.s.sol` |
| Uniswap ETH→USDC funding | ⬜ Deferred — see `contracts/test/UniswapFunding.t.sol` |

Contracts were compiled and type-checked directly (solc + a full `next
build`) in the environment this was written in, since `forge` couldn't be
installed there. **Nothing has been run with real `forge test` yet** —
do that first, locally, before anything else.

## Quickstart

### 1. Contracts

```bash
cd contracts
forge install foundry-rs/forge-std --no-commit
forge build
forge test -vvv          # expect 11 + 6 = 17 passing tests
```

Deploy to Sepolia:

```bash
cp .env.example .env     # fill in SEPOLIA_RPC_URL, PRIVATE_KEY, ETHERSCAN_API_KEY

forge script script/DeployHandshake.s.sol:DeployHandshake \
  --rpc-url sepolia --broadcast --verify -vvvv
# copy the printed address into .env as HANDSHAKE_ADDRESS

forge script script/DeployResolver.s.sol:DeployResolver \
  --rpc-url sepolia --broadcast --verify -vvvv
# copy the printed address into .env as RESOLVER_ADDRESS
```

Then, for the ENS piece — **read the comments at the top of
`script/SetupENS.s.sol` first**, this step needs a manual ENS App
registration before it can run:

```bash
forge script script/SetupENS.s.sol:SetupENS --rpc-url sepolia --broadcast -vvvv
```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local   # fill in NEXT_PUBLIC_PRIVY_APP_ID + the addresses above
npm run dev
```

Get a Privy App ID at [dashboard.privy.io](https://dashboard.privy.io) —
free, takes under a minute.

## Architecture

See `docs/ARCHITECTURE.md`. Short version: one contract (`Handshake.sol`,
no factory/registry split), no edit function anywhere (that's how "terms
locked after acceptance" is enforced), winner-takes-the-full-pot dispute
resolution, checks-effects-interactions + a reentrancy guard on every
fund-moving function.

`HandshakeResolver.sol` stores zero deal data — every field it returns is a
live call into `Handshake.getDeal()` at query time, which is what makes it
satisfy the ENS bounty's "not hardcoded" requirement as a structural fact
rather than a claim. `HandshakeResolver.t.sol` has a test that resolves the
same name before and after a real state transition and asserts the answer
changes, which is the concrete proof of that property.

## Sponsor tracks

- **Privy — Best Financial Flow**: embedded wallet on login
  (`createOnLogin: 'users-without-wallets'`), real signed `fundDeal` USDC
  deposit — not mocked.
- **ENS — Best Use of ENSv2**: `HandshakeResolver.sol`, ENSIP-10 wildcard
  resolver for `*.handshake.eth`, live external call on every query.
- **Uniswap — Best Stack Contribution**: deferred (P2/stretch). See
  `contracts/test/UniswapFunding.t.sol` for the reasoning and what it would
  take to pick back up.

## Known gaps to close before submitting

- [ ] Run `forge test` for real and confirm all 17 tests pass — everything
      here was compile-checked, not test-executed, due to sandbox network
      restrictions.
- [ ] Register `handshake.eth` on Sepolia (manual, ~5 min) — see
      `SetupENS.s.sol`.
- [ ] Deploy both contracts to Sepolia and wire the addresses into
      `frontend/.env.local`.
- [ ] Record the demo video (see `docs/DEMO_SCRIPT.md`).
- [ ] If Uniswap gets picked back up: `FEEDBACK.md` + the Uniswap Developer
      Feedback Form are required for that bounty specifically — don't
      forget them if that path is taken.
