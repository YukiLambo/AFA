// Turns one Yahoo Finance quoteSummary result into the compact record the app reads (public/data/fundamentals.json).
// Pure function, no network, so it can be tested with a fixture (see parse.test.mjs).
//
// Currency: HK-listed mainland companies often report in CNY or USD while trading in HKD. Every per-share figure
// is converted into the trading currency. Yahoo is not consistent about which currency its EPS fields use, so the
// EPS currency is decided by checking which reading matches the price-based trailing P/E.
const raw = (o) => (o && typeof o === 'object' ? (Number.isFinite(o.raw) ? o.raw : null) : Number.isFinite(o) ? o : null);
const r4 = (x) => (Number.isFinite(x) ? Math.round(x * 1e4) / 1e4 : null);

export function parseQuoteSummary(symbol, result, fxRate = () => null) {
  if (!result) return null;
  const k = result.defaultKeyStatistics || {}, f = result.financialData || {}, s = result.summaryDetail || {};
  const p = result.price || {}, prof = result.assetProfile || {}, trend = result.earningsTrend?.trend || [];
  const currency = p.currency || s.currency || null;
  const finCur = f.financialCurrency || currency;
  const fx = finCur && currency && finCur !== currency ? fxRate(finCur, currency) : 1;
  if (!Number.isFinite(fx)) return { symbol, error: `no FX rate ${finCur}→${currency}` };

  const price = raw(f.currentPrice) ?? raw(p.regularMarketPrice);
  const shares = raw(k.sharesOutstanding) ?? raw(p.sharesOutstanding);
  const trailingPE = raw(s.trailingPE);
  // EPS currency check: price / trailingPE is in the trading currency
  let epsFx = fx;
  const tEps = raw(k.trailingEps);
  if (price && trailingPE && tEps && fx !== 1) {
    const implied = price / trailingPE;
    epsFx = Math.abs(tEps - implied) <= Math.abs(tEps * fx - implied) ? 1 : fx;
  }
  const growth = (period) => raw(trend.find(t => t.period === period)?.growth);
  const fcf = raw(f.freeCashflow), debt = raw(f.totalDebt), cash = raw(f.totalCash);

  return {
    symbol, currency, financialCurrency: finCur, fx: r4(fx),
    name: p.longName || p.shortName || null,
    sector: prof.sector || null, industry: prof.industry || null,
    price: r4(price),
    trailingEps: r4(tEps !== null ? tEps * epsFx : null),
    forwardEps: r4(raw(k.forwardEps) !== null ? raw(k.forwardEps) * epsFx : null),
    dps: r4(raw(s.dividendRate) ?? raw(s.trailingAnnualDividendRate)),
    fcfPerShare: r4(fcf !== null && shares ? (fcf * fx) / shares : null),
    netDebtPerShare: r4(debt !== null && cash !== null && shares ? ((debt - cash) * fx) / shares : null),
    bookPerShare: r4(raw(k.bookValue) !== null ? raw(k.bookValue) * epsFx : null),
    beta: r4(raw(k.beta) ?? raw(s.beta)),
    trailingPE: r4(trailingPE), forwardPE: r4(raw(s.forwardPE) ?? raw(k.forwardPE)),
    priceToBook: r4(raw(k.priceToBook)), evToEbitda: r4(raw(k.enterpriseToEbitda)),
    growthNextYear: r4(growth('+1y')), growth5y: r4(growth('+5y')), earningsGrowth: r4(raw(f.earningsGrowth)),
    analystTarget: r4(raw(f.targetMeanPrice)), analystCount: raw(f.numberOfAnalystOpinions)
  };
}
