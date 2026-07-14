# Ledger — Claude Code Handoff

Status: UI-only prototype. Read-only and advisory. Ledger cannot and must never move money.

## Purpose
Personal CFO / project accountant / spending controller / subscription manager / cash-flow forecaster / purchase reviewer / financial survival system. Optimize long-term stability, not features. Primary rule: "Buy the least expensive reliable option that completes the approved milestone."

## Views (Ledger Mobile.dc.html, bottom nav)
1. **Ledger (Home)** — Safe to Spend hero + expandable breakdown, key numbers grid (posted cash, pending, bills 30d, reserve, burn, runway), Cost Governor bar, Ledger flags, CPA boundary text.
2. **Accounts** — simulated connection cards: Chase (checking/savings), Apple Card, Apple Cash, Cash App (MISSING state demo), PayPal, OpenAI API, Claude, Vercel, Supabase, Domains, Business accounts + OpenAI billing example values ($20 limit, alerts $16/$20, $10 prepaid, $5 threshold, restore to $10, $10/mo recharge cap).
3. **Bills & Subs** — due 7/30 days; subscriptions with duplicate/unused/no-launch-plan flags and "mark for cancellation review" toggle (persisted).
4. **Projects** — revenue-first ranking with cost-to-finish, monthly-after-launch, budget-left, break-even; "finish this before starting another" recommendation.
5. **Review** — full purchase-review record (outcome, why now, alternatives, lowest-cost option, premium option, cost, project paying, STS impact, benefit, risk, delay consequence, cancellation requirement) + Ledger recommendation + Accept/Override (persisted, advisory only) + expense classifications + hard prohibitions.

## Safe to Spend
Cash − pending − bills(30d) − debt minimums − emergency reserve − commitments − tax set-aside. Data states: POSTED / PENDING / CONFIRMED / ESTIMATED / ASSUMED / MISSING. Credit limits are never cash; unconfirmed revenue is never cash.

## Expense classifications
Essential (pay) · Milestone-enabling (fund if budgeted) · Efficiency upgrade (justify) · Growth experiment (cap+measure) · Convenience (challenge) · Luxury/premature scale (challenge).

## Cost Governor thresholds
50% warn · 75% reduce optional · 80% approval required for new paid services · 90% pause optional AI work · 100% stop nonessential AI work. Never auto-increase budget; never silently consume another project's reserve.

## Boundaries
May: read, categorize, forecast, warn, recommend, prepare reports/purchase requests.
May not: transfer, pay, send PayPal/Cash App, open credit, trade, change bank details, approve subscriptions, raise limits, write AEGIS state.
Future real actions require: exact amount, recipient, source account, purpose, fraud check, duplicate check, AEGIS approval, Face ID / hardware confirmation, final provider confirmation.

## Real integrations later
Plaid-class aggregation (read-only scopes), provider billing APIs (OpenAI/Anthropic/Vercel/Supabase), subscription detection from transactions, push alerts at governor thresholds. All secrets server-side only.

## Storage
ledger_mobile_v1 (decisions + cancel marks only). Demo financial figures are hardcoded seed data, clearly simulated.
