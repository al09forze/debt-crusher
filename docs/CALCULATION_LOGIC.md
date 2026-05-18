# CALCULATION_LOGIC.md

How every dollar figure on every screen is actually computed. All functions live in `js/calc.js`. Nothing is faked.

---

## 1. Cash on hand

```
currentCash = profile.startCash
            + Σ ( txn.amount for txn in state.txns
                  if txn.date >= profile.createdAt )
```

`profile.startCash` is the snapshot the user enters during onboarding (or via Settings). After the snapshot, every income transaction adds and every expense transaction subtracts. Historical transactions (those dated **before** `createdAt`) are kept for reporting but are **not** re-applied to cash — otherwise editing history would distort the present-day balance.

Income is stored as a positive amount, expenses as negative.

---

## 2. Safe-to-spend this week

The headline number on the Dashboard.

```
safeToSpend = min(
   ( cash − upcomingBillsTotal − upcomingMinPaymentsTotal ),
   ( discretionaryBudgetRemaining )
)
÷ daysToNextPayCycle
× 7   // shown as "for the week"

clamp safeToSpend ≥ 0
```

Where:

- **`upcomingBillsTotal`** is the sum of `bill.amount` for every non-debt bill whose `dueDay` falls on or before the next paycheck date.
- **`upcomingMinPaymentsTotal`** is the sum of `debt.minPayment` for every debt whose `dueDay` falls in the same window.
- **`discretionaryBudgetRemaining`** is the month's planned discretionary spend (`Σ budgets[cat]` for cats that aren't `Rent / Housing`, `Debt Payment`, or `Income`) minus what has already been spent in those categories this month.
- **`daysToNextPayCycle`** is computed from `profile.payNextDate` and `payFrequency` (weekly=7, biweekly=14, semimonthly≈15, monthly=30).

The **min** picks whichever ceiling bites first — your bank balance or your budget. If the budget is maxed, safe-to-spend reads **$0.00** with the message *"Discretionary budget for the month is maxed. Bills & minimums are still covered — pause non-essentials until [next 1st]."*

---

## 3. Days to payday

```
daysToPayday = ceil( (payNextDate − today) / 86400000 )
if daysToPayday < 0: roll payNextDate forward by payFrequency, recompute
```

---

## 4. Monthly spending by category

```
spendingByCategory[cat] = Σ |txn.amount| for txn in monthTxns
                          where txn.category == cat
                          and txn.amount < 0
                          and not txn.excludeFromBudget
```

Splits are honoured: a single transaction can split across multiple categories, and each split contributes to its own category total.

---

## 5. Budget pacing

For each category with a planned budget:

```
elapsedFraction   = daysElapsedInMonth / daysInMonth
expectedAtPace    = budget × elapsedFraction
deviation         = expectedAtPace − spent

if spent > budget                 → "Over by $X"            (red)
elif deviation < 0                → "$|deviation| behind — ease back"  (amber)
elif deviation > budget × 0.1     → "$deviation ahead — slow down through [last day of month]"  (amber, ahead = ok but worth noting)
else                              → "On pace"               (teal)
```

The "ahead" message is the inverse of overspending — it nudges the user that spending early in the month is fine **only** if they hold the line later.

---

## 6. Debt payoff simulation

`simulatePayoff(debts, extraPayment, strategy)` returns the month-by-month trajectory until every debt is zero.

```
for each month m = 1, 2, ...:
   for each debt:
      interest        = balance × (apr / 12 / 100)
      balance        += interest
      pay             = minPayment      // paid to every active debt
      balance        -= pay
   surplus            = extraPayment + freed-up-minimums-from-paid-debts
   targetDebt         = pickTarget(remainingDebts, strategy)
   targetDebt.balance -= surplus
   record snapshot { month, debts: clone }
   if every debt.balance ≤ 0: stop
```

**Strategy = `'avalanche'`** picks the debt with the **highest APR**.
**Strategy = `'snowball'`** picks the debt with the **smallest remaining balance**.

When a debt is paid off, its minimum payment cascades into the surplus pool — that's the snowball effect.

The function returns:

```
{
  months,                     // number of months to debt-free
  totalInterest,              // sum of all interest accrued
  payoffDate,                 // today + months
  perDebtMonths,              // { debtId: month it was paid off }
  trajectory                  // [ { month, totalBalance }, ... ]  for charting
}
```

### Savings vs minimum-only

```
savings = simulatePayoff(debts, 0,                'avalanche').totalInterest
        − simulatePayoff(debts, extraPayment, strategy).totalInterest
```

### Recommended strategy

```
avalancheSim = simulatePayoff(..., 'avalanche')
snowballSim  = simulatePayoff(..., 'snowball')
savingsDelta = snowballSim.totalInterest − avalancheSim.totalInterest

if savingsDelta < $500 OR savingsDelta / totalDebt < 0.025:
   recommend snowball   ("quick wins keep momentum")
elif user.flexibility == 'aggressive' OR savingsDelta > $1500:
   recommend avalanche  ("optimize for least interest")
else:
   recommend matches profile.payoffStrategy (their stated preference)
```

---

## 7. Recurring detection

```
groupBy(merchantName.toLowerCase().trim())
for each group:
   sameAmountClusters = clusterBy(amount, tolerance = $0.50)
   for each cluster:
      if cluster.size >= 3 within trailing 90 days:
         tag every txn in cluster as recurring = true
         record period   = median( gaps between cluster.dates )
```

A merchant is "recurring" only if it has been seen **three or more times** at essentially the same amount inside a 90-day window. One-off Trader Joe's runs at different totals won't be flagged; iCloud at exactly $9.99 every month will.

---

## 8. Credit utilization

```
overallUtilization = Σ card.balance / Σ card.limit

for each card:
   util = balance / limit

severity:
   util > 0.50  → red    "high"
   util > 0.30  → amber  "elevated"
   util ≤ 0.30  → green  "healthy"
```

### Biggest-utilization-impact recommendation

The card whose util is **furthest above 30%** gets the "Pay down ___ first" call-out. Specifically:

```
bestPayoffForUtilization(cards, target=0.30):
   pick card maximizing  (balance − limit × target)
```

That's the card where a fixed payment buys the most reduction relative to the 30% threshold.

---

## 9. Insights engine

Every insight is a separate detector that runs on the current state and returns either nothing or a `{ kind, title, body }` card.

| Insight | Trigger |
|---|---|
| **Burn rate** | Always — shows daily average spend and the month-end projection (`avg × daysInMonth`). |
| **Category alert** | Any category where `spent > budget`. Picks the worst overrun. |
| **High-risk window** | Aggregate spend by weekday × category; flag if Fri / Sat dining is >2× the weekday average. |
| **Subscription creep** | Sum of recurring subscriptions this month vs three months ago; flag if change > 20%. |
| **Large-spike** | Any non-bill transaction > 3× the median non-bill expense for that category. |
| **Debt progress** | Always — `(initialDebt − currentDebt) / initialDebt`. |

`initialDebt` is read from a snapshot taken at onboarding so progress doesn't reset every time a balance is edited.

---

## 10. Weekly review

```
spent7d     = Σ |txn.amount| for negative txns in last 7 days
earned7d    = Σ  txn.amount  for positive txns in last 7 days
prevSpent7d = same for previous 7 days
deltaVsLastWeek = spent7d − prevSpent7d        // negative = improving

streak = consecutive completed weekly reviews ending in the current week
```

The **recommended action** picks the highest-leverage move available:

1. If any category is over by > $100 → *"Pause [category] until the [next 1st]."*
2. Else if utilization > 50% on any card → *"Pay down [card] first."*
3. Else if a subscription crept up → *"Cancel [subscription]."*
4. Else → *"Add $X to [top goal]."*

Body text always names a concrete dollar amount and a concrete redirect (e.g. *"Holding here through end of month redirects that money to Discover IT"*).

---

## 11. Goals

```
forEach goal:
   progress         = current / target
   monthsRemaining  = ceil( (target − current) / monthly )
   onTrack          = monthsRemaining ≤ goal.targetMonths
```

The debt-free goal pulls its date from `simulatePayoff(...).payoffDate` and labels itself **on track** if that date is ≤ the user's stated target year.

---

## 12. CSV export

`toCSV(txns)` returns RFC-4180 compliant text:

```
date,amount,category,merchant,note,isBusiness,recurring
2026-05-18,-14.50,"Food & Dining","Sweetgreen","Lunch",false,false
...
```

Quoted fields, double-double-quote escaping, `\r\n` line endings.

---

## 13. Formatting

All money is formatted via `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })`. Negatives use the minus sign `−` (U+2212) rather than ASCII hyphen, which renders cleaner in the monospace numeric font.

Dates use `Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' })` for compact day labels; the full date is shown only on detail screens.
