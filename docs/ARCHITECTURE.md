# Architecture

## Contracts

**`Handshake.sol`** — single contract, no factory/registry split. Holds a
`mapping(uint256 => Deal)` and a `nextDealId` counter. No function anywhere
edits a `Deal`'s creator/counterparty/amount/collateral/deadline once
written — that absence is the entire mechanism behind "terms locked after
acceptance," not a separate hash-check or flag.

State machine:

```
CREATED --fundDeal()--> FUNDED --acceptDeal()--> ACTIVE
                                                    |
                            +-----------------------+------------------------+
                            |                                                |
                  requestCompletion()                                  openDispute()
                  + confirmCompletion()                                      |
                            |                                                v
                            v                                            DISPUTED
                        COMPLETED  <-----------resolveDispute()--------------+

Any of CREATED / FUNDED / ACTIVE --claimExpired() after deadline--> EXPIRED
```

`completionRequested` is a bool flag inside `ACTIVE`, not a separate enum
state — one fewer transition to reason about for the same UX.

Disputes are winner-takes-the-full-pot (`amount + collateral*2`) to the
address `resolveDispute` names, decided by a single fixed `reviewer`
address set per-deal at creation. No partial refunds, no voting, no AI
judge — deliberately, per the original scope discussion.

Every fund-moving function follows checks-effects-interactions (state
written before any `transfer`/`transferFrom` call) plus a manual
`nonReentrant` guard. `test/mocks/ReentrantAttackerToken.sol` exists solely
to prove that guard holds even against a token with a malicious transfer
hook, which standard USDC doesn't have but the test doesn't rely on that.

**`HandshakeResolver.sol`** — ENSIP-10 wildcard resolver
(`IExtendedResolver.resolve(bytes name, bytes data)`). Stores no deal data.
Decodes the DNS-wire-encoded leftmost label of the queried name (`"42"`
from `42.handshake.eth`) into a `dealId`, calls
`handshake.getDeal(dealId)` in the same call, and answers `addr()`/`text()`
queries from that live struct. Supported text keys: `type`, `status`,
`creator`, `counterparty`, `amount`, `collateral`, `deadline`, `reviewer`,
`contract`.

ENS's official `ens-contracts` package was deliberately not pulled in as a
dependency — the two interfaces this resolver needs (`IExtendedResolver`,
`IERC165`) are vendored inline in `HandshakeResolver.sol` so `forge build`
has no external lib requirement beyond `forge-std`.

## Frontend

Next.js 14 App Router, TypeScript, Tailwind. Privy handles auth + embedded
wallet creation (`createOnLogin: 'users-without-wallets'`); wagmi/viem
handle all contract reads/writes against Sepolia. ENS name display
(`components/ENSName.tsx`) resolves against L1 mainnet via a separate viem
client — ENS names live on mainnet regardless of which chain an app
targets, that's not a bug.

- `lib/contract.ts` — ABI (hand-trimmed to what the frontend calls) +
  typed `useHandshake()`/`useUsdc()` hooks.
- `lib/ens.ts` — `useEnsName()` for display, `resolveEnsOrAddress()` for
  form inputs that accept either a raw address or a `.eth` name.
- `components/DealPassport.tsx` — reconstructs a deal's full timeline by
  querying its events directly (no off-chain indexer) and rendering them
  chronologically.

## What's deliberately not here

AI-judge dispute resolution, DAO arbitration, cross-chain support, a
custom Uniswap v4 hook, an off-chain indexer/subgraph, NFT wrapping of
deals. Each was considered and cut to keep the MVP shippable in the
hackathon window — see the priority order in the project's memory/planning
notes if picking any of these back up post-hackathon.
