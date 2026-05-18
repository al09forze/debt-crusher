/* Debt Crusher — storage
 * Defensive localStorage wrapper that gracefully degrades to in-memory
 * if the browser blocks storage (private mode, quota, etc.).
 */
(function () {
  const KEY = 'debt-crusher.v1';

  let memory = null;        // fallback memory store
  let usingFallback = false;

  function safeRead() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.warn('[storage] read failed', e);
      usingFallback = true;
      return memory;
    }
  }

  function safeWrite(obj) {
    try {
      if (usingFallback) { memory = obj; return; }
      localStorage.setItem(KEY, JSON.stringify(obj));
    } catch (e) {
      console.warn('[storage] write failed — using memory fallback', e);
      usingFallback = true;
      memory = obj;
    }
  }

  function load() {
    let data = safeRead();
    if (!data) {
      // first run — leave empty so onboarding triggers
      data = { profile: null };
    }
    // ensure all shapes exist
    data.profile = data.profile || null;
    data.txns = data.txns || [];
    data.bills = data.bills || [];
    data.debts = data.debts || [];
    data.goals = data.goals || [];
    data.budgets = data.budgets || {};      // {category: amount}
    data.categories = data.categories || null; // array
    data.creditCards = data.creditCards || [];
    data.checkins = data.checkins || [];    // weekly review streak
    data.settings = data.settings || { theme: 'dark', wishlistPause: true, friction: true };
    data.wishlist = data.wishlist || [];    // 24h pause queue
    return data;
  }

  function save(data) {
    safeWrite(data);
  }

  function clearAll() {
    try { localStorage.removeItem(KEY); } catch (e) {}
    memory = null;
  }

  function id(prefix='id') {
    return prefix + '-' + Date.now().toString(36) + '-' +
      Math.random().toString(36).slice(2, 7);
  }

  window.Store = {
    load,
    save,
    clearAll,
    id,
    isFallback: () => usingFallback,
  };
})();
