# Mandate — 60-second demo recording script

**Goal:** one continuous screen recording that walks: **compose → gate → approve/block → mandate edit → stacking**.
No cuts required. Total ≈ 60 s. Every verdict in this script is produced live by the engine from the
*current* book and mandate — nothing here is scripted, and the numbers below are what the default
policy produces on a fresh session.

> I can't screen-record from a headless shell, so this is the shot-list. Record with your phone's
> screen recorder (or OBS) while you follow it, read the **narrate** line aloud or drop it in as a
> caption. Vercel deploy URL → the running app → start recording.

---

## Before you hit record (30 s)

1. Open the app in a **fresh browser profile / incognito** (so localStorage starts empty).
2. Confirm **Demo** mode is on (top-right toggle in the app, not Live).
3. If the Home feed already has an awaiting approval from an earlier session, Approve or Decline it
   first (or clear the mandate with the Profile/Reset in the app), so the book starts at **$0**.
4. Land on **Home** (`/app`). Start recording.

---

## Shot list

| ⏱ time | Do this | What you should see | Narrate |
|---|---|---|---|
| 0:00 | **Home → Proposal lab → tab “Hostile probes”** → tap **“Stacking attack (drip)”**. | A “Stacking replay · BTC” card appears: drip chips **#1 · $40 ✓, #2 · $40 ✓, #3 · $40 ✓, #4 · $40 ✕**; badge **“stopped at order #4”**; a **DENY** gateway strip: `guard → trade(BTC, buy, $40, spot)`. | “A hostile agent drip-feeds $40 BTC buys to sneak past the $150 position cap. Each order is small — but the engine counts BTC cumulatively and refuses drip #4. Nothing was sent.” |
| 0:08 | Switch to tab **“Compose an action”**. Asset `BTC` · Amount `100` · Buy · Spot. Optional goal: `Buy $100 BTC`. Tap **“Rule this action now”**. | Result card **“Passes — needs your OK”**, **HOLD** gateway strip `guard → trade(BTC, buy, $100, spot)`, note *nothing has been sent*. A banner appears: *“Approve or decline the pending action first”* with **Open Approvals**. | “A rule-abiding buy passes every check — but this mandate requires a human, so the guard HOLDS the call. No broker has seen it.” |
| 0:14 | Tap **Open Approvals**. On the pending card tap **Approve Buy $100 BTC**. | Guard-position band on top recomputes live: **Exposure $0 → $100**, **Buying power $500 → $400**. Card clears to “All decisions handled”. | “I approve. The demo broker executes a simulated fill and the position recomputes: exposure $100, buying power $400. Declining would have added nothing.” |
| 0:22 | Back to **Home** (bottom nav). Compose tab. Change Amount to `250` (BTC · Buy · Spot). Tap **“Rule this action now”**. | Result card **Blocked**; **DENY** gateway `guard → trade(BTC, buy, $250, spot)`; chips **“Rules that fired: Position size”**; reason: $100 held + $250 would exceed the $150 cap. | “The big order — Buy $250 BTC — is DENIED. $100 already held plus $250 would blow the position cap, so the call never reaches a broker.” |
| 0:28 | On that result, tap **“Change the mandate & re-run this exact action”**. | Policy page opens in **Re-test mode**: *“Buy BTC · $250 · spot is queued to re-run on Save.”* | “Now I change the rules, not the script.” |
| 0:32 | In **Max position / trade**, move $150 → **$400**. Tap **“Save & re-run the action”**. | Policy version bumps. The SAME $250 buy now evaluates to **“Passes — needs your OK”** (**HOLD**) and routes to Approvals. | “Raise the position cap to $400 and re-run the exact same $250 buy — it flips from DENY to HOLD. The verdict came from the rules.” |
| 0:45 | On Approvals tap **Approve Buy $250 BTC**. | Band recomputes: **Exposure $350**, **Buying power $150**. | “Approve again — exposure $350, buying power $150, still under the new $400 cap.” |
| 0:52 | Bottom nav → **Home → Hostile probes → “Stacking attack (drip)”** again. | The replay re-runs against the new mandate: now **#1 · $40 ✓, #2 · $40 ✕** — the stop moved with the cap. | “Run the stacking replay again: with $350 already held, the very next drip is refused. The stop moved with the cap.” |
| 0:58 | Bottom nav → **Audit**. | Every decision in one trail: HOLD → approve → DENY → mandate v2 → approve, each with its rule chips and the `guard →` call line. | “And the audit trail records every decision, every rule result, and every call the guard answered.” |

Total ≈ **60 s**. Freeze on the Audit screen (or the header GitHub icon on the landing page) for the last 2 s.

---

## Recording tips

- Record **landscape**; the app shell is `max-w-xl`, so portrait is fine but landscape crops less.
- Read the **Narrate** column at each marker — it lands ~when the on-screen state does.
- Don't refresh mid-run: state lives in localStorage and the book must stay continuous.
- If a step's on-screen numbers drift (you approve in a different order, or an earlier session left a
  book), just narrate the numbers that *appear* — the demonstration is the approve/deny recompute, not
  the exact figures.
- Optional opener (0:00→0:03) if you want the repo visible: land on `/`, show the header GitHub icon
  briefly, then **Open app**.

## Optional 30-second extension (if the brief wants more rules)

Swap shot 4's amount to `80` with Asset `SOL` → Blocked by **Allowed assets** (SOL off the allowlist),
then continue the mandate-edit shot by **adding SOL** to the allowlist instead of raising the cap — the
same $80 SOL then flips to HOLD. Keeps the “change rules, watch verdict flip” proof with a second rule.
