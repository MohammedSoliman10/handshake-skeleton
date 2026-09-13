# Demo script (~2 minutes)

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

5. **Show the Deal Passport.** Navigate to `/passport/<id>`. Point out:
   - the timeline is built entirely from on-chain events, no database
   - the `<dealId>.handshake.eth` identity at the top
   - *(ENS)* open a resolver query tool (e.g. ENS Manager App or a raw
     `resolve()` call) against `42.handshake.eth` and show `status`
     returning `active` live from the contract — then, after the next
     step, re-query and show it change to `completed`. This is the "not
     hardcoded" proof: same query, different answer, because it reads
     live state.

6. **Complete the deal.** Counterparty clicks "Mark as complete," creator
   clicks "Confirm completion" — funds release immediately. Re-check the
   Deal Passport: `COMPLETED`, and the ENS text record for `status` now
   says `completed`.

7. **(Optional) Show a dispute.** Create a second deal, open a dispute as
   either party, switch to the reviewer wallet, resolve it, show the
   full-pot payout to the winner.

Keep step 5's live-before/after resolver query on screen for a few extra
seconds — it's the single most memorable proof point for the ENS judges.
