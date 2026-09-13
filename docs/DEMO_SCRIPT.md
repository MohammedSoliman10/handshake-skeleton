# Demo script (~3 minutes)

1. **Open the app, sign in.** Click "Continue with Google." No MetaMask
   install, no seed phrase — Privy creates an embedded wallet on the spot.
   *(Privy: embedded wallet, real flow.)*

2. **Create a deal.** Go to Create, fill in a counterparty (`.eth` name or
   address), amount ($100), collateral ($20 each), a deadline, and a
   reviewer. Submit — this only writes the deal object, no funds move yet.

3. **Fund it.** On the deal page, click "Fund deal." This is a real signed
   USDC approval + `fundDeal` transaction on Sepolia — show the tx hash.
   *(Privy: real financial flow, not mocked.)*

4. **Switch wallets, accept.** As the counterparty, open the same deal
   link, click "Accept deal" — posts their collateral, state moves to
   `ACTIVE`. Terms are now structurally locked (no edit function exists).

5. **Prove the ENS resolver reads live state — round one.** Open a
   terminal and run:

```bash
   cast call 0xCC041e7693D363d796c0E31E9F99D992434b7843 "resolve(bytes,bytes)(bytes)" 0x01310d68616e647368616b656465616c0365746800 0x59d1d43c0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000067374617475730000000000000000000000000000000000000000000000000000 --rpc-url sepolia
```

   This asks `HandshakeResolver` — the same way an ENSIP-10-compliant
   client would — for `1.handshakedeal.eth`'s `status` record. It returns
   `0x...` decoding to **`"active"`**. Point out: this contract stores zero
   deal data. Every answer is read live from `Handshake.getDeal()` at query
   time — nothing cached, nothing hardcoded.

6. **Complete the deal.** Counterparty clicks "Mark as complete," creator
   clicks "Confirm completion" — funds release immediately.

7. **Prove it again — round two.** Run the exact same `cast call` command
   from step 5, unchanged. It now decodes to **`"completed"`**. Same query,
   different answer, because the underlying deal actually changed on-chain.
   This before/after pair is the concrete "not hardcoded" proof — keep both
   outputs on screen together for a few extra seconds, it's the single most
   memorable moment for ENS judges.

8. **Show the Deal Passport.** Navigate to `/passport/1`. Point out the
   timeline is built entirely from on-chain events (no database), showing
   the same lifecycle the `cast call` just proved from a different angle,
   plus the `1.handshakedeal.eth` identity label at the top.

9. **(Optional) Show a dispute.** Create a second deal, open a dispute as
   either party, switch to the reviewer wallet, resolve it, show the
   full-pot payout to the winner.

---

**Important note on the `cast call` command above:** the deal ID is baked
into the encoded name bytes (`0x01310d...` — the `31` right after `01` is
ASCII `'1'`, meaning "deal #1"). If you record with a **new** deal instead
of reusing the already-completed Deal #1, check its ID in the URL
(`/deal/<id>`) and swap that one byte:

| Deal ID | Byte to use instead of `31` |
|---|---|
| 0 | `30` |
| 1 | `31` (as written above) |
| 2 | `32` |
| 3 | `33` |
| ... | `30` + the digit, in hex |

So for deal #2, the command becomes:
`0x01320d68616e647368616b656465616c0365746800 ...` (rest unchanged).
For deal IDs 10+, the encoding needs two label-length bytes instead of
one — ask for help regenerating it if you get there.