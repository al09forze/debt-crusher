# Debt Crusher

A serious tool for crushing debt. Mobile-first **Progressive Web App** — no backend, no bank linking, all data stays on the device. Built as a single self-contained static bundle (HTML / CSS / vanilla JS), installable on iPhone or Android via "Add to Home Screen."

---

## Quick start

```bash
cd debt-crusher
python3 -m http.server 5050
# open http://localhost:5050
```

Any static server works (`npx serve`, `python -m http.server`, `caddy file-server`, S3 + CloudFront, GitHub Pages, etc.) — there is no build step. The PWA service worker requires an HTTP(S) origin, so `file://` will load the app but won't cache for offline.

## Install on iPhone

1. Open the served URL in **Safari** (not Chrome — only Safari can install PWAs on iOS).
2. Tap the **Share** button.
3. Scroll down and tap **Add to Home Screen**.
4. Tap **Add** — the app installs with its own icon, opens full-screen (no Safari chrome), and works offline after the first load.

## Install on Android

1. Open the URL in Chrome.
2. Tap the three-dot menu → **Add to Home screen** or **Install app**.

---

## Features

**Eleven screens, all functional, all wired to real math:**

| Screen | What it does |
|---|---|
| Dashboard | Safe-to-spend this week, cash on hand, days to payday, total debt, fixed bills, payoff progress, monthly spend by category, upcoming-bills strip. |
| Activity | Searchable, filterable transaction log grouped by day. Day / Week / Month period filters; All / Out / In / Biz type filters. Recurring tag for detected subscriptions. |
| Budget | Monthly remaining, top overspending alert, per-category bars with pacing logic ("$775 ahead — slow down through May 31"). |
| Bills | List and calendar views. Past-due, due-this-week, future bills grouped. One-tap "Mark paid" creates the transaction. |
| Debt Plan | Estimated debt-free date, total interest projected, savings vs minimum-only, snowball ↔ avalanche toggle with smart recommendation, "next dollar goes here" call-out, full debt list. |
| Simulator | Slide extra-payment amount, compare avalanche vs snowball months & interest, see debt-free trajectory chart, save to plan. |
| Insights | Burn rate (with month-end projection), category alerts, weekend-spending pattern, subscription creep, large-spike detection, debt progress. |
| Goals | Debt-free date with on-track / behind status, savings goals (emergency fund, sinking funds, travel, taxes) with per-goal progress and required monthly contribution. |
| Credit Health | Overall utilization, per-card snapshot with semantic colors (red > 50%, amber > 30%, green ≤ 30%), biggest-utilization-impact recommendation. Manual entry — no fake API. |
| Weekly Review | 7-day spent, vs last week, streak, recommended action with concrete dollar redirect, upcoming bills, "mark complete" to grow streak. |
| Settings | Profile (income, pay frequency, next pay date, cash snapshot, extra debt payment, default strategy), behavior (friction warnings, wishlist pause), data (export JSON, export CSV, reset). |

**Plus:**

- **CSV export** of all transactions, RFC-4180 quoted.
- **JSON export** of full state (bills, debts, goals, transactions, settings) for backup.
- **Recurring detection** — flags merchants seen 3+ times at the same amount within 90 days.
- **Friction warnings** — confirm modal before a transaction that would push a category over budget.
- **24-hour wishlist pause** — add a wanted purchase, app holds it; if you still want it after 24 hours, mark it bought.
- **Weekly streak** — confirmed weekly reviews accrue a streak count.
- **Snowball + avalanche** — both strategies implemented with month-by-month interest accrual; app recommends whichever fits your psychology and savings tolerance.
- **Reminders UI** — bills surface "due in N days" and "past" badges. (PWA reminders without a server are limited to in-app surfaces; the app does not send push notifications.)
- **Defensive storage** — if `localStorage` is unavailable (private mode, quota), the app falls back to an in-memory store so the UI still works for the session.

---

## File map

```
debt-crusher/
├── index.html                  app shell (appbar, view, tabbar, drawer, FAB, sheet, toast)
├── manifest.webmanifest        PWA manifest (name, theme, icons, standalone)
├── sw.js                       service worker (network-first HTML, cache-first assets)
├── css/
│   └── app.css                 design system: tokens, typography, layout, components
├── js/
│   ├── storage.js              localStorage wrapper with in-memory fallback
│   ├── data.js                 category catalog + buildDemoData() realistic seed
│   ├── calc.js                 pure functions: safe-to-spend, payoff sim, insights
│   ├── charts.js               inline-SVG charts (bar list, line, comparison bars)
│   ├── screens.js              11 screen renderers (pure HTML strings)
│   └── app.js                  controller: router, state, sheets, event delegation
├── icons/
│   ├── icon-192.png            home-screen icon (Android)
│   ├── icon-512.png            splash + high-DPI
│   ├── icon-512-maskable.png   Android adaptive (safe zone)
│   ├── apple-touch-icon.png    180×180 iOS home-screen
│   ├── favicon-32.png, favicon-16.png
│   └── gen_icons.py            Pillow generator (rerun to recolor)
└── docs/
    └── CALCULATION_LOGIC.md    how every number on screen is computed
```

---

## Design system

| Token | Value |
|---|---|
| Background | `#0E0F11` |
| Surface | `#15171A` |
| Accent (teal) | `#32D1C4` |
| Accent hover | `#1FB3A6` |
| Text | `#ECEFF1` |
| Muted text | `#8C939A` |
| Warning (amber) | `#F2A93B` |
| Danger (rose) | `#F26678` |

- **Type:** General Sans (Fontshare CDN) for UI, JetBrains Mono for numerics. System stack fallbacks: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, ...`.
- **Dark mode is the default** and the design target. A light theme exists (`html[data-theme="light"]`) but the app is tuned for dark.
- **No bubbly gradients, no cartoon mascots.** Rectangular cards, 14 px radii, hairline borders, single accent color, restrained motion.
- **Mobile-first.** Bottom tab bar on phones, floating pill tab bar on ≥720 px, two-column dashboard grid on ≥1080 px.

---

## Data model

Everything lives in `localStorage` under one key: `debt-crusher.v1`.

```jsonc
{
  "profile": {
    "monthlyIncome": 6200,
    "payFrequency": "biweekly",
    "payNextDate": "2026-05-26",
    "startCash": 1840,
    "createdAt": "2026-05-18T...",
    "extraDebtPayment": 350,
    "payoffStrategy": "avalanche",
    "flexibility": "aggressive"
  },
  "txns":        [ /* { id, date, amount, category, merchant, note, isBusiness, recurring, splits } */ ],
  "bills":       [ /* { id, name, amount, dueDay, category, isDebt, debtId } */ ],
  "debts":       [ /* { id, name, type, balance, apr, minPayment, dueDay } */ ],
  "goals":       [ /* { id, name, target, current, monthly, kind } */ ],
  "budgets":     { "Shopping": 220, "Groceries": 480, ... },
  "creditCards": [ /* { id, name, limit, balance } */ ],
  "checkins":    [ /* { weekStart, completedAt } */ ],
  "wishlist":    [ /* { id, name, amount, addedAt, status } */ ],
  "settings":    { "friction": true, "wishlistPause": true, "theme": "dark" }
}
```

Reset via Settings → Reset, or `localStorage.clear()` in DevTools.

---

## What this app is **not**

- It is **not** a bank aggregator. There is no Plaid integration. You enter transactions yourself, the same way an envelope-budget user would. That's deliberate — friction is the feature.
- It is **not** a credit-score reporter. The Credit Health screen visualizes utilization from manually entered limits and balances; it does not query a credit bureau.
- It is **not** cloud-synced. Use the JSON export in Settings to back up or move data between devices.

---

## License

MIT. Use, fork, modify freely.
