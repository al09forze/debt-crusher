/* Debt Crusher — calculation engine.
 * Pure functions; no DOM. See docs/CALCULATION_LOGIC.md for the math notes.
 */

const Calc = (function () {

  // ----------------------------- helpers -----------------------------
  function startOfMonth(d) { d = new Date(d); d.setDate(1); d.setHours(0,0,0,0); return d; }
  function endOfMonth(d)   { d = new Date(d); d.setMonth(d.getMonth()+1, 0); d.setHours(23,59,59,999); return d; }
  function daysInMonth(d)  { return new Date(d.getFullYear(), d.getMonth()+1, 0).getDate(); }
  function clamp(x, a, b)  { return Math.max(a, Math.min(b, x)); }

  function inMonth(dateStr, ref=new Date()) {
    const d = new Date(dateStr);
    return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
  }
  function inLastNDays(dateStr, n, ref=new Date()) {
    const d = new Date(dateStr);
    const cutoff = new Date(ref); cutoff.setDate(cutoff.getDate() - n);
    return d >= cutoff && d <= ref;
  }

  function money(n) {
    n = Math.round((+n || 0) * 100) / 100;
    const neg = n < 0;
    const abs = Math.abs(n);
    const s = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (neg ? '-$' : '$') + s;
  }
  function moneyShort(n) {
    n = Math.round(+n || 0);
    return '$' + Math.abs(n).toLocaleString('en-US');
  }

  function fmtDate(d, opts={}) {
    return new Date(d).toLocaleDateString('en-US', {
      month: opts.long ? 'long' : 'short',
      day: 'numeric',
      ...(opts.weekday ? { weekday: 'short' } : {}),
      ...(opts.year ? { year: 'numeric' } : {}),
    });
  }

  // ----------------------------- core monthly totals -----------------------------
  function monthlyIncome(state) {
    return +(state.profile?.monthlyIncome || 0);
  }

  function fixedBillsTotal(bills) {
    return (bills || []).reduce((s, b) => s + (+b.amount || 0), 0);
  }

  function totalDebtBalance(debts) {
    return (debts || []).filter(d => !d.paidOff).reduce((s, d) => s + (+d.balance || 0), 0);
  }

  function totalMinPayments(debts) {
    return (debts || []).filter(d => !d.paidOff).reduce((s, d) => s + (+d.minPayment || 0), 0);
  }

  function totalOriginalDebt(debts) {
    return (debts || []).reduce((s, d) => s + (+d.originalBalance || +d.balance || 0), 0);
  }

  // ----------------------------- spending breakdowns -----------------------------
  function spendingByCategory(txns, ref=new Date()) {
    const out = {};
    (txns || []).forEach(t => {
      if (t.type !== 'expense') return;
      if (!inMonth(t.date, ref)) return;
      out[t.category] = (out[t.category] || 0) + (+t.amount || 0);
    });
    return out;
  }

  function monthSpendTotal(txns, ref=new Date()) {
    return (txns||[]).filter(t => t.type==='expense' && inMonth(t.date, ref))
      .reduce((s,t)=> s + (+t.amount||0), 0);
  }
  function monthIncomeTotal(txns, ref=new Date()) {
    return (txns||[]).filter(t => t.type==='income' && inMonth(t.date, ref))
      .reduce((s,t)=> s + (+t.amount||0), 0);
  }

  // discretionary spend (non-essential categories) so far this month
  function discretionarySpendThisMonth(state, ref=new Date()) {
    const essentialIds = new Set((state.categories||[]).filter(c=>c.essential).map(c=>c.id));
    return (state.txns||[]).filter(t =>
      t.type==='expense' && inMonth(t.date, ref) && !essentialIds.has(t.category)
    ).reduce((s,t) => s + (+t.amount||0), 0);
  }

  function discretionaryBudgetTotal(state) {
    const essentialIds = new Set((state.categories||[]).filter(c=>c.essential).map(c=>c.id));
    return Object.entries(state.budgets||{})
      .filter(([cat]) => !essentialIds.has(cat))
      .reduce((s, [,v]) => s + (+v||0), 0);
  }

  // ----------------------------- safe to spend -----------------------------
  /**
   * "Safe to spend" for the rest of this week:
   *   1) Take available cash on hand (estimated from inflows/outflows since start of month + starting cash).
   *   2) Subtract upcoming bills due before next paycheck.
   *   3) Subtract minimum debt payments still owed this month.
   *   4) Allocate the remainder across the days left in the budget window (default: until next payday or end of month).
   */
  function safeToSpend(state, ref=new Date()) {
    const cash = currentCash(state, ref);
    const upcoming = upcomingBills(state, daysUntilNextPaycheck(state, ref), ref)
      .reduce((s,b)=>s + b.amount, 0);

    // remaining min payments due this month (we credit any debt-category txns already made)
    const dueDebts = (state.debts||[]).filter(d => !d.paidOff);
    const minOwed = dueDebts.reduce((s,d)=> s + (+d.minPayment||0), 0);
    const paidThisMonth = (state.txns||[]).filter(t =>
      t.type==='expense' && t.category==='debt' && inMonth(t.date, ref)
    ).reduce((s,t)=> s + (+t.amount||0), 0);
    const minStillOwed = Math.max(0, minOwed - paidThisMonth);

    // discretionary budget remaining this month
    const discBudget = discretionaryBudgetTotal(state);
    const discSpent  = discretionarySpendThisMonth(state, ref);
    const discRemaining = Math.max(0, discBudget - discSpent);

    // floor: never recommend spending more than discretionary budget remaining
    const headroom = Math.max(0, cash - upcoming - minStillOwed);
    const weekly = Math.min(discRemaining, headroom);

    const daysLeftWeek = 7 - ((ref.getDay()+6)%7); // remaining days incl. today (Mon=1..)
    const perDay = weekly / Math.max(1, daysLeftWeek);

    return {
      cash,
      upcomingBills: upcoming,
      minStillOwed,
      discRemaining,
      headroom,
      weekly: Math.round(weekly),
      perDay: Math.round(perDay),
      daysLeftWeek,
    };
  }

  // ----------------------------- cash flow estimate -----------------------------
  function currentCash(state, ref=new Date()) {
    // startCash is a *manual snapshot* of present-day cash on hand at profile creation.
    // We only adjust it by transactions that occurred AFTER the snapshot was taken.
    const start = +state.profile?.startCash || 0;
    const snapshotDate = state.profile?.createdAt ? new Date(state.profile.createdAt) : null;
    let net = 0;
    (state.txns||[]).forEach(t => {
      const d = new Date(t.date);
      if (snapshotDate && d < snapshotDate) return; // pre-snapshot is already baked into startCash
      if (d > ref) return;
      net += (t.type==='income' ? 1 : -1) * (+t.amount||0);
    });
    return Math.round((start + net) * 100) / 100;
  }

  // ----------------------------- bills upcoming -----------------------------
  function nextOccurrence(bill, ref=new Date()) {
    // for a monthly recurring bill with dueDay, find next date >= ref
    const day = clamp(+bill.dueDay || 1, 1, 28);
    const cur = new Date(ref.getFullYear(), ref.getMonth(), day);
    if (cur < ref) cur.setMonth(cur.getMonth() + 1);
    return cur;
  }

  function upcomingBills(state, days=7, ref=new Date()) {
    const horizon = new Date(ref); horizon.setDate(horizon.getDate() + days);
    const out = [];
    (state.bills||[]).forEach(b => {
      const due = nextOccurrence(b, ref);
      if (due <= horizon) out.push({ ...b, dueDate: due });
    });
    // also debt minimum payments
    (state.debts||[]).filter(d => !d.paidOff).forEach(d => {
      const due = nextOccurrence({dueDay: d.dueDay}, ref);
      if (due <= horizon) out.push({
        id: 'debt-'+d.id, name: d.creditor+' (min)',
        amount: d.minPayment, dueDate: due, kind: 'debt',
        category: 'debt'
      });
    });
    return out.sort((a,b) => a.dueDate - b.dueDate);
  }

  function billsThisMonth(state, ref=new Date()) {
    return (state.bills||[]).map(b => ({...b, dueDate: nextOccurrenceWithinMonth(b, ref)}));
  }
  function nextOccurrenceWithinMonth(bill, ref=new Date()) {
    const day = clamp(+bill.dueDay || 1, 1, 28);
    return new Date(ref.getFullYear(), ref.getMonth(), day);
  }

  function daysUntilNextPaycheck(state, ref=new Date()) {
    if (state.profile?.payNextDate) {
      const diff = Math.ceil((new Date(state.profile.payNextDate) - ref) / 86400000);
      if (diff > 0) return diff;
    }
    return 14;
  }

  // ----------------------------- budget status -----------------------------
  function budgetStatus(state, ref=new Date()) {
    const spent = spendingByCategory(state.txns, ref);
    const dim = daysInMonth(ref);
    const dayOf = ref.getDate();
    const daysLeft = dim - dayOf + 1;
    const out = [];
    Object.entries(state.budgets||{}).forEach(([cat, planned]) => {
      const used = spent[cat] || 0;
      const pct = planned > 0 ? used / planned : 0;
      // pace: expected used at day-of-month / dim
      const expected = planned * (dayOf / dim);
      const paceDelta = used - expected;   // > 0 means overspending pace
      out.push({
        category: cat,
        planned,
        used,
        remaining: Math.max(0, planned - used),
        over: used > planned,
        pct,
        paceDelta,
        daysLeft,
      });
    });
    out.sort((a,b) => b.pct - a.pct);
    return out;
  }

  function topOverspending(state, n=3) {
    return budgetStatus(state).filter(b => b.used > 0).slice(0, n);
  }

  // ----------------------------- debt payoff simulator -----------------------------
  /**
   * Simulate month-by-month payoff.
   * strategy = 'snowball' (smallest balance first) or 'avalanche' (highest APR first).
   * extra = additional monthly $ above sum of minimums, applied to the focus debt.
   * Returns { months, totalInterest, schedule: [{month, balance, paid, interest, focusId}] }
   */
  function simulatePayoff(debts, strategy='avalanche', extra=0, maxMonths=600) {
    debts = debts.filter(d => !d.paidOff && +d.balance > 0).map(d => ({
      id: d.id,
      creditor: d.creditor,
      balance: +d.balance,
      apr: +d.apr,
      min: +d.minPayment,
      paidOff: false,
      payoffMonth: null,
    }));
    if (!debts.length) return { months: 0, totalInterest: 0, schedule: [], debtFreeDate: null };

    const startDate = new Date(); startDate.setDate(1);
    let totalInterest = 0;
    const schedule = [];
    let month = 0;

    while (month < maxMonths && debts.some(d => !d.paidOff)) {
      month++;
      // interest accrues monthly = balance * apr/12
      debts.forEach(d => {
        if (d.paidOff) return;
        const interest = d.balance * (d.apr / 100) / 12;
        d.balance += interest;
        totalInterest += interest;
        d._interestThisMonth = interest;
      });

      // pay each min
      let pool = extra;
      debts.forEach(d => {
        if (d.paidOff) return;
        const pay = Math.min(d.min, d.balance);
        d.balance -= pay;
        d._paidThisMonth = pay;
      });

      // pick focus
      const active = debts.filter(d => !d.paidOff && d.balance > 0.005);
      if (active.length && pool > 0) {
        const focus = strategy === 'snowball'
          ? active.slice().sort((a,b) => a.balance - b.balance)[0]
          : active.slice().sort((a,b) => b.apr - a.apr)[0];
        const pay = Math.min(pool, focus.balance);
        focus.balance -= pay;
        focus._paidThisMonth = (focus._paidThisMonth||0) + pay;
        pool -= pay;
      }
      // cascade leftover extra (if focus paid off, push to next)
      while (pool > 0.005) {
        const active2 = debts.filter(d => !d.paidOff && d.balance > 0.005);
        if (!active2.length) break;
        const focus = strategy === 'snowball'
          ? active2.sort((a,b) => a.balance - b.balance)[0]
          : active2.sort((a,b) => b.apr - a.apr)[0];
        const pay = Math.min(pool, focus.balance);
        focus.balance -= pay;
        focus._paidThisMonth = (focus._paidThisMonth||0) + pay;
        pool -= pay;
        if (focus.balance < 0.01) { focus.balance = 0; focus.paidOff = true; focus.payoffMonth = month; }
      }

      // mark paid off
      debts.forEach(d => {
        if (!d.paidOff && d.balance < 0.01) { d.balance = 0; d.paidOff = true; d.payoffMonth = month; }
      });

      const totalBal = debts.reduce((s,d)=>s+d.balance, 0);
      const focusActive = debts.filter(d=>!d.paidOff && d.balance>0);
      const nextFocus = focusActive.length ? (strategy==='snowball'
        ? focusActive.slice().sort((a,b)=>a.balance-b.balance)[0]
        : focusActive.slice().sort((a,b)=>b.apr-a.apr)[0]) : null;

      schedule.push({
        month,
        balance: Math.round(totalBal*100)/100,
        focusId: nextFocus?.id || null,
      });
    }

    const debtFreeDate = new Date(startDate);
    debtFreeDate.setMonth(debtFreeDate.getMonth() + month);

    return {
      months: month,
      totalInterest: Math.round(totalInterest*100)/100,
      schedule,
      debtFreeDate,
      payoffOrder: debts.slice().sort((a,b) => (a.payoffMonth||1e9) - (b.payoffMonth||1e9))
                        .map(d => ({ id: d.id, creditor: d.creditor, month: d.payoffMonth })),
    };
  }

  function recommendedStrategy(debts) {
    // Compare both; if avalanche saves > 5% interest OR > $300, recommend it; else snowball for momentum.
    const ava = simulatePayoff(debts, 'avalanche', 0);
    const sno = simulatePayoff(debts, 'snowball', 0);
    const savings = sno.totalInterest - ava.totalInterest;
    const savingsPct = sno.totalInterest > 0 ? savings / sno.totalInterest : 0;
    const pick = (savings > 300 || savingsPct > 0.05) ? 'avalanche' : 'snowball';
    return {
      strategy: pick,
      interestAvalanche: ava.totalInterest,
      interestSnowball: sno.totalInterest,
      savings,
      avalancheMonths: ava.months,
      snowballMonths: sno.months,
      reason: pick === 'avalanche'
        ? `Avalanche saves $${Math.round(savings)} in interest by hitting your highest-APR debt first.`
        : `Snowball is recommended — savings from avalanche are small, and quick wins keep momentum.`
    };
  }

  // ----------------------------- recurring subscription detection -----------------------------
  function detectRecurring(txns) {
    // Group by merchant + similar amount; if 2+ in last 90 days, flag
    const buckets = {};
    txns.forEach(t => {
      if (t.type !== 'expense') return;
      if (!inLastNDays(t.date, 90)) return;
      const key = (t.merchant||'?').toLowerCase().trim() + ':' + Math.round(+t.amount);
      (buckets[key] = buckets[key] || []).push(t);
    });
    const subs = [];
    Object.values(buckets).forEach(arr => {
      if (arr.length < 2) return;
      subs.push({
        merchant: arr[0].merchant,
        amount: arr[0].amount,
        count: arr.length,
        category: arr[0].category,
        lastDate: arr.map(t=>t.date).sort().slice(-1)[0],
        recurringEstimate: true,
      });
    });
    return subs.sort((a,b)=> b.amount - a.amount);
  }

  // ----------------------------- insights -----------------------------
  function insights(state, ref=new Date()) {
    const out = [];
    const monthSpend = monthSpendTotal(state.txns, ref);
    const lastMonth = new Date(ref); lastMonth.setMonth(lastMonth.getMonth()-1);
    const lastSpend = monthSpendTotal(state.txns, lastMonth);

    // burn rate
    const day = ref.getDate();
    const burn = monthSpend / Math.max(1, day);
    out.push({
      kicker: 'Burn rate',
      title: `${money(burn)} / day this month`,
      body: `At this pace you\u2019d end the month around ${money(burn * daysInMonth(ref))}. ` +
        (lastSpend ? `Last month landed at ${money(lastSpend)}.` : ''),
      severity: 'info',
    });

    // top overspending category
    const top = topOverspending(state, 1)[0];
    if (top && top.over) {
      const catLabel = (state.categories||[]).find(c=>c.id===top.category)?.label || top.category;
      out.push({
        kicker: 'Category alert',
        title: `${catLabel} is over budget`,
        body: `${money(top.used)} spent vs ${money(top.planned)} planned. ` +
              `Pause discretionary ${catLabel.toLowerCase()} until ${fmtDate(endOfMonth(ref))}.`,
        severity: 'warn',
      });
    }

    // subscription creep
    const subs = detectRecurring(state.txns);
    const subTotal = subs.reduce((s,x)=>s+x.amount,0);
    if (subs.length >= 4) {
      out.push({
        kicker: 'Subscription creep',
        title: `${subs.length} recurring charges totaling ${money(subTotal)}/mo`,
        body: `Audit them on the Bills screen. Cancel anything you haven\u2019t used in 60 days.`,
        severity: 'warn',
      });
    }

    // large spike (single txn > 15% of monthly income, non-essential)
    const inc = monthlyIncome(state);
    const essentialIds = new Set((state.categories||[]).filter(c=>c.essential).map(c=>c.id));
    const spikes = (state.txns||[]).filter(t =>
      t.type==='expense' && inLastNDays(t.date, 30) &&
      !essentialIds.has(t.category) && (+t.amount) > inc * 0.10
    );
    if (spikes.length) {
      const big = spikes.sort((a,b)=>b.amount-a.amount)[0];
      out.push({
        kicker: 'Large non-essential spike',
        title: `${money(big.amount)} at ${big.merchant}`,
        body: `That single purchase was ${Math.round(big.amount / Math.max(1,inc) * 100)}% of your monthly income. ` +
          `If it wasn\u2019t planned, route a matching amount toward debt this paycheck.`,
        severity: 'warn',
      });
    }

    // high-risk day pattern: late-night Fri/Sat dining
    const lateNight = (state.txns||[]).filter(t => {
      if (t.type!=='expense' || !inLastNDays(t.date,30)) return false;
      const d = new Date(t.date);
      const dow = d.getDay();
      return (dow===5 || dow===6) && (t.category==='food' || t.category==='shopping');
    });
    if (lateNight.length >= 3) {
      const sum = lateNight.reduce((s,t)=>s+t.amount,0);
      out.push({
        kicker: 'High-risk window',
        title: `Fri/Sat dining is your soft spot`,
        body: `${lateNight.length} purchases totaling ${money(sum)} on weekend nights. ` +
          `Cap weekend dining at ${money(Math.round(sum*0.6))} next month.`,
        severity: 'info',
      });
    }

    // debt progress
    const ttl = totalDebtBalance(state.debts);
    const orig = totalOriginalDebt(state.debts);
    if (orig > 0) {
      const paid = Math.max(0, orig - ttl);
      const pct = paid / orig;
      out.push({
        kicker: 'Debt progress',
        title: `${Math.round(pct*100)}% of the way to debt-free`,
        body: `${money(paid)} crushed out of ${money(orig)}. Keep the extra ${money(state.profile?.extraDebtPayment||0)} ` +
          `flowing each month — that\u2019s the lever that compounds.`,
        severity: 'good',
      });
    }

    return out;
  }

  // ----------------------------- credit health -----------------------------
  function creditUtilization(cards) {
    return (cards||[]).map(c => {
      const util = c.limit > 0 ? c.balance / c.limit : 0;
      let status = 'ok';
      if (util >= 0.7) status = 'danger';
      else if (util >= 0.3) status = 'warn';
      return { ...c, util, status };
    });
  }

  function bestPayoffForUtilization(cards) {
    // Card that, when balance reduced by min(balance, $100) most improves overall utilization.
    const totalBal = cards.reduce((s,c)=>s+c.balance,0);
    const totalLim = cards.reduce((s,c)=>s+c.limit,0);
    if (!totalLim) return null;
    let bestId = null, bestDrop = 0;
    cards.forEach(c => {
      const test = 100;
      const newTotal = totalBal - test;
      const newUtil = newTotal / totalLim;
      const oldUtil = totalBal / totalLim;
      const drop = oldUtil - newUtil;
      if (c.balance >= test && (c.balance / c.limit) > 0.3 && drop > bestDrop) {
        bestDrop = drop; bestId = c.id;
      }
    });
    // fallback: highest individual utilization
    if (!bestId && cards.length) {
      bestId = cards.slice().sort((a,b)=>(b.balance/b.limit) - (a.balance/a.limit))[0].id;
    }
    return cards.find(c => c.id === bestId) || null;
  }

  // ----------------------------- CSV --------------------------------------
  function toCSV(rows, columns) {
    const esc = v => {
      if (v == null) return '';
      const s = String(v);
      if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    const head = columns.map(c => esc(c.label)).join(',');
    const body = rows.map(r => columns.map(c => esc(typeof c.get === 'function' ? c.get(r) : r[c.key])).join(',')).join('\n');
    return head + '\n' + body;
  }

  return {
    // helpers
    money, moneyShort, fmtDate, inMonth, inLastNDays, daysInMonth,
    // totals
    monthlyIncome, fixedBillsTotal, totalDebtBalance, totalMinPayments, totalOriginalDebt,
    // spend
    spendingByCategory, monthSpendTotal, monthIncomeTotal,
    discretionarySpendThisMonth, discretionaryBudgetTotal,
    // cash
    currentCash, safeToSpend, daysUntilNextPaycheck,
    // bills
    nextOccurrence, upcomingBills, billsThisMonth,
    // budget
    budgetStatus, topOverspending,
    // debt
    simulatePayoff, recommendedStrategy,
    // insights
    detectRecurring, insights,
    // credit
    creditUtilization, bestPayoffForUtilization,
    // export
    toCSV,
  };
})();
window.Calc = Calc;
