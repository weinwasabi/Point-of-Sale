---
target: src/screens/SaleScreen.tsx
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 4
target_identity: "file:/Users/itslouofc/Documents/itslouofc/POS/src/screens/SaleScreen.tsx"
target_fingerprint: "sha256:551defb5e183953913964582ae398f21c9ea99ac3cde1fc4d27dc07004023d1a"
target_path: /Users/itslouofc/Documents/itslouofc/POS/src/screens/SaleScreen.tsx
timestamp: 2026-11-04T05-56-14Z
slug: src-screens-salescreen-tsx
---
Method: dual-agent (A: design review sub-agent · B: detector sub-agent)

Run note: neither reviewer could open the app in a browser (Claude in Chrome extension not connected). The design review worked from source; its main claims were checked against the code. Layout-height claims are estimates from the CSS.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Totals and Pay amount update live; new lines past ~5 rows land out of view with no scroll or highlight. |
| 2 | Match System / Real World | 2 | Cash buttons skip ₱500/₱1,000; card label reads "blank = ₱x". |
| 3 | User Control and Freedom | 3 | Void confirms, hold/recall works; one cash tap records the sale; "−" at 1 deletes a line with no undo. |
| 4 | Consistency and Standards | 3 | Consistent buttons; Void confirms but held-sale Delete doesn't; 36px controls break the 44px rule. |
| 5 | Error Prevention | 2 | Scans lost or typed into the cash field while a dialog is open; Delete beside Recall, no confirm. |
| 6 | Recognition Rather Than Recall | 3 | Tiles show name, price, color; nothing shows a basket line is tappable. |
| 7 | Flexibility and Efficiency | 2 | Scan-to-add is excellent; no key opens Pay; Enter does nothing on empty search or in payment. |
| 8 | Aesthetic and Minimalist Design | 3 | Calm, color carries meaning; total shown twice within ~60px. |
| 9 | Error Recovery | 3 | Plain, actionable messages; a mis-tapped cash amount needs a manager refund; deleted held sale unrecoverable. |
| 10 | Help and Documentation | 2 | Useful inline hints; nothing explains line editing. |
| **Total** | | **26/40** | **Acceptable** |

## Design Specificity Verdict

LLM assessment: Visual side is right for an Operate screen; the tile grid + basket + green Pay bar layout is the familiar till pattern and earns its place. Local touches are real (scan without tapping search, ₱, "VAT (included)", honest copy). Where it falls short of this café is in flow details: cash buttons that don't match the notes people hand over, a scanner that stops listening during dialogs, drink choices only in a hidden free-text note.

Deterministic scan: 0 findings in SaleScreen.tsx, SaleModals.tsx, PaymentModal.tsx (exit 0). Confirms the screen follows its visual system; the detector doesn't check flow behavior, where every issue below sits. No false positives.

Visual overlays: none; injection did not run (browser extension not connected).

## Overall Impression

The Sale screen holds DESIGN.md's rules at counter size. Weaknesses show in motion: scans during a dialog, odd cash buttons, a commit button likely below the fold on a 768px-tall screen. Biggest opportunity: make scanning and taking cash continuous.

## What's Working

1. Scan-and-go built for this counter (SaleScreen.tsx:48-60, 70-83).
2. Money readable and in view; Pay bar dominant, disabled when empty; tabular figures; Fixed Basket rule holds at counter sizes.
3. Risky moments guarded, copy honest: Void says "Nothing is recorded" with focus on Cancel; payment dialog can't close mid-card or with payments; card labeled simulated.

## Priority Issues

1. [P1] Scans are lost while a dialog is open. Listener exits when any dialog is open (SaleScreen.tsx:53). On Sale complete, focus on New sale (SaleModals.tsx:282): digits dropped, scanner's Enter presses New sale, no item added, no message. In payment, digits land in Cash received. Fix: scan on Sale complete starts the next sale with that item; in payment, detect scanner bursts and refuse with a visible message. Command: /impeccable harden
2. [P1] Cash buttons leave out ₱500 and ₱1,000. cashSuggestions (totals.ts:109-118) keeps the 4 smallest round-ups: ₱305 → 310/320/350/400; ₱215 → 220/250/300/400. Fix: next ₱100, ₱500, ₱1,000 (₱2,000 above ₱1,000), drop ₱10 steps, add a totals.test.ts case. Command: /impeccable harden
3. [P1] Payment dialog: commit button probably below the fold at 768px tall (~550px room vs ~640px needed; 5-row keypad 312px; estimate). Amount box not in a form, Enter does nothing. Change due only after recording. Fix: 4-row keypad, commit beside balance or in footer, Enter takes cash, live "Change ₱x". Command: /impeccable layout
4. [P1] Portrait tablet: basket and Pay below the whole menu at ≤820px (styles.css:1659-1682), ~1,000px down with All selected (estimate). Fix: sticky bottom bar (items, total, Pay) opening the basket as a sheet. Command: /impeccable adapt
5. [P2] Basket lines: 36×36 qty buttons (styles.css:903-912); "−" at 1 deletes line incl. note/discount, no undo (reducer.ts:115-117); new lines added out of view; edit hint is hover-only (styles.css:876-878). Fix: 44px steppers, scroll+highlight new line (reduced-motion safe), chevron/Edit per line, undo toast. Command: /impeccable polish

## Persona Red Flags

Alex: no key opens Pay; Enter on empty search does nothing (SaleScreen.tsx:72); Enter in Cash received does nothing; ₱500/₱1,000 missing; Pay ~50 tab stops away.
Sam: basket changes and totals never announced (no live region); change due likely not read (focus jumps to New sale); quantity aria-label on a plain span (SaleScreen.tsx:193); chips role="toolbar" (SaleScreen.tsx:122) without arrow-key movement.
Mid-rush café cashier: scans on Sale complete lost; 36px qty, "−" deletes; ₱1,000 not offered; Take cash likely below fold; held Delete one tap beside Recall; print dialog every sale.

## Minor Observations

- Out-of-stock toast "Stock warning: only 0 Ceramic Mug on record." is a red error though the item was added (SaleScreen.tsx:66).
- Disabled Pay bar white on #9aa5b3 is 2.5:1; "Add items to pay" would say more than "Pay ₱0.00".
- Card label "Amount to charge (blank = ₱x)" reads like developer notation (PaymentModal.tsx:149).
- Tile stock pills are 11px, below DESIGN.md's 13px caption.
- Category chips hide while searching; grid jumps.
- Demo Coffee color #7c3f1d is outside DESIGN.md's tile palette (contrast fine).
- On the tablet, auto-focused fields may raise the on-screen keyboard over the app's keypad; check on the real device.

## Questions to Consider

- Should "Sale complete" be the first moment of the next sale, so a scan there simply starts it?
- Should payment offer GCash/Maya instead of a simulated card?
- Senior Citizen/PWD discount (VAT removed, then 20% off; RA 9994 / RA 10754): ₱150 latte → ₱107.14 vs ₱120.00 with the generic 20% preset. Should the till know this rule? Confirm with owner/accountant.
- Should tapping a drink tile ask for size, milk, sugar instead of a hidden free-text note?
