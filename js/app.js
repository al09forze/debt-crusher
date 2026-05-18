/* Debt Crusher — application controller */
(function () {
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));

  // ---- bootstrap state ---------------------------------------------------
  let state = Store.load();
  let route = 'dashboard';
  let routeCtx = {};         // per-screen context (filters, etc.)
  let onbStep = 0;
  let onbDraftDebts = [];

  function persist() { Store.save(state); }

  // Apply theme on boot
  function applyTheme() {
    document.documentElement.dataset.theme = state.settings?.theme || 'dark';
    document.querySelector('meta[name=theme-color]').setAttribute('content',
      (state.settings?.theme === 'light') ? '#F6F6F4' : '#0E0F11');
  }

  // ---- router ------------------------------------------------------------
  function setRoute(r, ctx={}) {
    route = r; routeCtx = ctx;
    render();
  }

  function render() {
    if (!state.profile) {
      $('#app').hidden = true;
      $('#onboarding-root').innerHTML = Screens.Onboarding(state, onbStep);
      renderOnboardingDebts();
      return;
    }
    $('#onboarding-root').innerHTML = '';
    $('#app').hidden = false;

    // appbar
    const now = new Date();
    $('#appbar-sub').textContent = now.toLocaleDateString('en-US',{weekday:'short', month:'short', day:'numeric'});
    $('#appbar-title').textContent = titleFor(route);

    // active tab
    $$('.tabbar__btn').forEach(b => b.setAttribute('aria-current', b.dataset.route === route ? 'page':'false'));

    // body
    const view = $('#view');
    const map = {
      dashboard:    () => Screens.Dashboard(state),
      transactions: () => Screens.Transactions(state, routeCtx),
      budget:       () => Screens.Budget(state),
      bills:        () => Screens.Bills(state, routeCtx),
      debt:         () => Screens.Debt(state),
      simulator:    () => Screens.Simulator(state, routeCtx),
      insights:     () => Screens.Insights(state),
      goals:        () => Screens.Goals(state),
      credit:       () => Screens.Credit(state),
      review:       () => Screens.Review(state),
      settings:     () => Screens.Settings(state),
    };
    view.innerHTML = (map[route] || map.dashboard)();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function titleFor(r) {
    return {
      dashboard:'Dashboard', transactions:'Activity', budget:'Budget',
      bills:'Bills', debt:'Debt Plan', simulator:'Simulator',
      insights:'Insights', goals:'Goals', credit:'Credit Health',
      review:'Weekly Review', settings:'Settings',
    }[r] || 'Debt Crusher';
  }

  // ---- sheet / modal -----------------------------------------------------
  function openSheet(html) {
    $('#sheet-inner').innerHTML = html;
    $('#sheet').setAttribute('aria-hidden','false');
  }
  function closeSheet() {
    $('#sheet').setAttribute('aria-hidden','true');
  }
  $('#sheet').addEventListener('click', e => { if (e.target === $('#sheet')) closeSheet(); });

  function openDrawer() { $('#drawer').setAttribute('aria-hidden','false'); }
  function closeDrawer(){ $('#drawer').setAttribute('aria-hidden','true'); }
  $('#drawer').addEventListener('click', e => { if (e.target === $('#drawer')) closeDrawer(); });

  // ---- toast -------------------------------------------------------------
  let toastTimer = null;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  // ---- transaction sheet -------------------------------------------------
  function openTxnSheet(editId=null) {
    const editing = editId ? state.txns.find(t => t.id===editId) : null;
    const t = editing || {
      id: null,
      date: new Date().toISOString().slice(0,10),
      amount: '',
      category: 'food',
      merchant: '',
      type: 'expense',
      notes: '',
      recurring: false,
      business: false,
    };
    const catOpts = (state.categories||[]).map(c =>
      `<option value="${c.id}" ${c.id===t.category?'selected':''}>${c.label}</option>`).join('');
    openSheet(`
      <div class="sheet__hdr">
        <div class="sheet__title">${editing ? 'Edit transaction' : 'Add transaction'}</div>
        <button class="btn btn--sm btn--ghost" data-action="close-sheet">Cancel</button>
      </div>

      <div class="segment mb-12" data-segment="txn-type">
        <button class="segment__btn" data-val="expense" aria-pressed="${t.type==='expense'}">Expense</button>
        <button class="segment__btn" data-val="income"  aria-pressed="${t.type==='income'}">Income</button>
      </div>

      <div class="field"><label class="field__lbl">Amount</label>
        <input class="field__input num" type="number" inputmode="decimal" step="0.01" id="t-amount" value="${t.amount}" placeholder="0.00" autofocus/></div>

      <div class="field--row">
        <div class="field"><label class="field__lbl">Merchant</label>
          <input class="field__input" id="t-merchant" value="${(t.merchant||'').replace(/"/g,'&quot;')}" placeholder="Where"/></div>
        <div class="field"><label class="field__lbl">Date</label>
          <input class="field__input" type="date" id="t-date" value="${t.date}"/></div>
      </div>

      <div class="field"><label class="field__lbl">Category</label>
        <select id="t-category">${catOpts}</select></div>

      <div class="field"><label class="field__lbl">Notes</label>
        <textarea id="t-notes" rows="2">${(t.notes||'').replace(/</g,'&lt;')}</textarea></div>

      <div class="card__row" style="border:0;padding:6px 0">
        <div>Recurring</div>
        <div class="switch" role="switch" data-action="toggle-t-recur" aria-checked="${t.recurring?'true':'false'}"></div>
      </div>
      <div class="card__row" style="border:0;padding:6px 0">
        <div>Business expense</div>
        <div class="switch" role="switch" data-action="toggle-t-biz" aria-checked="${t.business?'true':'false'}"></div>
      </div>

      <button class="btn btn--ghost btn--full" data-action="add-split" id="add-split-btn">+ Add split</button>
      <div id="splits"></div>

      <div class="split-2 mt-16">
        ${editing ? `<button class="btn btn--danger" data-action="del-txn" data-id="${editing.id}">Delete</button>` : `<button class="btn" data-action="close-sheet">Cancel</button>`}
        <button class="btn btn--primary" data-action="save-txn" data-id="${editing?editing.id:''}">Save</button>
      </div>
    `);

    // wire local state
    $('#sheet-inner').dataset.recurring = t.recurring ? '1':'';
    $('#sheet-inner').dataset.business  = t.business  ? '1':'';
    $('#sheet-inner').dataset.type      = t.type;
    renderSplits(t.split || []);
  }

  function renderSplits(splits) {
    const root = $('#splits'); if (!root) return;
    root.innerHTML = splits.map((s,i) => `
      <div class="split-2" style="margin-top:8px">
        <select data-split-cat="${i}">
          ${(state.categories||[]).map(c => `<option value="${c.id}" ${c.id===s.category?'selected':''}>${c.label}</option>`).join('')}
        </select>
        <input class="field__input" type="number" step="0.01" data-split-amt="${i}" value="${s.amount||''}" placeholder="0.00"/>
      </div>
    `).join('');
    root.dataset.json = JSON.stringify(splits);
  }

  // ---- friction (over-budget warning) ------------------------------------
  function maybeFriction(category, amount) {
    if (state.settings?.friction === false) return Promise.resolve(true);
    const planned = +state.budgets[category] || 0;
    const used = (Calc.spendingByCategory(state.txns)[category] || 0) + amount;
    if (planned === 0 || used <= planned) return Promise.resolve(true);
    return new Promise(resolve => {
      openSheet(`
        <div class="friction">
          <div class="friction__icon">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.73 3h16.9a2 2 0 0 0 1.73-3L13.7 3.86a2 2 0 0 0-3.42 0z"/></svg>
          </div>
          <div class="friction__title">Pause — that pushes you over budget.</div>
          <div class="friction__body">
            ${Screens.catLabel(category)} budget is ${Calc.money(planned)}. After this purchase you'd be at <strong style="color:var(--danger)">${Calc.money(used)}</strong>.
          </div>
          <div class="split-2">
            <button class="btn" data-action="friction-wishlist">Add to 24h pause</button>
            <button class="btn btn--danger" data-action="friction-continue">Buy anyway</button>
          </div>
        </div>
      `);
      window.__frictionResolve = resolve;
    });
  }

  // ---- bill / debt / goal / card sheets ----------------------------------
  function openBillSheet(id=null) {
    const editing = id ? state.bills.find(b=>b.id===id) : null;
    const b = editing || { id:null, name:'', amount:'', dueDay:1, category:'utilities', recurring:'monthly', autopay:false, notes:'' };
    const catOpts = (state.categories||[]).map(c => `<option value="${c.id}" ${c.id===b.category?'selected':''}>${c.label}</option>`).join('');
    openSheet(`
      <div class="sheet__hdr">
        <div class="sheet__title">${editing?'Edit bill':'Add bill'}</div>
        <button class="btn btn--sm btn--ghost" data-action="close-sheet">Cancel</button>
      </div>
      <div class="field"><label class="field__lbl">Name</label><input class="field__input" id="b-name" value="${(b.name||'').replace(/"/g,'&quot;')}"/></div>
      <div class="field--row">
        <div class="field"><label class="field__lbl">Amount</label><input class="field__input" type="number" step="0.01" id="b-amount" value="${b.amount}"/></div>
        <div class="field"><label class="field__lbl">Day of month</label><input class="field__input" type="number" min="1" max="28" id="b-due" value="${b.dueDay}"/></div>
      </div>
      <div class="field"><label class="field__lbl">Category</label><select id="b-cat">${catOpts}</select></div>
      <div class="split-2 mt-16">
        ${editing ? `<button class="btn btn--danger" data-action="del-bill" data-id="${editing.id}">Delete</button>` : `<button class="btn" data-action="close-sheet">Cancel</button>`}
        <button class="btn btn--primary" data-action="save-bill" data-id="${editing?editing.id:''}">Save</button>
      </div>
    `);
  }

  function openDebtSheet(id=null) {
    const editing = id ? state.debts.find(d=>d.id===id) : null;
    const d = editing || { id:null, creditor:'', balance:'', originalBalance:'', apr:'', minPayment:'', dueDay:1, type:'credit_card', limit:'' };
    openSheet(`
      <div class="sheet__hdr">
        <div class="sheet__title">${editing?'Edit debt':'Add debt'}</div>
        <button class="btn btn--sm btn--ghost" data-action="close-sheet">Cancel</button>
      </div>
      <div class="field"><label class="field__lbl">Creditor</label><input class="field__input" id="d-creditor" value="${(d.creditor||'').replace(/"/g,'&quot;')}"/></div>
      <div class="field"><label class="field__lbl">Type</label>
        <select id="d-type">
          ${[['credit_card','Credit card'],['personal_loan','Personal loan'],['car_loan','Car loan'],['student_loan','Student loan'],['misc','Other']].map(([v,l]) => `<option value="${v}" ${v===d.type?'selected':''}>${l}</option>`).join('')}
        </select>
      </div>
      <div class="split-2">
        <div class="field"><label class="field__lbl">Balance</label><input class="field__input" type="number" step="0.01" id="d-bal" value="${d.balance}"/></div>
        <div class="field"><label class="field__lbl">APR (%)</label><input class="field__input" type="number" step="0.01" id="d-apr" value="${d.apr}"/></div>
      </div>
      <div class="split-2">
        <div class="field"><label class="field__lbl">Min payment</label><input class="field__input" type="number" step="0.01" id="d-min" value="${d.minPayment}"/></div>
        <div class="field"><label class="field__lbl">Due day</label><input class="field__input" type="number" min="1" max="28" id="d-due" value="${d.dueDay}"/></div>
      </div>
      <div class="field"><label class="field__lbl">Credit limit (if card)</label><input class="field__input" type="number" id="d-limit" value="${d.limit||''}"/></div>
      <div class="split-2 mt-16">
        ${editing ? `<button class="btn btn--danger" data-action="del-debt" data-id="${editing.id}">Delete</button>` : `<button class="btn" data-action="close-sheet">Cancel</button>`}
        <button class="btn btn--primary" data-action="save-debt" data-id="${editing?editing.id:''}">Save</button>
      </div>
    `);
  }

  function openGoalSheet(id=null) {
    const editing = id ? state.goals.find(g=>g.id===id) : null;
    const g = editing || { id:null, label:'', target:'', saved:0, monthly:0, category:'sinking' };
    openSheet(`
      <div class="sheet__hdr">
        <div class="sheet__title">${editing?'Edit goal':'Add goal'}</div>
        <button class="btn btn--sm btn--ghost" data-action="close-sheet">Cancel</button>
      </div>
      <div class="field"><label class="field__lbl">Label</label><input class="field__input" id="g-label" value="${(g.label||'').replace(/"/g,'&quot;')}"/></div>
      <div class="field"><label class="field__lbl">Category</label>
        <select id="g-cat">
          ${[['emergency','Emergency fund'],['sinking','Sinking fund'],['travel','Travel'],['taxes','Taxes'],['custom','Custom']].map(([v,l])=>`<option value="${v}" ${v===g.category?'selected':''}>${l}</option>`).join('')}
        </select>
      </div>
      <div class="split-2">
        <div class="field"><label class="field__lbl">Target</label><input class="field__input" type="number" id="g-target" value="${g.target}"/></div>
        <div class="field"><label class="field__lbl">Saved</label><input class="field__input" type="number" id="g-saved" value="${g.saved}"/></div>
      </div>
      <div class="field"><label class="field__lbl">Monthly contribution</label><input class="field__input" type="number" id="g-monthly" value="${g.monthly}"/></div>
      <div class="split-2 mt-16">
        ${editing ? `<button class="btn btn--danger" data-action="del-goal" data-id="${editing.id}">Delete</button>` : `<button class="btn" data-action="close-sheet">Cancel</button>`}
        <button class="btn btn--primary" data-action="save-goal" data-id="${editing?editing.id:''}">Save</button>
      </div>
    `);
  }

  function openCardSheet(id=null) {
    const editing = id ? state.creditCards.find(c=>c.id===id) : null;
    const c = editing || { id:null, name:'', balance:'', limit:'' };
    openSheet(`
      <div class="sheet__hdr">
        <div class="sheet__title">${editing?'Edit card':'Add card snapshot'}</div>
        <button class="btn btn--sm btn--ghost" data-action="close-sheet">Cancel</button>
      </div>
      <div class="field"><label class="field__lbl">Card name</label><input class="field__input" id="c-name" value="${(c.name||'').replace(/"/g,'&quot;')}"/></div>
      <div class="split-2">
        <div class="field"><label class="field__lbl">Balance</label><input class="field__input" type="number" id="c-bal" value="${c.balance}"/></div>
        <div class="field"><label class="field__lbl">Credit limit</label><input class="field__input" type="number" id="c-lim" value="${c.limit}"/></div>
      </div>
      <div class="split-2 mt-16">
        ${editing ? `<button class="btn btn--danger" data-action="del-card" data-id="${editing.id}">Delete</button>` : `<button class="btn" data-action="close-sheet">Cancel</button>`}
        <button class="btn btn--primary" data-action="save-card" data-id="${editing?editing.id:''}">Save</button>
      </div>
    `);
  }

  function openBudgetEditSheet(cat) {
    const isNew = cat === '__new';
    const catId = isNew ? '' : cat;
    const current = isNew ? '' : (state.budgets[catId] || 0);
    const opts = (state.categories||[])
      .filter(c => isNew ? !state.budgets[c.id] : true)
      .map(c => `<option value="${c.id}" ${c.id===catId?'selected':''}>${c.label}</option>`).join('');
    openSheet(`
      <div class="sheet__hdr">
        <div class="sheet__title">${isNew?'Add budget category':'Edit '+Screens.catLabel(catId)}</div>
        <button class="btn btn--sm btn--ghost" data-action="close-sheet">Cancel</button>
      </div>
      <div class="field"><label class="field__lbl">Category</label>
        <select id="bg-cat" ${isNew?'':'disabled'}>${opts}</select>
      </div>
      <div class="field"><label class="field__lbl">Monthly budget</label>
        <input class="field__input" type="number" id="bg-amt" value="${current}" placeholder="0"/></div>
      <div class="split-2 mt-16">
        ${!isNew ? `<button class="btn btn--danger" data-action="del-budget" data-cat="${catId}">Remove</button>` : `<button class="btn" data-action="close-sheet">Cancel</button>`}
        <button class="btn btn--primary" data-action="save-budget" data-cat="${catId}">Save</button>
      </div>
    `);
  }

  // ---- CSV export --------------------------------------------------------
  function exportCSV(which) {
    let csv;
    if (which==='txns') {
      csv = Calc.toCSV(state.txns, [
        {label:'Date', key:'date'},
        {label:'Type', key:'type'},
        {label:'Amount', key:'amount'},
        {label:'Category', key:'category'},
        {label:'Merchant', key:'merchant'},
        {label:'Notes', key:'notes'},
        {label:'Recurring', key:'recurring'},
        {label:'Business', key:'business'},
      ]);
    } else if (which==='bills') {
      csv = Calc.toCSV(state.bills, [
        {label:'Name', key:'name'},
        {label:'Amount', key:'amount'},
        {label:'Due day', key:'dueDay'},
        {label:'Category', key:'category'},
        {label:'Recurring', key:'recurring'},
        {label:'Autopay', key:'autopay'},
      ]);
    } else if (which==='debts') {
      csv = Calc.toCSV(state.debts, [
        {label:'Creditor', key:'creditor'},
        {label:'Type', key:'type'},
        {label:'Balance', key:'balance'},
        {label:'APR', key:'apr'},
        {label:'Min payment', key:'minPayment'},
        {label:'Due day', key:'dueDay'},
        {label:'Limit', key:'limit'},
        {label:'Paid off', key:'paidOff'},
      ]);
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `debt-crusher-${which}-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 4000);
    toast('CSV downloaded');
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `debt-crusher-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 4000);
    toast('Backup downloaded');
  }

  // ---- onboarding handlers ----------------------------------------------
  function renderOnboardingDebts() {
    const root = document.getElementById('onb-debts');
    if (!root) return;
    root.innerHTML = onbDraftDebts.map((d,i) => `
      <div class="card" style="margin-bottom:8px">
        <div class="row-spaced">
          <div>
            <div style="font-weight:500">${escapeHTML(d.creditor || 'Unnamed')}</div>
            <div class="muted" style="font-size:12px">${d.balance ? Calc.money(d.balance) : '—'} · ${d.apr||0}% APR</div>
          </div>
          <button class="btn btn--sm btn--ghost" data-action="onb-remove-debt" data-i="${i}">Remove</button>
        </div>
      </div>
    `).join('');
  }

  function onbDebtForm() {
    openSheet(`
      <div class="sheet__hdr">
        <div class="sheet__title">Add a debt</div>
        <button class="btn btn--sm btn--ghost" data-action="close-sheet">Cancel</button>
      </div>
      <div class="field"><label class="field__lbl">Creditor</label><input class="field__input" id="od-creditor"/></div>
      <div class="field"><label class="field__lbl">Type</label>
        <select id="od-type">
          ${[['credit_card','Credit card'],['personal_loan','Personal loan'],['car_loan','Car loan'],['student_loan','Student loan'],['misc','Other']].map(([v,l]) => `<option value="${v}">${l}</option>`).join('')}
        </select>
      </div>
      <div class="split-2">
        <div class="field"><label class="field__lbl">Balance</label><input class="field__input" type="number" id="od-bal"/></div>
        <div class="field"><label class="field__lbl">APR (%)</label><input class="field__input" type="number" id="od-apr"/></div>
      </div>
      <div class="split-2">
        <div class="field"><label class="field__lbl">Min payment</label><input class="field__input" type="number" id="od-min"/></div>
        <div class="field"><label class="field__lbl">Due day</label><input class="field__input" type="number" min="1" max="28" id="od-due" value="1"/></div>
      </div>
      <button class="btn btn--primary btn--full" data-action="onb-save-debt">Add debt</button>
    `);
  }

  function commitOnboardingStep() {
    if (onbStep === 1) {
      state.profile = state.profile || {};
      const income = +$('#o-income')?.value || 0;
      state.profile.monthlyIncome = income;
      state.profile.payFrequency = $('#o-payfreq')?.value || 'biweekly';
      state.profile.payNextDate = $('#o-nextpay')?.value || null;
    } else if (onbStep === 2) {
      state.profile.startCash = +$('#o-cash')?.value || 0;
    } else if (onbStep === 3) {
      // debts captured live in onbDraftDebts
    } else if (onbStep === 4) {
      state.profile.extraDebtPayment = +$('#o-extra')?.value || 0;
    } else if (onbStep === 5) {
      state.profile.payoffStrategy = $('#o-strategy')?.value || 'avalanche';
      state.profile.flexibility = $('#o-flex')?.value || 'aggressive';
    }
  }

  function finishOnboarding() {
    // Build seed from demo, then overwrite with user inputs
    const demo = AppData.buildDemoData();
    // bills, budgets, categories, sample txns — keep
    state.bills = demo.bills;
    state.budgets = { ...AppData.DEFAULT_BUDGETS };
    state.categories = AppData.CATEGORIES;
    state.txns = demo.txns;
    state.checkins = demo.checkins;
    state.creditCards = demo.creditCards;
    state.goals = demo.goals;

    // user debts — replace demo set if they entered any
    if (onbDraftDebts.length > 0) {
      state.debts = onbDraftDebts.map(d => ({
        id: Store.id('debt'),
        creditor: d.creditor || 'Untitled',
        type: d.type || 'credit_card',
        balance: +d.balance || 0,
        originalBalance: +d.balance || 0,
        apr: +d.apr || 0,
        minPayment: +d.minPayment || 0,
        dueDay: +d.dueDay || 1,
        paidOff: false,
        limit: +d.limit || 0,
        createdAt: new Date().toISOString(),
      }));
      state.creditCards = state.debts.filter(d => d.type === 'credit_card').map(d => ({
        id: d.id, name: d.creditor, balance: d.balance, limit: d.limit
      }));
    } else {
      state.debts = demo.debts;
    }

    // ensure profile fields exist
    state.profile.createdAt = new Date().toISOString();
    state.profile.currency = 'USD';
    state.profile.monthlyIncome = state.profile.monthlyIncome || demo.profile.monthlyIncome;
    state.profile.startCash = state.profile.startCash || demo.profile.startCash;
    state.profile.extraDebtPayment = state.profile.extraDebtPayment || demo.profile.extraDebtPayment;
    state.profile.payFrequency = state.profile.payFrequency || demo.profile.payFrequency;
    state.profile.payNextDate = state.profile.payNextDate || demo.profile.payNextDate;
    state.profile.payoffStrategy = state.profile.payoffStrategy || 'avalanche';

    state.settings = state.settings || { theme:'dark', friction:true, wishlistPause:true, reminders:true };
    persist();
    onbStep = 0;
    onbDraftDebts = [];
    setRoute('dashboard');
    toast('Welcome aboard.');
  }

  function loadDemo() {
    state = Store.load();
    Object.assign(state, AppData.buildDemoData());
    persist();
    setRoute('dashboard');
    toast('Demo data loaded');
  }

  // ---- event delegation --------------------------------------------------
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-action], [data-route], .tabbar__btn, .drawer__item, .segment__btn');
    if (!t) return;

    // tabbar routing
    if (t.classList.contains('tabbar__btn') && t.dataset.route) {
      setRoute(t.dataset.route);
      return;
    }

    // drawer routing
    if (t.classList.contains('drawer__item') && t.dataset.route) {
      closeDrawer();
      setRoute(t.dataset.route);
      return;
    }

    // segment groups
    if (t.classList.contains('segment__btn')) {
      const group = t.closest('[data-segment]');
      if (!group) return;
      const v = t.dataset.val;
      const name = group.dataset.segment;
      handleSegment(name, v);
      return;
    }

    const a = t.dataset.action; if (!a) return;
    e.preventDefault();
    const id = t.dataset.id;
    const which = t.dataset.which;
    const cat = t.dataset.cat;
    const val = t.dataset.val;

    switch (a) {
      case 'close-sheet': closeSheet(); break;

      // ---- onboarding
      case 'onb-next': {
        commitOnboardingStep();
        const steps = Screens.onboardingSteps();
        if (onbStep === steps.length - 1) { finishOnboarding(); return; }
        onbStep++;
        render();
        break;
      }
      case 'onb-back': onbStep = Math.max(0, onbStep-1); render(); break;
      case 'onb-skip': loadDemo(); break;
      case 'onb-add-debt': onbDebtForm(); break;
      case 'onb-save-debt': {
        const d = {
          creditor: $('#od-creditor').value.trim() || 'Untitled',
          type: $('#od-type').value,
          balance: $('#od-bal').value,
          apr: $('#od-apr').value,
          minPayment: $('#od-min').value,
          dueDay: $('#od-due').value,
        };
        onbDraftDebts.push(d);
        closeSheet();
        renderOnboardingDebts();
        break;
      }
      case 'onb-remove-debt': {
        onbDraftDebts.splice(+t.dataset.i, 1);
        renderOnboardingDebts();
        break;
      }

      // ---- txn add/edit/save/delete
      case 'add-txn': openTxnSheet(); break;
      case 'edit-txn': {
        const row = t.closest('[data-id]'); openTxnSheet(row.dataset.id); break;
      }
      case 'del-txn': {
        state.txns = state.txns.filter(x => x.id !== id);
        persist(); closeSheet(); render(); toast('Deleted'); break;
      }
      case 'save-txn': /* handled by async capture-phase listener below */ break;
      case 'toggle-t-recur': {
        const v = t.getAttribute('aria-checked') !== 'true';
        t.setAttribute('aria-checked', v ? 'true':'false');
        $('#sheet-inner').dataset.recurring = v ? '1':'';
        break;
      }
      case 'toggle-t-biz': {
        const v = t.getAttribute('aria-checked') !== 'true';
        t.setAttribute('aria-checked', v ? 'true':'false');
        $('#sheet-inner').dataset.business = v ? '1':'';
        break;
      }
      case 'add-split': {
        const root = $('#splits');
        const arr = root.dataset.json ? JSON.parse(root.dataset.json) : [];
        arr.push({ category: 'misc', amount: 0 });
        renderSplits(arr);
        break;
      }

      // ---- friction
      case 'friction-continue': {
        closeSheet();
        if (window.__frictionResolve) { window.__frictionResolve(true); window.__frictionResolve = null; }
        break;
      }
      case 'friction-wishlist': {
        // Push merchant + amount to wishlist (24h)
        const amt = +$('#t-amount')?.value || 0;
        const merch = $('#t-merchant')?.value || 'Item';
        const cat = $('#t-category')?.value;
        state.wishlist.push({ id: Store.id('w'), createdAt: Date.now(), merchant: merch, amount: amt, category: cat });
        persist();
        closeSheet();
        // also close txn sheet
        setTimeout(closeSheet, 50);
        if (window.__frictionResolve) { window.__frictionResolve(false); window.__frictionResolve = null; }
        toast('On 24-hour pause');
        break;
      }

      // ---- bills
      case 'add-bill': openBillSheet(); break;
      case 'save-bill': {
        const data = {
          name: $('#b-name').value.trim(),
          amount: +$('#b-amount').value || 0,
          dueDay: +$('#b-due').value || 1,
          category: $('#b-cat').value,
          recurring: 'monthly', autopay: false, notes: '',
        };
        if (!data.name) return toast('Name required');
        if (id) {
          const i = state.bills.findIndex(b=>b.id===id);
          state.bills[i] = { ...state.bills[i], ...data };
        } else {
          state.bills.push({ id: Store.id('bill'), ...data });
        }
        persist(); closeSheet(); render(); toast('Saved');
        break;
      }
      case 'del-bill': {
        state.bills = state.bills.filter(b => b.id !== id);
        persist(); closeSheet(); render(); toast('Deleted'); break;
      }
      case 'pay-bill': {
        const bill = state.bills.find(b=>b.id===id);
        if (!bill) return;
        state.txns.push({
          id: Store.id('t'), date: new Date().toISOString().slice(0,10),
          amount: bill.amount, category: bill.category, merchant: bill.name,
          type:'expense', notes:'Paid bill', recurring:true, business:false,
        });
        persist(); render(); toast(`Marked ${bill.name} paid`); break;
      }
      case 'unpay-bill': {
        const bill = state.bills.find(b=>b.id===id);
        if (!bill) return;
        // remove most recent matching txn this month
        const now = new Date();
        const idx = state.txns.map((t,i)=>({t,i})).reverse().find(({t}) =>
          t.merchant === bill.name && Calc.inMonth(t.date, now));
        if (idx) state.txns.splice(idx.i, 1);
        persist(); render(); toast('Undone'); break;
      }

      // ---- debts
      case 'add-debt': openDebtSheet(); break;
      case 'edit-debt': openDebtSheet(t.closest('[data-id]').dataset.id); break;
      case 'save-debt': {
        const data = {
          creditor: $('#d-creditor').value.trim(),
          type: $('#d-type').value,
          balance: +$('#d-bal').value || 0,
          apr: +$('#d-apr').value || 0,
          minPayment: +$('#d-min').value || 0,
          dueDay: +$('#d-due').value || 1,
          limit: +$('#d-limit').value || 0,
        };
        if (!data.creditor) return toast('Creditor required');
        if (id) {
          const i = state.debts.findIndex(d=>d.id===id);
          state.debts[i] = { ...state.debts[i], ...data };
          // sync card snapshot
          if (data.type === 'credit_card') {
            const ci = state.creditCards.findIndex(c=>c.id===id);
            const card = { id, name: data.creditor, balance: data.balance, limit: data.limit };
            if (ci>=0) state.creditCards[ci] = card; else state.creditCards.push(card);
          }
        } else {
          const newId = Store.id('debt');
          state.debts.push({ id: newId, ...data, originalBalance: data.balance, paidOff:false, createdAt: new Date().toISOString() });
          if (data.type === 'credit_card') {
            state.creditCards.push({ id: newId, name: data.creditor, balance: data.balance, limit: data.limit });
          }
        }
        persist(); closeSheet(); render(); toast('Saved'); break;
      }
      case 'del-debt': {
        state.debts = state.debts.filter(d => d.id !== id);
        state.creditCards = state.creditCards.filter(c => c.id !== id);
        persist(); closeSheet(); render(); toast('Deleted'); break;
      }

      // ---- goals
      case 'add-goal': openGoalSheet(); break;
      case 'edit-goal': openGoalSheet(t.closest('[data-id]').dataset.id); break;
      case 'save-goal': {
        const data = {
          label: $('#g-label').value.trim(),
          category: $('#g-cat').value,
          target: +$('#g-target').value || 0,
          saved: +$('#g-saved').value || 0,
          monthly: +$('#g-monthly').value || 0,
        };
        if (!data.label) return toast('Label required');
        if (id) {
          const i = state.goals.findIndex(g=>g.id===id);
          state.goals[i] = { ...state.goals[i], ...data };
        } else {
          state.goals.push({ id: Store.id('goal'), ...data });
        }
        persist(); closeSheet(); render(); toast('Saved'); break;
      }
      case 'del-goal': {
        state.goals = state.goals.filter(g => g.id !== id);
        persist(); closeSheet(); render(); toast('Deleted'); break;
      }

      // ---- credit cards
      case 'add-card': openCardSheet(); break;
      case 'edit-card': openCardSheet(t.closest('[data-id]').dataset.id); break;
      case 'save-card': {
        const data = {
          name: $('#c-name').value.trim(),
          balance: +$('#c-bal').value || 0,
          limit: +$('#c-lim').value || 0,
        };
        if (!data.name) return toast('Name required');
        if (id) {
          const i = state.creditCards.findIndex(c=>c.id===id);
          state.creditCards[i] = { ...state.creditCards[i], ...data };
        } else {
          state.creditCards.push({ id: Store.id('card'), ...data });
        }
        persist(); closeSheet(); render(); toast('Saved'); break;
      }
      case 'del-card': {
        state.creditCards = state.creditCards.filter(c => c.id !== id);
        persist(); closeSheet(); render(); toast('Deleted'); break;
      }

      // ---- budget
      case 'edit-budget': openBudgetEditSheet(cat); break;
      case 'save-budget': {
        const c = $('#bg-cat').value;
        const amt = +$('#bg-amt').value || 0;
        if (!c) return toast('Pick a category');
        state.budgets[c] = amt;
        persist(); closeSheet(); render(); toast('Saved'); break;
      }
      case 'del-budget': {
        delete state.budgets[cat];
        persist(); closeSheet(); render(); toast('Removed'); break;
      }

      // ---- toggles
      case 'toggle-friction': {
        state.settings.friction = t.getAttribute('aria-checked') !== 'true';
        t.setAttribute('aria-checked', state.settings.friction ? 'true':'false');
        persist(); break;
      }
      case 'toggle-wishlist': {
        state.settings.wishlistPause = t.getAttribute('aria-checked') !== 'true';
        t.setAttribute('aria-checked', state.settings.wishlistPause ? 'true':'false');
        persist(); break;
      }
      case 'toggle-zerobased': {
        state.settings.zeroBased = t.getAttribute('aria-checked') !== 'true';
        t.setAttribute('aria-checked', state.settings.zeroBased ? 'true':'false');
        persist(); break;
      }
      case 'toggle-rollover': {
        state.settings.rollover = t.getAttribute('aria-checked') !== 'true';
        t.setAttribute('aria-checked', state.settings.rollover ? 'true':'false');
        persist(); break;
      }
      case 'toggle-reminders': {
        state.settings.reminders = t.getAttribute('aria-checked') !== 'true';
        t.setAttribute('aria-checked', state.settings.reminders ? 'true':'false');
        persist(); break;
      }

      // ---- settings
      case 'save-profile': {
        state.profile.monthlyIncome = +$('#set-income').value || 0;
        state.profile.payFrequency = $('#set-payfreq').value;
        state.profile.payNextDate = $('#set-nextpay').value;
        state.profile.startCash = +$('#set-cash').value || 0;
        state.profile.extraDebtPayment = +$('#set-extra').value || 0;
        state.profile.payoffStrategy = $('#set-strategy').value;
        persist(); render(); toast('Profile saved'); break;
      }
      case 'reset': {
        if (confirm('Reset all data and start over? This cannot be undone.')) {
          Store.clearAll();
          state = Store.load();
          onbStep = 0; onbDraftDebts = [];
          render();
        }
        break;
      }
      case 'export-csv': exportCSV(which); break;
      case 'export-json': exportJSON(); break;

      // ---- simulator
      case 'sim-set': {
        const v = +val;
        routeCtx = { extra: v }; render();
        break;
      }
      case 'save-extra': {
        const v = +($('#sim-slider')?.value) || 0;
        state.profile.extraDebtPayment = v;
        persist(); render(); toast('Saved to plan'); break;
      }
      case 'open-simulator': setRoute('simulator'); break;

      // ---- weekly review
      case 'checkin': {
        state.checkins.push({ date: new Date().toISOString().slice(0,10), action: 'Reviewed week' });
        persist(); render(); toast('Streak +1'); break;
      }
    }
  });

  function parseSplits() {
    const root = $('#splits'); if (!root) return [];
    const arr = root.dataset.json ? JSON.parse(root.dataset.json) : [];
    arr.forEach((s,i) => {
      const cat = $(`[data-split-cat="${i}"]`)?.value || s.category;
      const amt = +$(`[data-split-amt="${i}"]`)?.value || 0;
      s.category = cat; s.amount = amt;
    });
    return arr.filter(s => s.amount > 0);
  }

  // Segment handlers
  function handleSegment(name, v) {
    switch (name) {
      case 'range':  routeCtx.range  = v; render(); break;
      case 'filter': routeCtx.filter = v; render(); break;
      case 'bill-mode': routeCtx.mode = v; render(); break;
      case 'strategy': state.profile.payoffStrategy = v; persist(); render(); break;
      case 'theme':
        state.settings.theme = v; persist(); applyTheme(); render(); break;
      case 'txn-type': {
        // toggle within open sheet
        $('#sheet-inner').dataset.type = v;
        $$('#sheet-inner [data-segment="txn-type"] .segment__btn').forEach(b =>
          b.setAttribute('aria-pressed', b.dataset.val === v ? 'true':'false'));
        break;
      }
    }
  }

  // ---- search debounce ---------------------------------------------------
  document.addEventListener('input', e => {
    if (e.target.id === 'txn-search') {
      clearTimeout(window.__searchT);
      window.__searchT = setTimeout(() => {
        routeCtx.search = e.target.value;
        render();
        // restore focus
        setTimeout(()=> {
          const el = $('#txn-search');
          if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
        }, 10);
      }, 220);
    }
    if (e.target.id === 'sim-slider') {
      const v = +e.target.value;
      const out = e.target.parentElement.querySelector('.num');
      if (out) out.textContent = Calc.money(v);
      clearTimeout(window.__simT);
      window.__simT = setTimeout(() => {
        routeCtx.extra = v;
        render();
        setTimeout(()=> $('#sim-slider')?.focus(), 10);
      }, 280);
    }
    if (e.target.id === 'fico') {
      state.creditScore = +e.target.value || null;
      persist();
    }
  });

  // ---- appbar actions ----------------------------------------------------
  $('#btn-more').addEventListener('click', openDrawer);
  $('#btn-settings').addEventListener('click', () => setRoute('settings'));
  $('#fab').addEventListener('click', () => openTxnSheet());

  // ---- We need save-txn to await friction. Patch by re-binding ---------
  // Easier: handle save-txn as a delegated async listener too.
  document.addEventListener('click', async e => {
    const t = e.target.closest('[data-action="save-txn"]');
    if (!t) return;
    e.preventDefault();
    const id = t.dataset.id;
    const splits = parseSplits();
    const fields = {
      amount: +$('#t-amount').value || 0,
      merchant: $('#t-merchant').value.trim(),
      date: $('#t-date').value,
      category: $('#t-category').value,
      notes: $('#t-notes').value.trim(),
      type: $('#sheet-inner').dataset.type || 'expense',
      recurring: $('#sheet-inner').dataset.recurring === '1',
      business:  $('#sheet-inner').dataset.business === '1',
      split: splits.length ? splits : null,
    };
    if (!fields.amount) { toast('Amount required'); return; }
    let proceed = true;
    if (fields.type === 'expense') {
      proceed = await maybeFriction(fields.category, fields.amount);
    }
    if (!proceed) return;
    if (id) {
      const i = state.txns.findIndex(x=>x.id===id);
      if (i >= 0) state.txns[i] = { ...state.txns[i], ...fields };
    } else {
      state.txns.push({ id: Store.id('t'), ...fields });
    }
    persist(); closeSheet(); render(); toast('Saved');
  }, true /* capture so it pre-empts the non-async path */);

  // ---- Service worker ----------------------------------------------------
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(err => console.warn('SW failed', err));
    });
  }

  // ---- start -------------------------------------------------------------
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  applyTheme();
  render();
  // pin top after initial render (some browsers restore scroll on hard reload)
  requestAnimationFrame(() => window.scrollTo(0, 0));

  // Development-only debugging hook. Keep financial state off the public global
  // object on the published app.
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    window.DC = { state, setRoute, render, loadDemo };
  }
})();
