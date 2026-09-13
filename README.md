# Handshake

A deal between two people becomes an on-chain object. Both sides stake USDC
collateral, funds lock in escrow, and the agreement's full lifecycle —
created → funded → active → completed/disputed/expired — is permanent and
verifiable. Every deal has its own ENS identity: `<dealId>.handshakedeal.eth`
resolves live to the deal's current state via a custom ENSIP-10 wildcard
resolver.

Built for ETHGlobal ETHOnline 2026 (Start Fresh / Classic track).

## Status — fully working, tested end to end on Sepolia

| Piece | Status |
|---|---|
| `Handshake.sol` (escrow, state machine, disputes) | ✅ 11/11 tests passing |
| `HandshakeResolver.sol` (ENSIP-10 wildcard resolver) | ✅ 7/7 tests passing |
| Deployed to Sepolia | ✅ `Handshake`: [`0xE4e1a354CfeC8F127f7C823bC872A20eDDa0c15A`](https://sepolia.etherscan.io/address/0xE4e1a354CfeC8F127f7C823bC872A20eDDa0c15A) |
| | ✅ `HandshakeResolver`: [`0xCC041e7693D363d796c0E31E9F99D992434b7843`](https://sepolia.etherscan.io/address/0xCC041e7693D363d796c0E31E9F99D992434b7843) |
| Frontend (Next.js + Privy + wagmi) | ✅ Full lifecycle demoed live: create → fund → accept → complete |
| ENS registration | ✅ `handshakedeal.eth` registered on ENSv2 (Sepolia beta), resolver set, live-verified via direct contract call |
| Uniswap ETH→USDC funding | ⬜ Deliberately deferred — see `contracts/test/UniswapFunding.t.sol` |

## Proof, not just claims

- **17 → 18 tests, all passing**, run for real with `forge test -vvv`.
- **A real deal was created, funded, accepted, and completed** on Sepolia using
  two separate wallets (a Privy embedded wallet as creator, a MetaMask wallet
  as counterparty) — real signed USDC transactions throughout, nothing mocked.
- **The Deal Passport page** (`/passport/<id>`) renders that deal's full
  on-chain timeline, reconstructed entirely from contract events.
- **The ENS resolver was verified live** with a direct `cast call` simulating
  an ENSIP-10 client query for `1.handshakedeal.eth`'s `status` record — it
  returned `"completed"`, read straight from `Handshake.getDeal()` with zero
  data stored in the resolver itself.

## Quickstart

### 1. Contracts

```bash
cd contracts
forge install foundry-rs/forge-std
forge build
forge test -vvv          # 18 tests: 11 in Handshake.t.sol, 7 in HandshakeResolver.t.sol
```

To deploy your own instance (already deployed at the addresses above for this submission):

```bash
cp .env.example .env     # fill in SEPOLIA_RPC_URL, PRIVATE_KEY, ETHERSCAN_API_KEY

forge script script/DeployHandshake.s.sol:DeployHandshake \
  --rpc-url sepolia --broadcast --verify -vvvv
# copy the printed address into .env as HANDSHAKE_ADDRESS

forge script script/DeployResolver.s.sol:DeployResolver \
  --rpc-url sepolia --broadcast --verify -vvvv
# copy the printed address into .env as RESOLVER_ADDRESS
```

ENS setup is a manual step (real stablecoin registration via app.ens.dev,
then setting the resolver via explorer.ens.dev) — see the comments at the
top of `script/SetupENS.s.sol` for why this can't be scripted, and
`docs/ARCHITECTURE.md` for how it was actually done for this submission.

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
changes — the concrete proof of that property, backed by the same result
observed live on Sepolia (see Proof section above).

## Sponsor tracks

- **Privy — Best Financial Flow**: embedded wallet on login
  (`createOnLogin: 'users-without-wallets'`), real signed `fundDeal` USDC
  deposit — demoed live end to end on Sepolia.
- **ENS — Best Use of ENSv2**: `HandshakeResolver.sol`, ENSIP-10 wildcard
  resolver for `*.handshakedeal.eth`, live external call on every query,
  registered and verified on real ENSv2 (Sepolia beta).
- **Uniswap — Best Stack Contribution**: deliberately not attempted. See
  `contracts/test/UniswapFunding.t.sol` for the reasoning and what it would
  take to pick back up.

## Remaining before final submission

- [ ] Record the demo video (see `docs/DEMO_SCRIPT.md`)
- [ ] Final pass through `docs/SUBMISSION_CHECKLIST.md`