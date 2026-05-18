/* Debt Crusher — sample data + reference categories.
 * Used both as seed for first-run and as a "Reset to demo" hook.
 */

const CATEGORIES = [
  { id: 'food',         label: 'Food & Dining', icon: 'food',         essential: false },
  { id: 'gas',          label: 'Gas & Transit', icon: 'car',          essential: true  },
  { id: 'rent',         label: 'Rent / Housing',icon: 'home',         essential: true  },
  { id: 'subscriptions',label: 'Subscriptions', icon: 'tv',           essential: false },
  { id: 'shopping',     label: 'Shopping',      icon: 'bag',          essential: false },
  { id: 'debt',         label: 'Debt Payment',  icon: 'card',         essential: true  },
  { id: 'business',     label: 'Business',      icon: 'briefcase',    essential: true  },
  { id: 'groceries',    label: 'Groceries',     icon: 'cart',         essential: true  },
  { id: 'utilities',    label: 'Utilities',     icon: 'bolt',         essential: true  },
  { id: 'health',       label: 'Health',        icon: 'heart',        essential: true  },
  { id: 'misc',         label: 'Misc',          icon: 'dots',         essential: false },
];

const DEFAULT_BUDGETS = {
  food: 380,
  groceries: 480,
  gas: 180,
  rent: 1850,
  subscriptions: 95,
  shopping: 220,
  utilities: 230,
  health: 120,
  misc: 120,
};

/* Builds a fully seeded demo dataset around "today". */
function buildDemoData() {
  const now = new Date();
  const Y = now.getFullYear(); const M = now.getMonth();
  const day = (offset) => {
    const d = new Date(now); d.setDate(d.getDate() + offset); return d.toISOString().slice(0,10);
  };
  const mday = (n) => {
    // a date in current month, day n
    const d = new Date(Y, M, n); return d.toISOString().slice(0,10);
  };

  const profile = {
    name: 'You',
    monthlyIncome: 6200,
    payFrequency: 'biweekly',
    payNextDate: day(8),
    currency: 'USD',
    payoffStrategy: 'avalanche',  // user picked aggressive
    extraDebtPayment: 350,
    startCash: 1840,
    flexibility: 'aggressive',
    createdAt: new Date().toISOString(),
  };

  const bills = [
    { id: Store.id('bill'), name: 'Rent',             amount: 1850, dueDay: 1,  category: 'rent',          recurring: 'monthly', autopay: true,  notes: '' },
    { id: Store.id('bill'), name: 'Electric',         amount: 92,   dueDay: 9,  category: 'utilities',     recurring: 'monthly', autopay: true,  notes: '' },
    { id: Store.id('bill'), name: 'Internet',         amount: 65,   dueDay: 12, category: 'utilities',     recurring: 'monthly', autopay: true,  notes: '' },
    { id: Store.id('bill'), name: 'Phone',            amount: 55,   dueDay: 18, category: 'utilities',     recurring: 'monthly', autopay: false, notes: '' },
    { id: Store.id('bill'), name: 'Spotify',          amount: 12,   dueDay: 21, category: 'subscriptions', recurring: 'monthly', autopay: true,  notes: '' },
    { id: Store.id('bill'), name: 'Netflix',          amount: 16,   dueDay: 23, category: 'subscriptions', recurring: 'monthly', autopay: true,  notes: '' },
    { id: Store.id('bill'), name: 'Adobe CC',         amount: 56,   dueDay: 7,  category: 'subscriptions', recurring: 'monthly', autopay: true,  notes: '' },
    { id: Store.id('bill'), name: 'Gym',              amount: 38,   dueDay: 15, category: 'health',        recurring: 'monthly', autopay: true,  notes: '' },
    { id: Store.id('bill'), name: 'Renter Insurance', amount: 22,   dueDay: 5,  category: 'utilities',     recurring: 'monthly', autopay: true,  notes: '' },
  ];

  const debts = [
    {
      id: Store.id('debt'), creditor: 'Chase Sapphire', type: 'credit_card',
      balance: 4280, originalBalance: 5200, apr: 22.99, minPayment: 105, dueDay: 17,
      limit: 7000, paidOff: false, createdAt: new Date().toISOString(),
    },
    {
      id: Store.id('debt'), creditor: 'Amex Blue',      type: 'credit_card',
      balance: 1620, originalBalance: 2400, apr: 19.49, minPayment: 45,  dueDay: 22,
      limit: 5000, paidOff: false, createdAt: new Date().toISOString(),
    },
    {
      id: Store.id('debt'), creditor: 'Discover IT',    type: 'credit_card',
      balance: 950,  originalBalance: 2200, apr: 24.99, minPayment: 35,  dueDay: 11,
      limit: 4500, paidOff: false, createdAt: new Date().toISOString(),
    },
    {
      id: Store.id('debt'), creditor: 'SoFi Personal Loan', type: 'personal_loan',
      balance: 6300, originalBalance: 9000, apr: 11.24, minPayment: 220, dueDay: 5,
      paidOff: false, createdAt: new Date().toISOString(),
    },
    {
      id: Store.id('debt'), creditor: 'Honda Auto',     type: 'car_loan',
      balance: 8420, originalBalance: 14500, apr: 6.49, minPayment: 295, dueDay: 25,
      paidOff: false, createdAt: new Date().toISOString(),
    },
  ];

  // credit cards derived from debts of type=credit_card for credit health snapshot
  const creditCards = debts.filter(d => d.type === 'credit_card').map(d => ({
    id: d.id, name: d.creditor, balance: d.balance, limit: d.limit
  }));

  const goals = [
    { id: Store.id('goal'), label: 'Emergency Fund',     target: 3000, saved: 740,  category: 'emergency', monthly: 200 },
    { id: Store.id('goal'), label: 'Car Repair Sinking', target: 1200, saved: 410,  category: 'sinking',   monthly: 50  },
    { id: Store.id('goal'), label: 'Travel: Lisbon',     target: 2400, saved: 380,  category: 'travel',    monthly: 100 },
    { id: Store.id('goal'), label: 'Taxes (Q3)',         target: 1800, saved: 950,  category: 'taxes',     monthly: 150 },
  ];

  // realistic txns across last ~45 days
  const txns = [];
  const t = (offset, amount, cat, merchant, type='expense', notes='', extras={}) => {
    txns.push({
      id: Store.id('t'),
      date: day(offset),
      amount: +amount,
      category: cat,
      merchant,
      type,                     // 'expense' | 'income'
      notes,
      recurring: !!extras.recurring,
      business: !!extras.business,
      split: extras.split || null,
    });
  };

  // income — last paycheck 8 days ago, before that 22 days ago
  t(-8, 3100, 'misc',      'Direct Deposit — Acme Co.', 'income', 'Biweekly paycheck');
  t(-22, 3100, 'misc',     'Direct Deposit — Acme Co.', 'income', 'Biweekly paycheck');
  t(-12, 540,  'business', 'Studio client invoice',     'income', 'Project payment', { business: true });

  // recurring subs (caught by detector)
  t(-30, 12,   'subscriptions','Spotify Family', 'expense','', { recurring: true });
  t(-30, 16,   'subscriptions','Netflix Premium','expense','', { recurring: true });
  t(-30, 56,   'subscriptions','Adobe Creative Cloud','expense','', { recurring: true });
  t(-2,  12,   'subscriptions','Spotify Family', 'expense','', { recurring: true });
  t(-3,  16,   'subscriptions','Netflix Premium','expense','', { recurring: true });
  t(-5,  56,   'subscriptions','Adobe Creative Cloud','expense','', { recurring: true });
  t(-1,  9.99, 'subscriptions','iCloud+ 200GB','expense','', { recurring: true });

  // rent + utilities
  t(-13, 1850, 'rent',     'Greenline Apartments', 'expense','', { recurring: true });
  t(-7,  92,   'utilities','ConEd Electric',       'expense','', { recurring: true });
  t(-5,  65,   'utilities','Verizon Fios',         'expense','', { recurring: true });

  // groceries
  t(-1,  82.45,'groceries','Trader Joe\u2019s');
  t(-4,  64.10,'groceries','Whole Foods');
  t(-9,  46.30,'groceries','Trader Joe\u2019s');
  t(-15, 71.20,'groceries','Whole Foods');
  t(-22, 58.40,'groceries','Trader Joe\u2019s');

  // food / dining (kept lean so weekly safe-to-spend isn’t already maxed in demo)
  t(0,   14.50,'food','Sweetgreen','expense','Lunch');
  t(-2,  6.75, 'food','Blue Bottle Coffee');
  t(-3,  22.10,'food','Joe\'s Pizza');
  t(-7,  38.80,'food','Lucia\'s Trattoria','expense','Dinner');

  // gas / transit
  t(-2, 42.30, 'gas','Shell');
  t(-12, 51.10,'gas','BP');
  t(-25, 48.60,'gas','Shell');

  // shopping (a meaningful spike — insights catches it)
  t(-4, 89.00, 'shopping','Uniqlo','expense','New jeans + tee');
  t(-6, 32.00, 'shopping','Muji');
  t(-29, 425.00,'shopping','Apple — Magic Trackpad + cable','expense','Studio gear');

  // debt payments — last month's
  t(-13, 105, 'debt','Chase Sapphire',  'expense','Min payment');
  t(-13, 45,  'debt','Amex Blue',       'expense','Min payment');
  t(-13, 35,  'debt','Discover IT',     'expense','Min payment');
  t(-13, 220, 'debt','SoFi Personal',   'expense','Min payment');
  t(-13, 295, 'debt','Honda Auto',      'expense','Loan payment');
  t(-13, 350, 'debt','Chase Sapphire',  'expense','Extra payment — avalanche');

  // business expense (kept separate)
  t(-3,  29,   'business','Notion subscription', 'expense','', { business: true, recurring: true });
  t(-11, 145,  'business','Figma annual',        'expense','', { business: true });

  // health
  t(-8, 38,    'health','Equinox','expense','', { recurring: true });

  // misc + a couple late-night impulse
  t(-2, 11,    'misc','Uber');
  t(-5, 18.40, 'food','Bar Tabac','expense','Late-night drinks');

  // check-in streak (last 3 Sundays)
  const checkins = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - (now.getDay() + 7 * i));
    checkins.push({ date: d.toISOString().slice(0,10), action: 'Paid extra on Chase Sapphire' });
  }

  return {
    profile,
    txns,
    bills,
    debts,
    creditCards,
    goals,
    budgets: { ...DEFAULT_BUDGETS },
    categories: CATEGORIES,
    checkins,
    settings: { theme: 'dark', wishlistPause: true, friction: true },
    wishlist: [],
  };
}

window.AppData = {
  CATEGORIES,
  DEFAULT_BUDGETS,
  buildDemoData,
};
