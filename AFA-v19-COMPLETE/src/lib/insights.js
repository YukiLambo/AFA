// Personal finance review: turns the user's profile, transactions, assets and debts into a scored
// snapshot and a ranked list of concrete recommendations. Pure functions, no network, easy to test.
//
// Benchmarks used (general education, not regulated advice):
//  - 50/30/20 budgeting: needs ≤ 50%, wants ≤ 30%, savings ≥ 20% of take-home income (Warren & Tyagi, 2005)
//  - Emergency fund: 3 months of essential spending, 6 with dependants or irregular income
//  - Housing cost ≤ 30% of income (affordability rule of thumb)
//  - Debts above ~10% APR cost more than long-run market returns, so they are paid first
//  - Growth-asset share by risk profile, trimmed with age; crypto kept to a small slice

export const NEEDS = ['Rent', 'Utilities', 'Groceries', 'Transport', 'Phone & Internet', 'Insurance', 'Health', 'Education', 'Children', 'Fees & Tax', 'Car'];
export const WANTS = ['Dining', 'Coffee & Snacks', 'Shopping', 'Clothing', 'Entertainment', 'Subscriptions', 'Beauty', 'Fitness', 'Travel', 'Social', 'Gifts Given', 'Pets', 'Other'];

const RISK_PROFILES = {
  conservative: { label: 'Conservative', growth: 35, cryptoCap: 2, expectedReturn: 0.03 },
  moderate: { label: 'Moderate', growth: 60, cryptoCap: 5, expectedReturn: 0.05 },
  aggressive: { label: 'Aggressive', growth: 80, cryptoCap: 10, expectedReturn: 0.07 }
};

export function riskProfileOf(text = '') {
  const t = String(text).toLowerCase();
  if (t.startsWith('conservative')) return { id: 'conservative', ...RISK_PROFILES.conservative };
  if (t.startsWith('aggressive')) return { id: 'aggressive', ...RISK_PROFILES.aggressive };
  return { id: 'moderate', ...RISK_PROFILES.moderate, unset: !t };
}

export function ageFrom(birthday, now = new Date()) {
  if (!birthday) return null;
  const b = new Date(birthday);
  if (Number.isNaN(b.getTime())) return null;
  let age = now.getFullYear() - b.getFullYear();
  if (now < new Date(now.getFullYear(), b.getMonth(), b.getDate())) age--;
  return age >= 10 && age <= 110 ? age : null;
}

// Months needed to reach `target` from `start` saving `monthly` at annual return `r`
export function monthsToTarget(start, monthly, target, r) {
  if (start >= target) return 0;
  if (monthly <= 0 && r <= 0) return Infinity;
  const i = r / 12;
  let bal = start;
  for (let m = 1; m <= 1200; m++) {
    bal = bal * (1 + i) + monthly;
    if (bal >= target) return m;
  }
  return Infinity;
}

// Monthly saving needed to reach `target` in `months`
export function monthlyNeeded(start, target, months, r) {
  if (months <= 0) return Math.max(0, target - start);
  const i = r / 12;
  const grownStart = start * Math.pow(1 + i, months);
  if (grownStart >= target) return 0;
  const factor = i > 0 ? (Math.pow(1 + i, months) - 1) / i : months;
  return (target - grownStart) / factor;
}

const round = (n, step = 10) => Math.round(n / step) * step;
const hkd = (n) => `HK$${Math.round(n).toLocaleString('en-HK')}`;
const pct = (n) => `${Math.round(n)}%`;
const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

/**
 * @param {object} ctx
 *  profile        { name, birthday, goal, riskTolerance, targetAmount, goalYears, monthlyIncome, dependants, weeklyMaxSpend }
 *  transactions   [{ date, type, category, amount, account }]
 *  recurringRules [{ template, frequency, active }]
 *  liquidCash     HKD in bank / cash / Octopus (from the ledger)
 *  stocks         [{ symbol, valueHkd }]
 *  assets         [{ type, name, valueHkd, maturity, rate }]
 *  debts          [{ name, balance, apr, minPay }]
 *  debtPlan       { totalMonths, totalInterest, stuck, debtFreeLabel }
 *  weeklySpent    spending so far this week
 *  tax            { tvcMonthly, savedNow, savedAtMax }
 *  paper          { equity, startingCash, trades } | null
 */
export function buildInsights(ctx, now = new Date()) {
  const p = ctx.profile || {};
  const tx = ctx.transactions || [];
  const risk = riskProfileOf(p.riskTolerance);
  const age = ageFrom(p.birthday, now);
  const dependants = Number(p.dependants) || 0;

  // ---- Monthly picture from the last 90 days ----
  const since = new Date(now); since.setDate(since.getDate() - 90);
  const sinceKey = since.toISOString().slice(0, 10);
  const recent = tx.filter(t => String(t.date || '') >= sinceKey);
  const firstDate = recent.reduce((min, t) => (t.date < min ? t.date : min), now.toISOString().slice(0, 10));
  const spanDays = Math.max(30, (now - new Date(firstDate)) / 86400000);
  const months = Math.max(1, Math.min(3, spanDays / 30.4));
  // Monthly average per category. Bills that happen about once a month (rent, salary) are averaged over the
  // calendar months they appear in, so 3 rents across 61 days is HK$X a month, not 1.5×; everyday spending
  // is averaged over the real time span.
  const groups = {};
  recent.forEach(t => {
    const key = `${t.type === 'income' ? 'in' : t.category === 'Investment' ? 'inv' : 'out'}|${t.category}`;
    (groups[key] = groups[key] || []).push(t);
  });
  const byCat = {};
  const incomeByCat = {};
  let incomeSum = 0, investSum = 0;
  Object.entries(groups).forEach(([key, list]) => {
    const [kind, cat] = key.split('|');
    const total = list.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const monthsSeen = new Set(list.map(t => String(t.date).slice(0, 7))).size;
    const divisor = list.length <= monthsSeen + 1 ? Math.max(monthsSeen, 1) : months;
    const monthly = total / divisor;
    if (kind === 'in') { incomeSum += monthly; incomeByCat[cat] = monthly; }
    else if (kind === 'inv') investSum += monthly;
    else byCat[cat] = monthly;
  });
  const monthlyByCat = byCat;
  const ledgerIncome = incomeSum;
  const profileIncome = Number(p.monthlyIncome) || 0;
  const income = ledgerIncome > 0 ? ledgerIncome : profileIncome;
  const expense = Object.values(monthlyByCat).reduce((s, v) => s + v, 0);
  const investing = investSum;
  const needs = NEEDS.reduce((s, c) => s + (monthlyByCat[c] || 0), 0);
  const wants = Object.entries(monthlyByCat).filter(([c]) => !NEEDS.includes(c)).reduce((s, [, v]) => s + v, 0);
  const housing = (monthlyByCat.Rent || 0);
  const savingsRate = income > 0 ? ((income - expense) / income) * 100 : 0;
  const essentials = needs > 0 ? needs : expense * 0.6;

  // ---- Balance sheet ----
  const assets = ctx.assets || [];
  const sumType = (...types) => assets.filter(a => types.includes(a.type)).reduce((s, a) => s + (a.valueHkd || 0), 0);
  const stocksValue = (ctx.stocks || []).reduce((s, h) => s + (h.valueHkd || 0), 0);
  const crypto = sumType('crypto');
  const warrants = sumType('warrant');
  const funds = sumType('fund');
  const bonds = sumType('bond');
  const deposits = sumType('cash');
  const gold = sumType('gold');
  const property = sumType('property');
  const other = sumType('insurance', 'mpf', 'other');
  const liquid = Math.max(0, ctx.liquidCash || 0) + deposits;
  const growth = stocksValue + funds + crypto + warrants;
  const defensive = bonds + deposits + gold;
  const investable = growth + defensive;
  const debts = (ctx.debts || []).filter(d => Number(d.balance) > 0);
  const debtTotal = debts.reduce((s, d) => s + Number(d.balance), 0);
  const debtPayments = debts.reduce((s, d) => s + (Number(d.minPay) || 0), 0);
  const netWorth = Math.max(0, ctx.liquidCash || 0) + stocksValue + assets.reduce((s, a) => s + (a.valueHkd || 0), 0) - debtTotal;
  const emergencyTargetMonths = dependants > 0 || (incomeByCat.Freelance || 0) + (incomeByCat['Part Time'] || 0) > incomeSum * 0.5 ? 6 : 3;
  const emergencyMonths = essentials > 0 ? liquid / essentials : (liquid > 0 ? 12 : 0);
  const growthPct = investable > 0 ? (growth / investable) * 100 : 0;
  const targetGrowth = clamp(risk.growth - (age && age >= 50 ? 10 : 0) - (age && age >= 60 ? 10 : 0), 20, 90);
  const cryptoPct = investable > 0 ? (crypto / investable) * 100 : 0;
  const highDebts = debts.filter(d => Number(d.apr) >= 10).sort((a, b) => b.apr - a.apr);
  const dti = income > 0 ? (debtPayments / income) * 100 : 0;

  const recs = [];
  const add = (r) => recs.push(r);

  // 0. Not enough data yet
  if (tx.length < 8) {
    add({
      id: 'data', priority: 'medium', area: 'Data', title: 'Record a full month of income and spending',
      finding: `Only ${tx.length} transaction${tx.length === 1 ? '' : 's'} recorded, so the figures below lean on your profile (${profileIncome ? hkd(profileIncome) + ' monthly income' : 'income not set'}).`,
      actions: ['Add your salary as a monthly repeating income', 'Log daily spending for 30 days; the analysis updates automatically', 'Set regular bills (rent, phone, subscriptions) to repeat'],
      cta: { label: 'Add a record', action: 'record' }
    });
  }

  // 1. Spending more than earning
  if (income > 0 && expense > income) {
    add({
      id: 'deficit', priority: 'high', area: 'Spending', title: 'You are spending more than you earn',
      finding: `Average spending ${hkd(expense)}/month vs income ${hkd(income)}: a gap of ${hkd(expense - income)} each month.`,
      actions: topWantsCuts(monthlyByCat, 0.25).map(c => `Cut ${c.category} by 25% → saves ${hkd(c.saving)}/month`).concat(['Pause non-essential purchases until income covers spending']),
      impact: `Closing the gap stops ${hkd((expense - income) * 12)}/year of new debt or savings drain`,
      cta: { label: 'Review spending', tab: 'ledger' }
    });
  }

  // 2. High-interest debt
  if (highDebts.length) {
    const yearlyInterest = highDebts.reduce((s, d) => s + Number(d.balance) * Number(d.apr) / 100, 0);
    const first = highDebts[0];
    add({
      id: 'debt', priority: 'high', area: 'Debt',
      title: ctx.debtPlan?.stuck ? 'Your debt payments do not cover the interest' : `Pay off ${first.name} first (${first.apr}% APR)`,
      finding: `${highDebts.length} debt${highDebts.length > 1 ? 's' : ''} above 10% APR totalling ${hkd(highDebts.reduce((s, d) => s + Number(d.balance), 0))}, costing about ${hkd(yearlyInterest)} a year in interest${ctx.debtPlan?.debtFreeLabel ? `; on the current plan you are debt-free by ${ctx.debtPlan.debtFreeLabel}` : ''}.`,
      actions: [
        `Pay the minimum on every debt and put every extra dollar on ${first.name} (avalanche method)`,
        'Ask your bank about a lower-rate balance transfer or personal instalment loan to refinance card debt',
        'Stop new credit-card spending until the card is cleared, and set up autopay so you never miss a minimum',
        ...(income > 0 ? [`Adding ${hkd(round(income * 0.05, 100))}/month (5% of income) speeds this up noticeably`] : [])
      ],
      impact: `Every HK$10,000 repaid at ${first.apr}% saves ${hkd(100 * first.apr)}/year`,
      cta: { label: 'Open Debt Health', tab: 'debt' }
    });
  }

  // 3. Emergency fund
  if (essentials > 0 && emergencyMonths < emergencyTargetMonths) {
    const target = essentials * emergencyTargetMonths;
    const gap = target - liquid;
    add({
      id: 'emergency', priority: emergencyMonths < 1 ? 'high' : 'medium', area: 'Safety',
      title: `Build a ${emergencyTargetMonths}-month emergency fund`,
      finding: `Cash and deposits of ${hkd(liquid)} cover ${emergencyMonths.toFixed(1)} months of essential costs (${hkd(essentials)}/month). Target: ${hkd(target)}${dependants > 0 ? ' (6 months because you support dependants)' : ''}.`,
      actions: [
        `Set aside ${hkd(round(gap / 12, 100))}/month for 12 months (make it a monthly repeating transfer)`,
        'Keep it in a separate high-interest savings account or short time deposit, not in stocks',
        'Only use it for job loss, medical bills or urgent repairs'
      ],
      impact: `${hkd(gap)} still to go`,
      cta: { label: 'Add savings deposit', tab: 'portfolio' }
    });
  }

  // 4. Savings rate below 20%
  if (income > 0 && expense <= income && savingsRate < 20) {
    const gap = income * 0.2 - (income - expense);
    const cuts = topWantsCuts(monthlyByCat, 0.2);
    add({
      id: 'savings', priority: savingsRate < 10 ? 'high' : 'medium', area: 'Spending',
      title: `Raise your savings rate from ${pct(savingsRate)} to 20%`,
      finding: `You keep ${hkd(income - expense)} of ${hkd(income)} each month. Reaching the 20% benchmark means saving ${hkd(gap)} more per month.`,
      actions: [
        ...cuts.map(c => `Trim ${c.category} by 20% (now ${hkd(c.monthly)}/month) → ${hkd(c.saving)} saved`),
        'Pay yourself first: move the savings amount on payday before spending'
      ],
      impact: `${hkd(gap * 12)} more saved per year`,
      cta: { label: 'Set budget limits', action: 'budget' }
    });
  }

  // 5. Wants above 30%
  if (income > 0 && wants / income > 0.3) {
    const top = Object.entries(monthlyByCat).filter(([c]) => !NEEDS.includes(c)).sort((a, b) => b[1] - a[1]).slice(0, 3);
    add({
      id: 'wants', priority: 'medium', area: 'Spending', title: 'Lifestyle spending is above 30% of income',
      finding: `Wants take ${pct((wants / income) * 100)} of income (${hkd(wants)}/month). Biggest: ${top.map(([c, v]) => `${c} ${hkd(v)}`).join(', ')}.`,
      actions: [
        `Set a monthly cap of ${hkd(round(income * 0.3, 100))} for dining, shopping and entertainment combined`,
        `Try a no-spend weekend twice a month: about ${hkd(round(wants * 0.1, 10))} saved`,
        'Wait 48 hours before any non-essential purchase over HK$500'
      ],
      impact: `Bringing wants to 30% frees ${hkd(wants - income * 0.3)}/month`,
      cta: { label: 'See analytics', tab: 'dashboard' }
    });
  }

  // 6. Housing cost
  if (income > 0 && housing / income > 0.3) {
    add({
      id: 'housing', priority: housing / income > 0.4 ? 'high' : 'medium', area: 'Spending', title: 'Housing takes a large share of income',
      finding: `Rent of ${hkd(housing)}/month is ${pct((housing / income) * 100)} of income; the usual ceiling is 30% (${hkd(income * 0.3)}).`,
      actions: ['At renewal, compare rents in nearby districts or consider sharing', 'Ask about rent-included utilities or longer leases for a lower rate', 'If buying is the goal, size the down payment so the mortgage stays under 30–35% of income'],
      cta: { label: 'Review spending', tab: 'ledger' }
    });
  }

  // 7. Spending spikes this month
  const monthKey = now.toISOString().slice(0, 7);
  const thisMonth = {};
  tx.filter(t => t.type === 'expense' && t.category !== 'Investment' && String(t.date).startsWith(monthKey)).forEach(t => { thisMonth[t.category] = (thisMonth[t.category] || 0) + Number(t.amount); });
  const dayOfMonth = now.getDate();
  const spikes = Object.entries(thisMonth)
    .map(([c, v]) => ({ c, v, avg: monthlyByCat[c] || 0 }))
    .filter(s => s.avg > 0 && months >= 1.5 && s.v > s.avg * 1.4 && s.v - s.avg > 500)
    .sort((a, b) => (b.v - b.avg) - (a.v - a.avg)).slice(0, 2);
  if (spikes.length) {
    add({
      id: 'spike', priority: 'low', area: 'Spending', title: `${spikes.map(s => s.c).join(' and ')} spending is up this month`,
      finding: spikes.map(s => `${s.c}: ${hkd(s.v)} so far vs ${hkd(s.avg)} a typical month (+${pct(((s.v - s.avg) / s.avg) * 100)})`).join('; ') + (dayOfMonth < 25 ? `, and the month isn't over.` : '.'),
      actions: ['Check the ledger for one-off purchases you can return or avoid next time', `Hold ${spikes[0].c} to ${hkd(spikes[0].avg * 0.25)} a week for the rest of the month`],
      cta: { label: 'Open ledger', tab: 'ledger' }
    });
  }

  // 8. Subscriptions and repeating bills
  const repeatingSpend = (ctx.recurringRules || []).filter(r => r.active && r.template?.type === 'expense')
    .reduce((s, r) => s + monthlyEquivalent(Number(r.template.amount) || 0, r.frequency), 0);
  const subs = monthlyByCat.Subscriptions || 0;
  if (subs > 300 || repeatingSpend > income * 0.4) {
    add({
      id: 'subs', priority: 'low', area: 'Spending', title: 'Review your subscriptions and repeating bills',
      finding: `${subs > 0 ? `Subscriptions average ${hkd(subs)}/month. ` : ''}${repeatingSpend > 0 ? `Repeating expenses add up to about ${hkd(repeatingSpend)}/month.` : ''}`.trim(),
      actions: ['Cancel any streaming or app you have not opened in the last month', 'Switch monthly plans you keep to annual billing (often 15–20% cheaper)', 'Compare your phone and broadband plan at renewal'],
      impact: subs > 0 ? `Cutting a quarter saves ${hkd(subs * 0.25 * 12)}/year` : undefined,
      cta: { label: 'See repeating items', tab: 'ledger' }
    });
  }

  // 9. Weekly budget
  const weeklyMax = Number(p.weeklyMaxSpend) || 0;
  if (weeklyMax > 0 && ctx.weeklySpent > weeklyMax) {
    add({
      id: 'weekly', priority: 'medium', area: 'Spending', title: 'This week is over your spending limit',
      finding: `${hkd(ctx.weeklySpent)} spent vs your ${hkd(weeklyMax)} weekly limit (${hkd(ctx.weeklySpent - weeklyMax)} over).`,
      actions: ['Stick to essentials until Monday', 'If the limit is unrealistic, set it to your real average so alerts stay useful'],
      cta: { label: 'Adjust limits', action: 'budget' }
    });
  }

  const safeToInvest = emergencyMonths >= emergencyTargetMonths && highDebts.length === 0;

  // 10. Start investing
  if (growth < 1000 && safeToInvest && income > 0 && income > expense) {
    const monthly = round(Math.min(income - expense, income * 0.1), 100);
    const in10 = futureValue(0, monthly, risk.expectedReturn, 120);
    add({
      id: 'start', priority: 'medium', area: 'Investing', title: 'Your safety net is ready: start investing monthly',
      finding: `Emergency fund covered and no expensive debt. ${hkd(monthly)}/month at a ${pct(risk.expectedReturn * 100)} yearly return (${risk.label.toLowerCase()} assumption) could grow to about ${hkd(in10)} in 10 years.`,
      actions: [
        `Invest ${hkd(monthly)} automatically each month after payday (dollar-cost averaging)`,
        'Use a low-cost, diversified index fund as the core, e.g. Tracker Fund (2800.HK) or an S&P 500 ETF',
        'Practise first in Simulated Trading if you are new to buying stocks'
      ],
      cta: { label: 'Try Simulated Trading', tab: 'portfolio', view: 'simulation' }
    });
  }

  // 11. Allocation vs risk profile
  if (investable >= 20000 && Math.abs(growthPct - targetGrowth) > 15) {
    const move = Math.abs(growthPct - targetGrowth) / 100 * investable;
    const tooMuchGrowth = growthPct > targetGrowth;
    add({
      id: 'allocation', priority: 'medium', area: 'Investing',
      title: tooMuchGrowth ? 'Your investments are riskier than your profile' : 'Your investments are more cautious than your profile',
      finding: `Growth assets (stocks, funds, crypto) are ${pct(growthPct)} of ${hkd(investable)} invested. For a ${risk.label.toLowerCase()} investor${age ? ` aged ${age}` : ''} a typical mix is about ${pct(targetGrowth)} growth / ${pct(100 - targetGrowth)} defensive (bonds, deposits, gold).`,
      actions: tooMuchGrowth
        ? [`Direct new money into bonds or deposits until the mix is closer (about ${hkd(move)} to rebalance)`, 'Consider HK Government Silver Bonds / iBonds or short-term bond funds for the defensive part', 'Rebalance once or twice a year rather than reacting to daily moves']
        : [`Gradually move about ${hkd(move)} into a diversified equity index fund over 6–12 months`, 'Keep your emergency fund separate; only invest money you will not need for 5+ years'],
      cta: { label: 'View portfolio', tab: 'portfolio' }
    });
  }

  // 12. Crypto share
  if (crypto > 0 && cryptoPct > risk.cryptoCap) {
    add({
      id: 'crypto', priority: cryptoPct > risk.cryptoCap * 3 ? 'high' : 'medium', area: 'Investing', title: 'Crypto is a large slice of your investments',
      finding: `Crypto is ${pct(cryptoPct)} of investments (${hkd(crypto)}). For a ${risk.label.toLowerCase()} profile it is usually kept under ${risk.cryptoCap}%: prices can fall 50%+ in a year.`,
      actions: [`Trimming to ${risk.cryptoCap}% means taking about ${hkd(crypto - investable * risk.cryptoCap / 100)} off the table`, 'Hold crypto only on regulated platforms (SFC-licensed in Hong Kong) and enable 2FA', 'Never use borrowed money for crypto'],
      cta: { label: 'View assets', tab: 'portfolio' }
    });
  }

  // 12b. Warrants and CBBCs: leverage, time decay, knock-out
  const warrantList = assets.filter(a => a.type === 'warrant');
  if (warrantList.length) {
    const warrantCap = risk.id === 'aggressive' ? 10 : risk.id === 'moderate' ? 5 : 2;
    const warrantPct = investable > 0 ? (warrants / investable) * 100 : 100;
    const nearCall = warrantList.filter(a => a.warrant?.callDistancePct !== null && a.warrant?.callDistancePct !== undefined && a.warrant.callDistancePct <= 5);
    const expiring = warrantList.filter(a => a.warrant?.days !== null && a.warrant?.days !== undefined && a.warrant.days <= 30);
    if (nearCall.length || expiring.length || warrantPct > warrantCap) {
      const lines = [
        ...nearCall.map(a => `${a.name} is only ${Math.max(0, a.warrant.callDistancePct).toFixed(1)}% from its call level${a.warrant.S ? ` (underlying ${a.warrant.S}, call ${a.warrant.call})` : ''}`),
        ...expiring.map(a => `${a.name} ${a.warrant.days >= 0 ? `expires in ${a.warrant.days} days` : 'has expired'}${a.warrant.intrinsic !== null ? `; intrinsic value ${a.warrant.intrinsic.toFixed(3)} vs price ${a.warrant.W.toFixed(3)} per unit` : ''}`)
      ];
      add({
        id: 'warrants', priority: nearCall.length || expiring.length ? 'high' : 'medium', area: 'Investing',
        title: nearCall.length ? 'A CBBC is close to being called' : expiring.length ? 'Warrants are close to expiry' : 'Leveraged products are a large slice of your investments',
        finding: `${lines.length ? lines.join('; ') + '. ' : ''}Warrants and CBBCs are ${pct(warrantPct)} of investments (${hkd(warrants)}); for a ${risk.label.toLowerCase()} profile they are usually kept under ${warrantCap}%.`,
        actions: [
          ...(nearCall.length ? ['Decide now whether to sell: once the call level is touched the CBBC ends and you may get little or nothing back'] : []),
          ...(expiring.length ? ['Time value disappears fastest in the last month: sell, or accept that it may expire worthless'] : []),
          'Size each position so losing all of it would not hurt your plan',
          'Prefer warrants with longer expiry and lower gearing; check the issuer\'s implied volatility before buying',
          'Practise in Simulated Trading first if you are new to leveraged products'
        ],
        cta: { label: 'View warrants', tab: 'portfolio' }
      });
    }
  }

  // 13. Single-stock concentration
  const biggest = [...(ctx.stocks || [])].sort((a, b) => b.valueHkd - a.valueHkd)[0];
  if (biggest && stocksValue > 20000 && biggest.valueHkd / stocksValue > 0.3 && (ctx.stocks || []).length > 0) {
    add({
      id: 'concentration', priority: 'medium', area: 'Investing', title: `${biggest.symbol} is ${pct((biggest.valueHkd / stocksValue) * 100)} of your stocks`,
      finding: `A single company above 30% means one bad earnings report can move your whole portfolio.`,
      actions: [`Stop adding to ${biggest.symbol}; send new money to a broad index fund instead`, 'Consider trimming back towards 10–20% of your stock holdings'],
      cta: { label: 'View holdings', tab: 'portfolio' }
    });
  }

  // 14. Idle cash
  if (essentials > 0 && liquid > essentials * emergencyTargetMonths * 2 && highDebts.length === 0) {
    const idle = liquid - essentials * emergencyTargetMonths;
    add({
      id: 'idle', priority: 'low', area: 'Investing', title: 'You hold more cash than you need',
      finding: `${hkd(liquid)} in cash is about ${emergencyMonths.toFixed(0)} months of essentials; ${hkd(idle)} beyond your emergency fund is losing value to inflation.`,
      actions: ['Put money needed within 1–2 years in time deposits or Government bonds', 'Invest money not needed for 5+ years according to your risk profile', ...(Number(p.targetAmount) > 0 ? [`Or earmark it for your goal "${p.goal || 'savings goal'}"`] : [])],
      impact: `At 3.5% a time deposit earns about ${hkd(idle * 0.035)}/year on that amount`,
      cta: { label: 'Add deposit or bond', tab: 'portfolio' }
    });
  }

  // 15. Maturing bonds / deposits
  const soon = assets.filter(a => a.maturity && (new Date(a.maturity) - now) / 86400000 <= 60 && (new Date(a.maturity) - now) / 86400000 >= -7);
  if (soon.length) {
    add({
      id: 'maturity', priority: 'low', area: 'Investing', title: `${soon.length === 1 ? soon[0].name : `${soon.length} holdings`} mature${soon.length === 1 ? 's' : ''} soon`,
      finding: soon.map(a => `${a.name}: ${hkd(a.valueHkd)} on ${a.maturity}`).join('; '),
      actions: ['Decide now: roll over, move to a better rate, or use it for your goal', 'Compare current time-deposit and Government bond rates before the maturity date'],
      cta: { label: 'View assets', tab: 'portfolio' }
    });
  }

  // 16. Tax: TVC
  if (ctx.tax && ctx.tax.savedAtMax - ctx.tax.savedNow >= 500) {
    add({
      id: 'tvc', priority: 'medium', area: 'Tax', title: `Save up to ${hkd(ctx.tax.savedAtMax - ctx.tax.savedNow)} salaries tax with TVC`,
      finding: `Tax-Deductible Voluntary Contributions to MPF are deductible up to HK$60,000 a year. ${ctx.tax.tvcMonthly > 0 ? `You plan ${hkd(ctx.tax.tvcMonthly)}/month now.` : 'You are not using TVC yet.'}`,
      actions: ['Open a TVC account with your MPF trustee (or any trustee)', `Contribute ${hkd(5000)}/month, or a lump sum before 31 March, to use the full HK$60,000 allowance`, 'Pick a fund that matches your risk profile; the money stays invested until 65'],
      impact: `${hkd(ctx.tax.savedAtMax - ctx.tax.savedNow)} less tax per year`,
      cta: { label: 'Open MPF & Tax', tab: 'mpf' }
    });
  }

  // 17. Goal progress
  const target = Number(p.targetAmount) || 0;
  const years = Number(p.goalYears) || 0;
  const monthlySaving = Math.max(0, income - expense);
  if (target > 0) {
    const towardsGoal = Math.max(0, liquid - essentials * emergencyTargetMonths) + investable - deposits;
    const r = risk.expectedReturn;
    const m = monthsToTarget(towardsGoal, monthlySaving, target, r);
    const needed = years > 0 ? monthlyNeeded(towardsGoal, target, years * 12, r) : null;
    const behind = needed !== null ? needed > monthlySaving * 1.02 : m === Infinity || m > 120;
    if (towardsGoal < target) {
      add({
        id: 'goal', priority: behind ? 'medium' : 'low', area: 'Goal',
        title: behind ? `You are behind on "${p.goal || 'your goal'}"` : `On track for "${p.goal || 'your goal'}"`,
        finding: `${hkd(towardsGoal)} of ${hkd(target)} (${pct((towardsGoal / target) * 100)}). Saving ${hkd(monthlySaving)}/month at ${pct(r * 100)} a year, you reach it ${m === Infinity ? 'never at the current pace' : `in about ${formatMonths(m)}`}${needed !== null ? `; to hit it in ${years} year${years > 1 ? 's' : ''} you need ${hkd(needed)}/month` : ''}.`,
        actions: behind
          ? [needed !== null ? `Increase monthly saving by ${hkd(Math.max(0, needed - monthlySaving))}` : 'Set a target year in your profile so A.F.A. can work out the monthly amount', 'Automate the goal saving as a repeating transfer on payday', p.goal === 'HK Property Down Payment' ? 'For a flat, plan 10–30% down payment plus ~5% for stamp duty, fees and renovation' : 'Review the goal amount yearly as prices change']
          : ['Keep the automatic monthly saving going', 'Increase it with every pay rise to finish sooner'],
        cta: { label: 'Open Wealth Modeler', tab: 'simulator' }
      });
    }
  } else {
    add({
      id: 'goal-set', priority: 'low', area: 'Goal', title: 'Set a savings target',
      finding: 'Without a target amount and year, A.F.A. cannot tell whether you are on track.',
      actions: ['Open your profile and add a target amount and target year', 'Typical first goals: an emergency fund, a down payment, or HK$1M by 35'],
      cta: { label: 'Edit profile', action: 'profile' }
    });
  }

  // 18. Protection for dependants
  if (dependants > 0 && sumType('insurance') === 0) {
    add({
      id: 'protection', priority: 'medium', area: 'Safety', title: 'Protect the people who depend on you',
      finding: `You support ${dependants} dependant${dependants > 1 ? 's' : ''} but have no insurance recorded.`,
      actions: [`A common guide is life cover of about 10× annual income (${income > 0 ? hkd(income * 12 * 10) : 'set income in profile'})`, 'Term life is usually far cheaper than savings-type policies for pure protection', 'Check medical cover too (e.g. a VHIS plan)'],
      cta: { label: 'Record insurance', tab: 'portfolio' }
    });
  }

  // 19. Simulator check-in
  if (ctx.paper && (ctx.paper.trades || 0) >= 3) {
    const ret = ((ctx.paper.equity - ctx.paper.startingCash) / ctx.paper.startingCash) * 100;
    if (ret < -10) {
      add({
        id: 'paper', priority: 'low', area: 'Investing', title: `Simulated portfolio is down ${pct(-ret)}`,
        finding: 'A good moment to learn before real money is involved.',
        actions: ['Look at which trades lost the most and why', 'Try a simple index-fund strategy in the simulator and compare after 3 months'],
        cta: { label: 'Open simulator', tab: 'portfolio', view: 'simulation' }
      });
    }
  }

  const order = { high: 0, medium: 1, low: 2 };
  recs.sort((a, b) => order[a.priority] - order[b.priority]);

  // ---- Scores (0–100) ----
  const pillars = [
    { id: 'spending', label: 'Spending', score: income > 0 ? clamp(40 + savingsRate * 2 - Math.max(0, (wants / income) * 100 - 30) * 1.5 - Math.max(0, (housing / income) * 100 - 30) * 1.5) : 50, note: income > 0 ? `${pct(savingsRate)} saved` : 'no income yet' },
    { id: 'safety', label: 'Safety net', score: clamp((emergencyMonths / emergencyTargetMonths) * 100), note: `${emergencyMonths.toFixed(1)} / ${emergencyTargetMonths} months` },
    { id: 'debt', label: 'Debt', score: debts.length === 0 ? 100 : clamp(100 - dti * 2 - highDebts.length * 15 - (ctx.debtPlan?.stuck ? 40 : 0)), note: debts.length ? `${pct(dti)} of income on repayments` : 'debt-free' },
    { id: 'investing', label: 'Investing', score: investable <= 0 ? (safeToInvest ? 30 : 50) : clamp(100 - Math.abs(growthPct - targetGrowth) * 1.5 - Math.max(0, cryptoPct - risk.cryptoCap) * 2), note: investable > 0 ? `${pct(growthPct)} growth vs ${pct(targetGrowth)} target` : 'not started' },
    { id: 'goal', label: 'Goal', score: target > 0 ? clamp(((Math.max(0, liquid - essentials * emergencyTargetMonths) + investable - deposits) / target) * 100) : 40, note: target > 0 ? `target ${hkd(target)}` : 'no target set' }
  ].map(x => ({ ...x, score: Math.round(x.score) }));
  const overall = Math.round(pillars.reduce((s, x) => s + x.score, 0) / pillars.length);

  return {
    overall,
    pillars,
    recommendations: recs,
    snapshot: {
      age, risk, dependants, income, expense, investing, savingsRate, needs, wants, housing, essentials,
      liquid, emergencyMonths, emergencyTargetMonths, netWorth, investable, growthPct, targetGrowth, cryptoPct,
      debtTotal, dti, months, monthlyByCat,
      allocation: [
        { name: 'Stocks', value: stocksValue }, { name: 'Funds', value: funds }, { name: 'Crypto', value: crypto }, { name: 'Warrants & CBBCs', value: warrants },
        { name: 'Bonds', value: bonds }, { name: 'Cash & Deposits', value: liquid }, { name: 'Gold', value: gold },
        { name: 'Property', value: property }, { name: 'Insurance, MPF & Other', value: other }
      ].filter(a => a.value > 0)
    }
  };
}

function topWantsCuts(monthlyByCat, share) {
  return Object.entries(monthlyByCat)
    .filter(([c, v]) => WANTS.includes(c) && v > 200)
    .sort((a, b) => b[1] - a[1]).slice(0, 2)
    .map(([category, monthly]) => ({ category, monthly, saving: Math.round(monthly * share) }));
}

function monthlyEquivalent(amount, frequency) {
  return { daily: amount * 30.4, weekly: amount * 4.35, biweekly: amount * 2.17, monthly: amount, yearly: amount / 12 }[frequency] ?? amount;
}

function futureValue(start, monthly, r, months) {
  const i = r / 12;
  let bal = start;
  for (let m = 0; m < months; m++) bal = bal * (1 + i) + monthly;
  return bal;
}

function formatMonths(m) {
  if (m < 12) return `${m} month${m === 1 ? '' : 's'}`;
  const y = Math.floor(m / 12), rest = m % 12;
  return `${y} year${y > 1 ? 's' : ''}${rest ? ` ${rest} month${rest > 1 ? 's' : ''}` : ''}`;
}
