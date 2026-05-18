/* Debt Crusher — screen renderers.
 * Each export takes the current state and returns HTML.
 * Event wiring happens in app.js via event delegation + per-screen mount fns.
 */
const Screens = (function () {

  const ICONS = {
    food:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 11h18l-1 9H4z"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    car:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 14l2-6a2 2 0 0 1 2-1h10a2 2 0 0 1 2 1l2 6v5h-3v-2H6v2H3z"/><circle cx="7" cy="17" r="1.4"/><circle cx="17" cy="17" r="1.4"/></svg>',
    home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/></svg>',
    tv:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/></svg>',
    bag:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 7h14l-1 13H6z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>',
    card:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/></svg>',
    briefcase:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>',
    cart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 5h2l3 11h11l2-8H6"/><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/></svg>',
    bolt:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M13 2L4 14h7l-2 8 10-13h-7z"/></svg>',
    heart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21s-7-4.5-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.5-9 9-9 9z"/></svg>',
    dots:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="18" cy="12" r="1"/></svg>',
    income:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
    arrow:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 12h14M13 5l7 7-7 7"/></svg>',
  };

  function catIcon(catId) {
    const cat = (Store.load().categories||[]).find(c=>c.id===catId);
    return ICONS[cat?.icon] || ICONS.dots;
  }
  function catLabel(catId) {
    return (Store.load().categories||[]).find(c=>c.id===catId)?.label || catId;
  }

  function relDate(dateStr) {
    const d = new Date(dateStr);
    const today = new Date(); today.setHours(0,0,0,0);
    const diff = Math.floor((d.setHours(0,0,0,0) - today) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === -1) return 'Yesterday';
    if (diff === 1) return 'Tomorrow';
    if (diff > 1 && diff <= 7) return 'in ' + diff + ' days';
    if (diff < 0 && diff >= -6) return Math.abs(diff) + 'd ago';
    return Calc.fmtDate(new Date(dateStr));
  }

  // ===================================================================
  // DASHBOARD
  // ===================================================================
  function Dashboard(state) {
    const s2s = Calc.safeToSpend(state);
    const cash = Calc.currentCash(state);
    const income = Calc.monthlyIncome(state);
    const billsTotal = Calc.fixedBillsTotal(state.bills);
    const debtTotal = Calc.totalDebtBalance(state.debts);
    const minTotal = Calc.totalMinPayments(state.debts);
    const monthSpend = Calc.monthSpendTotal(state.txns);
    const monthInc = Calc.monthIncomeTotal(state.txns);
    const upcoming = Calc.upcomingBills(state, 7);
    const spendByCat = Calc.spendingByCategory(state.txns);

    const origDebt = Calc.totalOriginalDebt(state.debts);
    const paidDebt = Math.max(0, origDebt - debtTotal);
    const progress = origDebt > 0 ? paidDebt / origDebt : 0;

    const ins = Calc.insights(state)[0];

    const categoriesData = (state.categories||[])
      .map(c => ({ label: c.label, value: spendByCat[c.id] || 0, planned: state.budgets[c.id] }))
      .filter(d => d.value > 0)
      .sort((a,b)=>b.value-a.value)
      .slice(0, 6);

    return `
      <div class="dashboard-grid">
       <div>
        <section class="hero">
          <div class="hero__label">Safe to spend this week</div>
          <div class="hero__amount ${s2s.weekly<=0?'danger':''}" data-num>${Calc.money(s2s.weekly)}</div>
          <div class="hero__sub">
            ${s2s.weekly > 0
              ? `~ ${Calc.money(s2s.perDay)}/day for ${s2s.daysLeftWeek} day${s2s.daysLeftWeek===1?'':'s'}. After bills &amp; minimums.`
              : `Discretionary budget for the month is maxed. Bills &amp; minimums are still covered — pause non-essentials until ${Calc.fmtDate(new Date(new Date().getFullYear(), new Date().getMonth()+1, 1))}.`}
          </div>
          <div class="hero__row">
            <div>
              <div class="hero__stat__lbl">Cash on hand</div>
              <div class="hero__stat__val num">${Calc.money(cash)}</div>
            </div>
            <div>
              <div class="hero__stat__lbl">Days to payday</div>
              <div class="hero__stat__val num">${Calc.daysUntilNextPaycheck(state)}</div>
            </div>
          </div>
        </section>

        <div class="stat-grid mt-16">
          <div class="stat"><div class="stat__lbl">Income / mo</div><div class="stat__val num">${Calc.money(income)}</div></div>
          <div class="stat"><div class="stat__lbl">Fixed bills</div><div class="stat__val num">${Calc.money(billsTotal)}</div></div>
          <div class="stat"><div class="stat__lbl">Total debt</div><div class="stat__val num">${Calc.money(debtTotal)}</div></div>
          <div class="stat"><div class="stat__lbl">Min payments</div><div class="stat__val num">${Calc.money(minTotal)}</div></div>
        </div>

        <section class="card mt-16">
          <div class="card__title">Debt payoff progress</div>
          <div class="row-spaced">
            <div class="num soft" style="font-size:13px;">${Calc.money(paidDebt)} crushed</div>
            <div class="num soft" style="font-size:13px;">${Calc.money(origDebt)} target</div>
          </div>
          <div class="bar" style="margin-top:8px;height:10px">
            <div class="bar__fill" style="width:${(progress*100).toFixed(1)}%"></div>
          </div>
          <div class="mt-8 muted" style="font-size:12px">
            ${Math.round(progress*100)}% complete. Extra payment routed to
            <strong style="color:var(--text)">${nextFocusCreditor(state)}</strong> this month.
          </div>
        </section>
       </div>

       <div>
        <section class="card">
          <div class="card__title">This month\u2019s spending by category</div>
          ${Charts.barList(categoriesData)}
        </section>

        <section class="card">
          <div class="card__title">Upcoming in next 7 days</div>
          ${upcoming.length === 0
            ? `<div class="muted center" style="padding:18px 0;font-size:13px">Nothing due. Clear week.</div>`
            : upcoming.slice(0, 8).map(b => `
              <div class="card__row">
                <div>
                  <div style="font-weight:500">${escapeHTML(b.name)}</div>
                  <div class="muted" style="font-size:12px">${relDate(b.dueDate)} \u00b7 ${Calc.fmtDate(b.dueDate, {weekday:true})}</div>
                </div>
                <div class="num">${Calc.money(b.amount)}</div>
              </div>`).join('')
          }
        </section>

        ${ins ? `
        <section class="insight mt-16">
          <div class="insight__kicker">${escapeHTML(ins.kicker)}</div>
          <div class="insight__title">${escapeHTML(ins.title)}</div>
          <div class="insight__body">${escapeHTML(ins.body)}</div>
        </section>` : ''}
       </div>
      </div>
    `;
  }

  function nextFocusCreditor(state) {
    const strat = state.profile?.payoffStrategy || 'avalanche';
    const active = (state.debts||[]).filter(d => !d.paidOff);
    if (!active.length) return '—';
    const focus = strat === 'snowball'
      ? active.slice().sort((a,b)=>a.balance-b.balance)[0]
      : active.slice().sort((a,b)=>b.apr-a.apr)[0];
    return focus.creditor;
  }

  // ===================================================================
  // TRANSACTIONS
  // ===================================================================
  function Transactions(state, ctx={}) {
    const filter = ctx.filter || 'all';     // all | expense | income | business
    const range = ctx.range || 'month';     // day | week | month
    const search = (ctx.search || '').toLowerCase();
    const now = new Date();

    let txns = state.txns.slice().sort((a,b)=> new Date(b.date) - new Date(a.date));
    txns = txns.filter(t => {
      if (filter === 'expense' && t.type !== 'expense') return false;
      if (filter === 'income'  && t.type !== 'income') return false;
      if (filter === 'business' && !t.business) return false;
      if (range === 'day' && !Calc.inLastNDays(t.date, 1, now)) return false;
      if (range === 'week' && !Calc.inLastNDays(t.date, 7, now)) return false;
      if (range === 'month' && !Calc.inMonth(t.date, now)) return false;
      if (search) {
        const hay = [t.merchant, t.notes, t.category].join(' ').toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });

    const total = txns.reduce((s,t)=> s + (t.type==='expense' ? +t.amount : -+t.amount), 0);

    // group by day
    const groups = {};
    txns.forEach(t => { (groups[t.date] = groups[t.date]||[]).push(t); });
    const keys = Object.keys(groups).sort((a,b)=> b.localeCompare(a));

    return `
      <h2 class="view__title">Activity</h2>

      <div class="search" data-component="search">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
        <input type="search" placeholder="Search merchant, note, category" id="txn-search" value="${(ctx.search||'').replace(/"/g,'&quot;')}"/>
      </div>

      <div class="row-spaced mt-12 flex-wrap gap-8">
        <div class="segment" role="tablist" data-segment="range">
          ${['day','week','month'].map(r => `<button class="segment__btn" data-val="${r}" aria-pressed="${r===range}">${r[0].toUpperCase()+r.slice(1)}</button>`).join('')}
        </div>
        <div class="segment" role="tablist" data-segment="filter">
          ${[['all','All'],['expense','Out'],['income','In'],['business','Biz']].map(([v,l]) => `<button class="segment__btn" data-val="${v}" aria-pressed="${v===filter}">${l}</button>`).join('')}
        </div>
      </div>

      <div class="row-spaced mt-12 mb-12">
        <div class="muted" style="font-size:12px;letter-spacing:0.04em;text-transform:uppercase;">${txns.length} entr${txns.length===1?'y':'ies'}</div>
        <div class="num ${total<0?'':'danger'}" style="font-weight:600">
          ${total >= 0 ? '−'+Calc.money(total) : '+'+Calc.money(-total)}
        </div>
      </div>

      ${keys.length === 0 ? `<div class="card center muted" style="padding:30px">No transactions match.</div>` : ''}

      ${keys.map(date => `
        <div class="muted" style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;margin:14px 4px 6px;">${Calc.fmtDate(date,{weekday:true})}</div>
        <div class="list">
          ${groups[date].map(t => `
            <div class="row" data-action="edit-txn" data-id="${t.id}">
              <div class="row__icon">${catIcon(t.category)}</div>
              <div class="row__main">
                <div class="row__title">${escapeHTML(t.merchant || catLabel(t.category))}
                  ${t.business ? '<span class="chip chip--accent" style="margin-left:6px">biz</span>' : ''}
                  ${t.recurring ? '<span class="chip" style="margin-left:6px">recur</span>' : ''}
                </div>
                <div class="row__sub">${catLabel(t.category)}${t.notes ? ' · '+escapeHTML(t.notes):''}</div>
              </div>
              <div class="row__amount ${t.type==='income'?'income':'expense'}">
                ${t.type==='income' ? '+' : '−'}${Calc.money(t.amount)}
              </div>
            </div>
          `).join('')}
        </div>
      `).join('')}

      <div class="row-spaced mt-24 mb-12">
        <button class="btn btn--sm" data-action="export-csv" data-which="txns">Export CSV</button>
        <button class="btn btn--sm" data-action="add-txn">+ Add transaction</button>
      </div>
    `;
  }

  // ===================================================================
  // BUDGET
  // ===================================================================
  function Budget(state) {
    const status = Calc.budgetStatus(state);
    const top = status.filter(b=>b.over).slice(0,3);
    const totalPlanned = Object.values(state.budgets).reduce((s,v)=>s+ +v,0);
    const totalUsed = status.reduce((s,b)=>s+b.used,0);
    const remaining = totalPlanned - totalUsed;
    const now = new Date();
    const daysLeft = Calc.daysInMonth(now) - now.getDate() + 1;

    return `
      <h2 class="view__title">Budget</h2>
      <div class="view__lede">${now.toLocaleString('en-US',{month:'long'})} · ${daysLeft} day${daysLeft===1?'':'s'} left</div>

      <section class="hero">
        <div class="hero__label">Remaining this month</div>
        <div class="hero__amount ${remaining<0?'danger':''} num">${Calc.money(remaining)}</div>
        <div class="hero__sub">${Calc.money(totalUsed)} spent of ${Calc.money(totalPlanned)} planned</div>
        <div class="bar mt-12" style="height:10px">
          <div class="bar__fill ${totalUsed>totalPlanned?'danger':''}" style="width:${Math.min(100, totalPlanned ? (totalUsed/totalPlanned)*100 : 0)}%"></div>
        </div>
      </section>

      ${top.length ? `
      <section class="card mt-16">
        <div class="card__title">Top overspending</div>
        ${top.map(b => `
          <div class="card__row">
            <div>
              <div style="font-weight:500">${catLabel(b.category)}</div>
              <div class="muted" style="font-size:12px">${Calc.money(b.used)} / ${Calc.money(b.planned)}</div>
            </div>
            <span class="chip chip--danger">+${Calc.money(b.used - b.planned)} over</span>
          </div>
        `).join('')}
      </section>` : ''}

      <section class="card mt-16">
        <div class="card__title">Categories</div>
        ${status.map(b => {
          const pct = b.planned ? Math.min(100, (b.used / b.planned) * 100) : 0;
          const pacing = b.paceDelta > 0;
          const cls = b.over ? 'danger' : (pacing && pct > 50 ? 'warn' : '');
          return `
          <div class="card__row" style="flex-direction:column;align-items:stretch;gap:8px">
            <div class="row-spaced">
              <div style="font-weight:500;display:flex;align-items:center;gap:8px">
                <span class="icon-circle" style="width:24px;height:24px">${catIcon(b.category)}</span>
                ${catLabel(b.category)}
              </div>
              <div class="row-spaced gap-8">
                <span class="num soft" style="font-size:13px">${Calc.money(b.used)} / ${Calc.money(b.planned)}</span>
                <button class="btn btn--sm btn--ghost" data-action="edit-budget" data-cat="${b.category}">Edit</button>
              </div>
            </div>
            <div class="bar"><div class="bar__fill ${cls}" style="width:${pct}%"></div></div>
            ${b.over
              ? `<div class="muted" style="font-size:12px;color:var(--danger)">Over by ${Calc.money(b.used - b.planned)}</div>`
              : pacing
                ? `<div class="muted" style="font-size:12px;color:var(--warn)">Pacing ${Calc.money(b.paceDelta)} ahead — slow down through ${Calc.fmtDate(new Date(now.getFullYear(), now.getMonth()+1, 0))}.</div>`
                : ''
            }
          </div>`;
        }).join('')}
        <button class="btn btn--ghost btn--full mt-12" data-action="edit-budget" data-cat="__new">+ Add category budget</button>
      </section>

      <section class="card mt-16">
        <div class="card__title">Modes</div>
        <div class="card__row">
          <div>
            <div style="font-weight:500">Zero-based budgeting</div>
            <div class="muted" style="font-size:12px">Assign every dollar a job each month.</div>
          </div>
          <div class="switch" role="switch" data-action="toggle-zerobased" aria-checked="${state.settings.zeroBased ? 'true':'false'}"></div>
        </div>
        <div class="card__row">
          <div>
            <div style="font-weight:500">Roll over leftovers</div>
            <div class="muted" style="font-size:12px">Carry unused budget into next month for selected categories.</div>
          </div>
          <div class="switch" role="switch" data-action="toggle-rollover" aria-checked="${state.settings.rollover ? 'true':'false'}"></div>
        </div>
      </section>
    `;
  }

  // ===================================================================
  // BILLS — calendar + list + paid toggle
  // ===================================================================
  function Bills(state, ctx={}) {
    const mode = ctx.mode || 'list';
    const now = new Date();
    const monthBills = Calc.billsThisMonth(state, now);
    const debtsAsBills = (state.debts||[]).filter(d=>!d.paidOff).map(d => ({
      id: 'debt-'+d.id, name: d.creditor + ' (min)', amount: d.minPayment, dueDay: d.dueDay,
      kind: 'debt', category: 'debt', dueDate: new Date(now.getFullYear(), now.getMonth(), d.dueDay)
    }));
    const all = [...monthBills, ...debtsAsBills].sort((a,b) => a.dueDate - b.dueDate);

    const paidIds = new Set(state.txns
      .filter(t => Calc.inMonth(t.date, now) && t.type==='expense' &&
        (state.bills||[]).some(b => b.name.toLowerCase() === (t.merchant||'').toLowerCase()))
      .map(t => (state.bills||[]).find(b => b.name.toLowerCase()===(t.merchant||'').toLowerCase()).id));

    const paydays = paydaysThisMonth(state);

    const projection = projectedBalanceLine(state);

    return `
      <h2 class="view__title">Bills</h2>
      <div class="row-spaced mb-12">
        <div class="segment" data-segment="bill-mode">
          ${[['list','List'],['cal','Calendar']].map(([v,l]) =>
            `<button class="segment__btn" data-val="${v}" aria-pressed="${v===mode}">${l}</button>`
          ).join('')}
        </div>
        <button class="btn btn--sm" data-action="add-bill">+ Add bill</button>
      </div>

      ${mode === 'cal' ? renderCalendar(state, now) : ''}

      <section class="card ${mode==='cal' ? 'mt-16' : ''}">
        <div class="card__title">Due this month</div>
        ${all.map(b => {
          const past = b.dueDate < new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const isDebt = b.kind === 'debt';
          const paid = paidIds.has(b.id);
          return `
          <div class="card__row">
            <div style="flex:1;min-width:0">
              <div style="font-weight:500;display:flex;align-items:center;gap:8px">
                ${escapeHTML(b.name)}
                ${isDebt ? '<span class="chip">debt</span>' : ''}
                ${paid ? '<span class="chip chip--ok">paid</span>' : (past ? '<span class="chip chip--warn">past</span>' : '')}
              </div>
              <div class="muted" style="font-size:12px">${Calc.fmtDate(b.dueDate,{weekday:true})}</div>
            </div>
            <div class="num">${Calc.money(b.amount)}</div>
            ${!isDebt ? `<button class="btn btn--sm btn--ghost" data-action="${paid?'unpay-bill':'pay-bill'}" data-id="${b.id}">${paid?'Undo':'Mark paid'}</button>` : ''}
          </div>`;
        }).join('')}
        ${all.length === 0 ? `<div class="muted center" style="padding:18px 0">No bills yet.</div>` : ''}
      </section>

      ${paydays.length ? `
      <section class="card mt-16">
        <div class="card__title">Paydays this month</div>
        ${paydays.map(d => `<div class="card__row"><div>Direct deposit</div><div class="num">${Calc.fmtDate(d,{weekday:true})}</div></div>`).join('')}
      </section>` : ''}

      <section class="card mt-16">
        <div class="card__title">Projected balance through next 14 days</div>
        ${Charts.lineChart(projection.series, {
          height: 180,
          xLabels: projection.labels,
          fmt: v => '$' + Math.round(v).toLocaleString()
        })}
        <div class="muted mt-8" style="font-size:12px">Starts at ${Calc.money(projection.start)}. Ends at ${Calc.money(projection.end)}. Includes bills and expected paychecks.</div>
      </section>

      <section class="card mt-16">
        <div class="card__title">Reminders</div>
        <div class="card__row">
          <div><div style="font-weight:500">Reminder badge on bill day</div>
          <div class="muted" style="font-size:12px">Shows a chip on the dashboard the morning of due dates.</div></div>
          <div class="switch" role="switch" data-action="toggle-reminders" aria-checked="${state.settings.reminders !== false ? 'true':'false'}"></div>
        </div>
      </section>

      <button class="btn btn--full btn--ghost mt-12" data-action="export-csv" data-which="bills">Export bills CSV</button>
    `;
  }

  function projectedBalanceLine(state, days=14) {
    const start = Calc.currentCash(state);
    const series = [];
    const labels = [];
    let cash = start;
    const now = new Date(); now.setHours(0,0,0,0);
    for (let i = 0; i <= days; i++) {
      const d = new Date(now); d.setDate(d.getDate() + i);
      // bills due today?
      (state.bills||[]).forEach(b => {
        if (b.dueDay === d.getDate()) cash -= +b.amount;
      });
      (state.debts||[]).filter(x=>!x.paidOff).forEach(x => {
        if (x.dueDay === d.getDate()) cash -= +x.minPayment;
      });
      // paydays?
      if (state.profile?.payNextDate) {
        const pd = new Date(state.profile.payNextDate);
        if (d.getTime() === pd.getTime()) {
          cash += (state.profile.payFrequency === 'weekly' ? state.profile.monthlyIncome/4
                : state.profile.payFrequency === 'biweekly' ? state.profile.monthlyIncome/2
                : state.profile.monthlyIncome);
        }
      }
      series.push({ x: i, y: cash });
      labels.push((d.getMonth()+1)+'/'+d.getDate());
    }
    return { series, labels, start, end: cash };
  }

  function paydaysThisMonth(state) {
    const result = [];
    if (!state.profile?.payNextDate) return result;
    const start = new Date(state.profile.payNextDate);
    const stride = state.profile.payFrequency === 'weekly' ? 7
                  : state.profile.payFrequency === 'biweekly' ? 14 : 30;
    const monthEnd = new Date(start.getFullYear(), start.getMonth()+1, 0);
    let d = new Date(start);
    while (d <= monthEnd) {
      if (d.getMonth() === new Date().getMonth() && d >= new Date(d.getFullYear(), d.getMonth(), 1)) {
        result.push(new Date(d));
      }
      d.setDate(d.getDate() + stride);
    }
    return result;
  }

  function renderCalendar(state, ref) {
    const Y = ref.getFullYear(), M = ref.getMonth();
    const firstDow = new Date(Y, M, 1).getDay();
    const dim = Calc.daysInMonth(ref);
    const billsByDay = {};
    (state.bills||[]).forEach(b => (billsByDay[b.dueDay] = (billsByDay[b.dueDay]||[])).push({...b,kind:'bill'}));
    (state.debts||[]).filter(d=>!d.paidOff).forEach(d => (billsByDay[d.dueDay] = (billsByDay[d.dueDay]||[])).push({creditor:d.creditor, amount:d.minPayment, kind:'debt'}));
    const paydays = paydaysThisMonth(state).map(d => d.getDate());

    const today = ref.getDate();
    const cells = [];
    for (let i=0; i<firstDow; i++) cells.push(`<div class="cal__cell cal__cell--blank"></div>`);
    for (let d=1; d<=dim; d++) {
      const has = billsByDay[d];
      const isToday = d === today;
      const isPay = paydays.includes(d);
      const hasDebt = has && has.some(x=>x.kind==='debt');
      const hasBill = has && has.some(x=>x.kind==='bill');
      cells.push(`<div class="cal__cell ${isToday?'cal__cell--today':''} ${has?'cal__cell--has':''}">
        <div>${d}</div>
        <div class="flex gap-6">
          ${hasBill?'<span class="cal__cell__dot cal__cell__dot--bill" title="Bill"></span>':''}
          ${hasDebt?'<span class="cal__cell__dot cal__cell__dot--debt" title="Min payment"></span>':''}
          ${isPay?'<span class="cal__cell__dot cal__cell__dot--pay" title="Payday"></span>':''}
        </div>
      </div>`);
    }
    return `
      <section class="card">
        <div class="card__title">${ref.toLocaleString('en-US',{month:'long', year:'numeric'})}</div>
        <div class="cal">
          ${['S','M','T','W','T','F','S'].map(x=>`<div class="cal__dow">${x}</div>`).join('')}
          ${cells.join('')}
        </div>
        <div class="cal__legend">
          <span><i style="background:var(--warn)"></i>Bill</span>
          <span><i style="background:var(--danger)"></i>Min payment</span>
          <span><i style="background:var(--ok)"></i>Payday</span>
        </div>
      </section>
    `;
  }

  // ===================================================================
  // DEBT PLAN
  // ===================================================================
  function Debt(state) {
    const strat = state.profile?.payoffStrategy || 'avalanche';
    const extra = +state.profile?.extraDebtPayment || 0;

    const active = (state.debts||[]).filter(d=>!d.paidOff);
    const paid = (state.debts||[]).filter(d=>d.paidOff);
    const sim = Calc.simulatePayoff(state.debts, strat, extra);
    const simMin = Calc.simulatePayoff(state.debts, strat, 0);
    const interestSaved = Math.max(0, simMin.totalInterest - sim.totalInterest);
    const rec = Calc.recommendedStrategy(state.debts);

    const focus = strat === 'snowball'
      ? active.slice().sort((a,b)=>a.balance-b.balance)[0]
      : active.slice().sort((a,b)=>b.apr-a.apr)[0];

    return `
      <h2 class="view__title">Debt Plan</h2>
      <div class="view__lede">${Calc.money(Calc.totalDebtBalance(state.debts))} across ${active.length} balance${active.length===1?'':'s'}. Extra payment: ${Calc.money(extra)}.</div>

      <section class="hero">
        <div class="hero__label">Estimated debt-free date</div>
        <div class="hero__amount num">${sim.debtFreeDate ? Calc.fmtDate(sim.debtFreeDate,{long:true,year:true}) : 'Add a debt'}</div>
        <div class="hero__sub">${sim.months} months · ${Calc.money(sim.totalInterest)} total interest projected</div>
        <div class="hero__row">
          <div><div class="hero__stat__lbl">Saved vs minimum-only</div><div class="hero__stat__val num">${Calc.money(interestSaved)}</div></div>
          <div><div class="hero__stat__lbl">Strategy</div><div class="hero__stat__val" style="text-transform:capitalize">${strat}</div></div>
        </div>
      </section>

      <section class="card mt-16">
        <div class="card__title">Strategy</div>
        <div class="row-spaced">
          <div class="segment" data-segment="strategy">
            <button class="segment__btn" data-val="avalanche" aria-pressed="${strat==='avalanche'}">Avalanche</button>
            <button class="segment__btn" data-val="snowball"  aria-pressed="${strat==='snowball'}">Snowball</button>
          </div>
          <button class="btn btn--sm" data-action="open-simulator">Simulate</button>
        </div>
        <div class="muted mt-12" style="font-size:13px">
          <strong style="color:var(--text)">Recommended: ${rec.strategy}.</strong> ${rec.reason}
        </div>
      </section>

      ${focus ? `
      <section class="card mt-16">
        <div class="card__title">Next dollar goes here</div>
        <div class="row-spaced">
          <div>
            <div style="font-weight:600;font-size:18px;letter-spacing:-0.01em">${escapeHTML(focus.creditor)}</div>
            <div class="muted" style="font-size:13px">${focus.apr}% APR · ${Calc.money(focus.balance)} balance</div>
          </div>
          <span class="chip chip--accent">+${Calc.money(extra)}</span>
        </div>
        <div class="bar mt-12"><div class="bar__fill" style="width:${Math.max(2, (1 - focus.balance/(focus.originalBalance||focus.balance))*100).toFixed(1)}%"></div></div>
      </section>` : ''}

      <section class="card mt-16">
        <div class="card__title">Debts</div>
        ${active.map(d => `
          <div class="card__row" data-action="edit-debt" data-id="${d.id}" style="cursor:pointer">
            <div style="flex:1;min-width:0">
              <div style="font-weight:500">${escapeHTML(d.creditor)} <span class="chip" style="margin-left:6px">${prettyDebtType(d.type)}</span></div>
              <div class="muted" style="font-size:12px">${d.apr}% APR · min ${Calc.money(d.minPayment)} · due ${ordinal(d.dueDay)}</div>
            </div>
            <div class="num">${Calc.money(d.balance)}</div>
          </div>
        `).join('')}
        <button class="btn btn--ghost btn--full mt-12" data-action="add-debt">+ Add debt</button>
      </section>

      <section class="card mt-16">
        <div class="card__title">Payoff timeline</div>
        <div class="timeline">
          ${sim.payoffOrder.map(p => {
            if (!p.month) return '';
            const d = new Date(); d.setMonth(d.getMonth() + p.month);
            return `<div class="timeline__item">
              <div class="timeline__date">${Calc.fmtDate(d,{long:true, year:true})}</div>
              <div class="timeline__title">${p.creditor} paid off</div>
              <div class="timeline__sub">Frees up minimum, rolls into next debt.</div>
            </div>`;
          }).join('')}
        </div>
      </section>

      ${paid.length ? `
      <section class="card mt-16">
        <div class="card__title">History (paid off)</div>
        ${paid.map(d => `<div class="card__row"><div>${escapeHTML(d.creditor)}</div><span class="chip chip--ok">paid off</span></div>`).join('')}
      </section>` : ''}

      <button class="btn btn--full btn--ghost mt-12" data-action="export-csv" data-which="debts">Export debts CSV</button>
    `;
  }

  function prettyDebtType(t) {
    return ({
      credit_card: 'credit card',
      personal_loan: 'personal loan',
      car_loan: 'auto',
      student_loan: 'student',
      misc: 'misc',
    })[t] || t;
  }
  function ordinal(n) {
    const s = ['th','st','nd','rd'], v = n % 100;
    return n + (s[(v-20)%10] || s[v] || s[0]);
  }

  // ===================================================================
  // SIMULATOR
  // ===================================================================
  function Simulator(state, ctx={}) {
    const extra = (ctx.extra ?? +state.profile?.extraDebtPayment ?? 0);
    const ava = Calc.simulatePayoff(state.debts, 'avalanche', extra);
    const sno = Calc.simulatePayoff(state.debts, 'snowball', extra);
    const avaMin = Calc.simulatePayoff(state.debts, 'avalanche', 0);
    const snoMin = Calc.simulatePayoff(state.debts, 'snowball', 0);

    const series = [];
    const labels = [];
    let bal = Calc.totalDebtBalance(state.debts);
    ava.schedule.forEach((s,i) => {
      series.push({ x: i, y: s.balance });
      const d = new Date(); d.setMonth(d.getMonth() + i);
      labels.push(d.toLocaleString('en-US',{month:'short'}));
    });

    const fastestFirst = (() => {
      const next = ava.payoffOrder[0];
      if (!next) return null;
      const d = new Date(); d.setMonth(d.getMonth() + next.month);
      return { creditor: next.creditor, date: d };
    })();

    return `
      <h2 class="view__title">Payoff Simulator</h2>

      <section class="card">
        <div class="card__title">Extra monthly payment</div>
        <div class="row-spaced">
          <div class="num" style="font-size:28px;font-weight:600;letter-spacing:-0.01em">${Calc.money(extra)}</div>
          <button class="btn btn--sm" data-action="save-extra">Save to plan</button>
        </div>
        <input type="range" min="0" max="2000" step="25" value="${extra}" id="sim-slider" style="width:100%;margin-top:12px;accent-color:var(--accent)"/>
        <div class="split-3 mt-12">
          ${[100, 250, 500].map(v => `<button class="btn btn--sm" data-action="sim-set" data-val="${v}">+${v}</button>`).join('')}
        </div>
      </section>

      <section class="card mt-16">
        <div class="card__title">Avalanche vs Snowball</div>
        ${Charts.comparisonBars([
          { label: 'Avalanche', value: ava.months, display: ava.months + ' mo', color: 'var(--accent)' },
          { label: 'Snowball',  value: sno.months, display: sno.months + ' mo', color: 'var(--text-mute)' }
        ])}
        <div class="hr"></div>
        ${Charts.comparisonBars([
          { label: 'Interest A', value: ava.totalInterest, display: Calc.money(ava.totalInterest), color: 'var(--accent)' },
          { label: 'Interest S', value: sno.totalInterest, display: Calc.money(sno.totalInterest), color: 'var(--text-mute)' }
        ])}
        <div class="muted mt-12" style="font-size:12px">
          <strong style="color:var(--text)">Fastest first win:</strong> ${fastestFirst ? `${fastestFirst.creditor} by ${Calc.fmtDate(fastestFirst.date)}` : '—'}.<br/>
          <strong style="color:var(--text)">Best long-term savings:</strong> Avalanche keeps ${Calc.money(snoMin.totalInterest - avaMin.totalInterest)} in your pocket vs snowball.
        </div>
      </section>

      <section class="card mt-16">
        <div class="card__title">Debt-free trajectory (avalanche, with +${Calc.money(extra)}/mo)</div>
        ${Charts.lineChart(series, { xLabels: labels, height: 200, fmt: v => '$'+Math.round(v/1000)+'k' })}
        <div class="row-spaced mt-12">
          <div class="muted" style="font-size:12px">Debt-free</div>
          <div class="num">${ava.debtFreeDate ? Calc.fmtDate(ava.debtFreeDate, {long:true, year:true}) : '—'}</div>
        </div>
      </section>

      <section class="insight mt-16">
        <div class="insight__kicker">Interest saved vs minimum-only</div>
        <div class="insight__title">${Calc.money(avaMin.totalInterest - ava.totalInterest)}</div>
        <div class="insight__body">Pulling the extra-payment slider higher accelerates this curve. Every $50/mo extra typically saves another month and a meaningful chunk of interest at your current APRs.</div>
      </section>
    `;
  }

  // ===================================================================
  // INSIGHTS
  // ===================================================================
  function Insights(state) {
    const ins = Calc.insights(state);
    const s2s = Calc.safeToSpend(state);
    const subs = Calc.detectRecurring(state.txns);

    return `
      <h2 class="view__title">Insights</h2>

      <section class="hero">
        <div class="hero__label">Safe to spend</div>
        <div class="hero__amount num">${Calc.money(s2s.weekly)}</div>
        <div class="hero__sub">For this week. Bills and minimums already reserved.</div>
      </section>

      <div class="stack mt-16">
        ${ins.map(i => `
          <div class="insight">
            <div class="insight__kicker">${i.kicker}</div>
            <div class="insight__title">${i.title}</div>
            <div class="insight__body">${i.body}</div>
          </div>
        `).join('')}
      </div>

      <section class="card mt-16">
        <div class="card__title">Recurring charges detected</div>
        ${subs.length === 0 ? `<div class="muted">None detected yet.</div>` :
          subs.map(s => `
            <div class="card__row">
              <div>
                <div style="font-weight:500">${escapeHTML(s.merchant)}</div>
                <div class="muted" style="font-size:12px">~${s.count}× / 90d · last ${Calc.fmtDate(s.lastDate)}</div>
              </div>
              <div class="num">${Calc.money(s.amount)}</div>
            </div>
          `).join('')
        }
      </section>
    `;
  }

  // ===================================================================
  // GOALS
  // ===================================================================
  function Goals(state) {
    return `
      <h2 class="view__title">Goals</h2>
      <div class="view__lede">Sinking funds, debt-free date, and big-ticket savings.</div>

      <section class="card">
        <div class="card__title">Debt-free goal</div>
        <div class="row-spaced">
          <div>
            <div style="font-weight:600;font-size:18px;letter-spacing:-0.01em">${(() => {
              const sim = Calc.simulatePayoff(state.debts, state.profile?.payoffStrategy||'avalanche', +state.profile?.extraDebtPayment||0);
              return sim.debtFreeDate ? Calc.fmtDate(sim.debtFreeDate,{long:true,year:true}) : '—';
            })()}</div>
            <div class="muted" style="font-size:13px">Based on current plan</div>
          </div>
          <span class="chip chip--accent">on track</span>
        </div>
      </section>

      <section class="card mt-16">
        <div class="card__title">Savings goals</div>
        ${state.goals.map(g => {
          const pct = g.target ? Math.min(100, (g.saved / g.target) * 100) : 0;
          return `
            <div class="card__row" style="flex-direction:column;align-items:stretch;gap:8px" data-action="edit-goal" data-id="${g.id}">
              <div class="row-spaced">
                <div>
                  <div style="font-weight:500">${escapeHTML(g.label)}</div>
                  <div class="muted" style="font-size:12px">${Calc.money(g.saved)} / ${Calc.money(g.target)} · ${Calc.money(g.monthly)}/mo</div>
                </div>
                <div class="num">${Math.round(pct)}%</div>
              </div>
              <div class="bar"><div class="bar__fill" style="width:${pct}%"></div></div>
            </div>`;
        }).join('')}
        <button class="btn btn--ghost btn--full mt-12" data-action="add-goal">+ Add goal</button>
      </section>
    `;
  }

  // ===================================================================
  // CREDIT HEALTH
  // ===================================================================
  function Credit(state) {
    const cards = Calc.creditUtilization(state.creditCards || []);
    const total = cards.reduce((s,c)=>s+c.balance,0);
    const limit = cards.reduce((s,c)=>s+c.limit,0);
    const overall = limit > 0 ? total/limit : 0;
    const best = Calc.bestPayoffForUtilization(cards);

    return `
      <h2 class="view__title">Credit Health</h2>
      <div class="view__lede">A manual snapshot — we don\u2019t connect to any credit bureau.</div>

      <section class="hero">
        <div class="hero__label">Overall utilization</div>
        <div class="hero__amount num ${overall>=0.3?'danger':''}">${Math.round(overall*100)}%</div>
        <div class="hero__sub">${Calc.money(total)} balance across ${Calc.money(limit)} in limits. Aim under 30%, ideally under 10%.</div>
        <div class="bar mt-12" style="height:10px">
          <div class="bar__fill ${overall>=0.7?'danger':overall>=0.3?'warn':'ok'}" style="width:${Math.min(100, overall*100)}%"></div>
        </div>
      </section>

      <section class="card mt-16">
        <div class="card__title">By card</div>
        ${cards.map(c => `
          <div class="card__row" style="flex-direction:column;align-items:stretch;gap:8px" data-action="edit-card" data-id="${c.id}">
            <div class="row-spaced">
              <div>
                <div style="font-weight:500">${escapeHTML(c.name)}</div>
                <div class="muted" style="font-size:12px">${Calc.money(c.balance)} / ${Calc.money(c.limit)}</div>
              </div>
              <div>
                <span class="chip chip--${c.status==='danger'?'danger':c.status==='warn'?'warn':'ok'}">${Math.round(c.util*100)}%</span>
              </div>
            </div>
            <div class="bar"><div class="bar__fill ${c.status==='danger'?'danger':c.status==='warn'?'warn':'ok'}" style="width:${Math.min(100,c.util*100)}%"></div></div>
          </div>
        `).join('')}
        <button class="btn btn--ghost btn--full mt-12" data-action="add-card">+ Add card snapshot</button>
      </section>

      ${best ? `
      <section class="insight mt-16">
        <div class="insight__kicker">Biggest utilization impact</div>
        <div class="insight__title">Pay down ${escapeHTML(best.name)} first</div>
        <div class="insight__body">Knocking $100 off this card moves your overall utilization most. Lower utilization typically improves your score within a billing cycle.</div>
      </section>` : ''}

      <section class="card mt-16">
        <div class="card__title">Manual credit score (optional)</div>
        <div class="row-spaced">
          <div>
            <div style="font-weight:500">Last known FICO</div>
            <div class="muted" style="font-size:12px">From your bank app or Credit Karma</div>
          </div>
          <input type="number" inputmode="numeric" class="field__input" style="width:120px" placeholder="—" id="fico" value="${state.creditScore||''}"/>
        </div>
      </section>
    `;
  }

  // ===================================================================
  // WEEKLY REVIEW
  // ===================================================================
  function Review(state) {
    const now = new Date();
    const txnsThisWeek = (state.txns||[]).filter(t => Calc.inLastNDays(t.date,7,now));
    const spent = txnsThisWeek.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
    const earned = txnsThisWeek.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
    const lastWeek = (state.txns||[]).filter(t => {
      const d = new Date(t.date);
      const start = new Date(now); start.setDate(start.getDate()-14);
      const end = new Date(now); end.setDate(end.getDate()-7);
      return d >= start && d < end && t.type==='expense';
    }).reduce((s,t)=>s+t.amount,0);
    const delta = spent - lastWeek;
    const next7 = Calc.upcomingBills(state, 7);

    const streak = (state.checkins||[]).length;
    const action = pickWeeklyAction(state);

    return `
      <h2 class="view__title">Weekly Review</h2>
      <div class="view__lede">7-day snapshot. The week\u2019s biggest move.</div>

      <div class="stat-grid">
        <div class="stat"><div class="stat__lbl">Spent (7d)</div><div class="stat__val num">${Calc.money(spent)}</div></div>
        <div class="stat"><div class="stat__lbl">Earned (7d)</div><div class="stat__val num">${Calc.money(earned)}</div></div>
        <div class="stat"><div class="stat__lbl">vs last week</div><div class="stat__val num ${delta<0?'ok':'danger'}">${delta<0?'−':'+'}${Calc.money(Math.abs(delta))}</div></div>
        <div class="stat"><div class="stat__lbl">Streak</div><div class="stat__val">${streak} wk</div></div>
      </div>

      <section class="insight mt-16">
        <div class="insight__kicker">Recommended action — next 7 days</div>
        <div class="insight__title">${action.title}</div>
        <div class="insight__body">${action.body}</div>
        <button class="btn btn--primary mt-12" data-action="checkin">${streak>0 ? 'Mark this week complete' : 'Start streak'}</button>
      </section>

      <section class="card mt-16">
        <div class="card__title">Bills coming up</div>
        ${next7.length === 0 ? `<div class="muted">Nothing due.</div>` :
          next7.map(b => `<div class="card__row"><div>${escapeHTML(b.name)}<div class="muted" style="font-size:12px">${Calc.fmtDate(b.dueDate,{weekday:true})}</div></div><div class="num">${Calc.money(b.amount)}</div></div>`).join('')
        }
      </section>

      <section class="card mt-16">
        <div class="card__title">Recent check-ins</div>
        ${(state.checkins||[]).slice(-6).reverse().map(c =>
          `<div class="card__row"><div>${Calc.fmtDate(c.date,{long:true})}</div><div class="muted" style="font-size:13px">${escapeHTML(c.action)}</div></div>`
        ).join('') || `<div class="muted center" style="padding:18px 0">No check-ins yet.</div>`}
      </section>
    `;
  }

  function pickWeeklyAction(state) {
    const top = Calc.topOverspending(state, 1)[0];
    if (top && top.over) {
      return {
        title: `Pause ${catLabel(top.category)} until the 1st.`,
        body: `You\u2019re ${Calc.money(top.used - top.planned)} over plan in this category. ` +
              `Holding here through end of month redirects that money to ${nextFocusCreditor(state)}.`
      };
    }
    const s2s = Calc.safeToSpend(state);
    if (s2s.weekly < 0) {
      return {
        title: `Buy nothing day Friday.`,
        body: `Headroom is thin this week. Skipping discretionary on Friday gets you back to even by payday.`
      };
    }
    return {
      title: `Send an extra ${Calc.money(Math.max(25, Math.round(s2s.weekly*0.25)))} to ${nextFocusCreditor(state)} this paycheck.`,
      body: `You have ${Calc.money(s2s.weekly)} of weekly headroom. Round up — small extras compound fast at your APRs.`
    };
  }

  // ===================================================================
  // SETTINGS
  // ===================================================================
  function Settings(state) {
    const fallback = Store.isFallback();
    return `
      <h2 class="view__title">Settings</h2>

      <section class="card">
        <div class="card__title">Profile</div>
        <div class="field"><label class="field__lbl">Monthly take-home income</label>
          <input class="field__input" type="number" id="set-income" value="${state.profile?.monthlyIncome||0}"/></div>
        <div class="field"><label class="field__lbl">Pay frequency</label>
          <select id="set-payfreq">
            <option value="weekly"   ${state.profile?.payFrequency==='weekly'?'selected':''}>Weekly</option>
            <option value="biweekly" ${state.profile?.payFrequency==='biweekly'?'selected':''}>Biweekly</option>
            <option value="monthly"  ${state.profile?.payFrequency==='monthly'?'selected':''}>Monthly</option>
          </select>
        </div>
        <div class="field"><label class="field__lbl">Next pay date</label>
          <input class="field__input" type="date" id="set-nextpay" value="${state.profile?.payNextDate||''}"/></div>
        <div class="field"><label class="field__lbl">Cash on hand snapshot</label>
          <input class="field__input" type="number" id="set-cash" value="${state.profile?.startCash||0}"/></div>
        <div class="field"><label class="field__lbl">Extra debt payment / month</label>
          <input class="field__input" type="number" id="set-extra" value="${state.profile?.extraDebtPayment||0}"/></div>
        <div class="field"><label class="field__lbl">Default payoff strategy</label>
          <select id="set-strategy">
            <option value="avalanche" ${state.profile?.payoffStrategy==='avalanche'?'selected':''}>Avalanche (least interest)</option>
            <option value="snowball"  ${state.profile?.payoffStrategy==='snowball'?'selected':''}>Snowball (quick wins)</option>
          </select>
        </div>
        <button class="btn btn--primary btn--full" data-action="save-profile">Save profile</button>
      </section>

      <section class="card mt-16">
        <div class="card__title">Behavior</div>
        <div class="card__row">
          <div>
            <div style="font-weight:500">Friction before discretionary purchases</div>
            <div class="muted" style="font-size:12px">Prompts when category is over budget.</div>
          </div>
          <div class="switch" role="switch" data-action="toggle-friction" aria-checked="${state.settings.friction !== false ? 'true':'false'}"></div>
        </div>
        <div class="card__row">
          <div>
            <div style="font-weight:500">24-hour wishlist pause</div>
            <div class="muted" style="font-size:12px">Defer non-essential purchases for a day.</div>
          </div>
          <div class="switch" role="switch" data-action="toggle-wishlist" aria-checked="${state.settings.wishlistPause !== false ? 'true':'false'}"></div>
        </div>
        <div class="card__row">
          <div>
            <div style="font-weight:500">Theme</div>
            <div class="muted" style="font-size:12px">Dark by default.</div>
          </div>
          <div class="segment" data-segment="theme">
            <button class="segment__btn" data-val="dark"  aria-pressed="${(state.settings.theme||'dark')==='dark'}">Dark</button>
            <button class="segment__btn" data-val="light" aria-pressed="${state.settings.theme==='light'}">Light</button>
          </div>
        </div>
      </section>

      <section class="card mt-16">
        <div class="card__title">Install on iPhone</div>
        <ol class="muted" style="padding-left:18px;font-size:14px;line-height:1.7">
          <li>Open this URL in <strong style="color:var(--text)">Safari</strong> on iOS (Chrome won\u2019t work for install).</li>
          <li>Tap the <strong style="color:var(--text)">Share</strong> button.</li>
          <li>Scroll and tap <strong style="color:var(--text)">Add to Home Screen</strong>.</li>
          <li>Confirm. Debt Crusher will launch full-screen without browser chrome.</li>
        </ol>
      </section>

      <section class="card mt-16">
        <div class="card__title">Data</div>
        ${fallback ? `<div class="chip chip--warn mb-12">Storage unavailable — running in memory only this session.</div>` : ''}
        <div class="split-2">
          <button class="btn btn--sm" data-action="export-csv" data-which="txns">Export txns CSV</button>
          <button class="btn btn--sm" data-action="export-csv" data-which="bills">Export bills CSV</button>
          <button class="btn btn--sm" data-action="export-csv" data-which="debts">Export debts CSV</button>
          <button class="btn btn--sm" data-action="export-json">Export JSON</button>
        </div>
        <button class="btn btn--danger btn--full mt-12" data-action="reset">Reset all data</button>
      </section>
    `;
  }

  // ===================================================================
  // ONBOARDING (rendered in #onboarding-root, not main view)
  // ===================================================================
  function Onboarding(state, step = 0) {
    const steps = onboardingSteps();
    const s = steps[step];
    const total = steps.length;
    const progress = ((step+1)/total) * 100;
    return `
      <div class="onb__progress"><i style="width:${progress}%"></i></div>
      <div class="onb">
        <div class="onb__step">Step ${step+1} of ${total}</div>
        <h1 class="onb__title">${s.title}</h1>
        <p class="onb__lede">${s.lede}</p>
        ${s.body(state)}
      </div>
      <div class="onb__nav">
        ${step>0 ? `<button class="btn" data-action="onb-back">Back</button>` : `<button class="btn" data-action="onb-skip">Use demo data</button>`}
        <button class="btn btn--primary" data-action="onb-next">${step===total-1 ? 'Done' : 'Continue'}</button>
      </div>
    `;
  }

  function onboardingSteps() {
    return [
      {
        title: 'A serious tool for crushing debt.',
        lede: 'Manual-entry first. Your data stays on this device. We won\u2019t connect to your bank — that\u2019s on purpose.',
        body: () => `
          <div class="card">
            <div class="card__title">What you\u2019ll get</div>
            <div class="stack-tight" style="font-size:14px;color:var(--text-soft)">
              <div>Real budget that updates with every entry.</div>
              <div>A payoff plan with a specific debt-free date.</div>
              <div>Insights that flag overspending patterns.</div>
              <div>A weekly review that holds you accountable.</div>
            </div>
          </div>`
      },
      {
        title: 'Income',
        lede: 'How much do you take home each month, after taxes?',
        body: (st) => `
          <div class="field"><label class="field__lbl">Monthly take-home</label>
            <input class="field__input" type="number" inputmode="numeric" id="o-income" value="${st.profile?.monthlyIncome||''}" placeholder="e.g. 5800"/></div>
          <div class="field"><label class="field__lbl">Pay frequency</label>
            <select id="o-payfreq">
              <option value="weekly">Weekly</option>
              <option value="biweekly" selected>Biweekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div class="field"><label class="field__lbl">Next pay date</label>
            <input class="field__input" type="date" id="o-nextpay" value="${st.profile?.payNextDate||''}"/></div>
        `
      },
      {
        title: 'Cash on hand',
        lede: 'How much do you have in checking / cash right now?',
        body: (st) => `
          <div class="field"><label class="field__lbl">Current available cash</label>
            <input class="field__input" type="number" inputmode="numeric" id="o-cash" value="${st.profile?.startCash||''}" placeholder="e.g. 1240"/></div>
          <div class="field__hint">This is your starting balance. Every transaction you log will adjust it.</div>
        `
      },
      {
        title: 'Debts',
        lede: 'Add as many as you have. You can edit later.',
        body: () => `
          <div id="onb-debts"></div>
          <button class="btn btn--ghost btn--full" data-action="onb-add-debt">+ Add a debt</button>
          <div class="field__hint mt-12">Skip if you have none. We\u2019ll seed demo debts so you can see the app at work.</div>
        `
      },
      {
        title: 'Extra debt payment',
        lede: 'How much extra can you throw at debt each month, above minimums?',
        body: (st) => `
          <div class="field"><label class="field__lbl">Extra / month</label>
            <input class="field__input" type="number" inputmode="numeric" id="o-extra" value="${st.profile?.extraDebtPayment||''}" placeholder="e.g. 250"/></div>
          <div class="field__hint">Even $50 makes a real dent. We\u2019ll route it to the debt with the highest impact.</div>
        `
      },
      {
        title: 'Strategy',
        lede: 'Avalanche kills the most interest. Snowball kills the smallest balance first for momentum. Either works.',
        body: () => `
          <div class="field"><label class="field__lbl">Payoff approach</label>
            <select id="o-strategy">
              <option value="avalanche" selected>Avalanche — least interest</option>
              <option value="snowball">Snowball — quick wins</option>
            </select>
          </div>
          <div class="field"><label class="field__lbl">Style</label>
            <select id="o-flex">
              <option value="aggressive">Aggressive — cut hard, payoff fast</option>
              <option value="flexible">Flexible — gentler pace, room to live</option>
            </select>
          </div>
        `
      },
      {
        title: 'Ready.',
        lede: 'We\u2019ll seed sample bills, budgets, and a few demo transactions so the dashboard looks real. Replace them as you go.',
        body: () => `
          <div class="insight">
            <div class="insight__kicker">Reminder</div>
            <div class="insight__title">Manual entry is the feature, not the bug.</div>
            <div class="insight__body">When you have to type a number, you actually feel the spend. That\u2019s how habits change.</div>
          </div>
        `
      },
    ];
  }

  // ===================================================================
  // helpers
  // ===================================================================
  function escapeHTML(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }

  return {
    Dashboard, Transactions, Budget, Bills, Debt, Simulator, Insights, Goals, Credit, Review, Settings,
    Onboarding, onboardingSteps,
    nextFocusCreditor,
    escapeHTML, ICONS, catIcon, catLabel,
  };
})();
window.Screens = Screens;
