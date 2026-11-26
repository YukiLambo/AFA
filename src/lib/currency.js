// Preferred currency: formatting and live FX conversion.
// Personal amounts (transactions, income, budgets, debts, goals) are recorded in the user's home
// currency. Market prices arrive in their own currency (HKD, USD, ...) and are converted with
// live rates. Rates are quoted as units per 1 USD.
import { createContext, useContext } from 'react';

export const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese yen', decimals: 0 },
  { code: 'CNY', symbol: 'CN¥', name: 'Chinese yuan' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong dollar' },
  { code: 'TWD', symbol: 'NT$', name: 'New Taiwan dollar' },
  { code: 'KRW', symbol: '₩', name: 'South Korean won', decimals: 0 },
  { code: 'SGD', symbol: 'S$', name: 'Singapore dollar' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian ringgit' },
  { code: 'THB', symbol: '฿', name: 'Thai baht' },
  { code: 'PHP', symbol: '₱', name: 'Philippine peso' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian rupiah', decimals: 0 },
  { code: 'VND', symbol: '₫', name: 'Vietnamese dong', decimals: 0 },
  { code: 'INR', symbol: '₹', name: 'Indian rupee' },
  { code: 'AUD', symbol: 'A$', name: 'Australian dollar' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian dollar' },
  { code: 'MXN', symbol: 'MX$', name: 'Mexican peso' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian real' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss franc' },
  { code: 'SEK', symbol: 'kr', name: 'Swedish krona' },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian krone' },
  { code: 'DKK', symbol: 'kr', name: 'Danish krone' },
  { code: 'PLN', symbol: 'zł', name: 'Polish złoty' },
  { code: 'TRY', symbol: '₺', name: 'Turkish lira' },
  { code: 'AED', symbol: 'AED', name: 'UAE dirham' },
  { code: 'SAR', symbol: 'SAR', name: 'Saudi riyal' },
  { code: 'ZAR', symbol: 'R', name: 'South African rand' },
  { code: 'NGN', symbol: '₦', name: 'Nigerian naira' },
  { code: 'MOP', symbol: 'MOP$', name: 'Macanese pataca' }
];
const BY_CODE = Object.fromEntries(CURRENCIES.map(c => [c.code, c]));
export const currencyInfo = (code) => BY_CODE[code] || { code, symbol: code ? `${code} ` : '', name: code };
export const isSupportedCurrency = (code) => !!BY_CODE[code];

// Rough units per USD, used only until live rates load (or if every rate source is down).
export const FALLBACK_RATES = {
  USD: 1, EUR: 0.92, GBP: 0.79, JPY: 150, CNY: 7.2, HKD: 7.8, TWD: 32, KRW: 1380, SGD: 1.34, MYR: 4.5,
  THB: 35, PHP: 57, IDR: 16000, VND: 25000, INR: 84, AUD: 1.52, NZD: 1.66, CAD: 1.38, MXN: 18.5, BRL: 5.6,
  CHF: 0.88, SEK: 10.6, NOK: 10.8, DKK: 6.9, PLN: 4.0, TRY: 34, AED: 3.67, SAR: 3.75, ZAR: 18, NGN: 1550, MOP: 8.05
};

// Guess a sensible default from the browser's locale (e.g. en-GB -> GBP, zh-HK -> HKD).
const REGION_CURRENCY = {
  US: 'USD', GB: 'GBP', JP: 'JPY', CN: 'CNY', HK: 'HKD', TW: 'TWD', KR: 'KRW', SG: 'SGD', MY: 'MYR', TH: 'THB',
  PH: 'PHP', ID: 'IDR', VN: 'VND', IN: 'INR', AU: 'AUD', NZ: 'NZD', CA: 'CAD', MX: 'MXN', BR: 'BRL', CH: 'CHF',
  SE: 'SEK', NO: 'NOK', DK: 'DKK', PL: 'PLN', TR: 'TRY', AE: 'AED', SA: 'SAR', ZA: 'ZAR', NG: 'NGN', MO: 'MOP',
  DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', IE: 'EUR', PT: 'EUR', BE: 'EUR', AT: 'EUR', FI: 'EUR', GR: 'EUR'
};
export function guessCurrency() {
  try {
    const langs = (typeof navigator !== 'undefined' && (navigator.languages || [navigator.language])) || [];
    for (const l of langs) {
      const region = (l || '').split('-')[1]?.toUpperCase();
      if (region && REGION_CURRENCY[region]) return REGION_CURRENCY[region];
    }
  } catch { /* ignore */ }
  return 'USD';
}

// Convert between any two currencies with a units-per-USD table.
export function convert(amount, from, to, rates = FALLBACK_RATES) {
  const n = Number(amount) || 0;
  if (!from || !to || from === to) return n;
  const f = rates[from] || FALLBACK_RATES[from];
  const t = rates[to] || FALLBACK_RATES[to];
  if (!f || !t) return n;
  return (n / f) * t;
}

// "HK$1,234.50", "−€12", "+$3.4k". Options: dp (decimals), signed (+/−), compact (1.2k / 3.4M).
export function formatMoney(n, code = 'USD', { dp, signed = false, compact = false, space = false } = {}) {
  const v = Number(n) || 0;
  const info = currencyInfo(code);
  const decimals = dp ?? (info.decimals ?? 2);
  const abs = Math.abs(v);
  let body;
  if (compact && abs >= 1000) {
    const [div, suffix] = abs >= 1e9 ? [1e9, 'B'] : abs >= 1e6 ? [1e6, 'M'] : [1e3, 'k'];
    const x = abs / div;
    body = `${x.toLocaleString('en-US', { maximumFractionDigits: x >= 100 ? 0 : 1 })}${suffix}`;
  } else {
    body = abs.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }
  const sign = v < 0 ? '−' : signed && v > 0 ? '+' : '';
  return `${sign}${info.symbol}${space ? ' ' : ''}${body}`;
}

// --- Live rates (browser-side; both sources allow cross-origin requests) ---
const CACHE_KEY = 'afa.fxRates.v1';
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

function readCache() {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (c && c.rates && c.rates.USD === 1) return c;
  } catch { /* storage unavailable */ }
  return null;
}

async function getJson(url, ms = 8000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally { clearTimeout(timer); }
}

const SOURCES = [
  async () => {
    const j = await getJson('https://open.er-api.com/v6/latest/USD');
    if (j.result !== 'success' || !j.rates) throw new Error('bad payload');
    return j.rates;
  },
  async () => {
    const j = await getJson('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json');
    if (!j.usd) throw new Error('bad payload');
    return Object.fromEntries(Object.entries(j.usd).map(([k, v]) => [k.toUpperCase(), v]));
  }
];

// Returns { rates, at, live }. Uses a 6-hour cache, then each source in turn, then the fallback table.
export async function loadFxRates({ force = false } = {}) {
  const cached = readCache();
  if (!force && cached && Date.now() - cached.at < MAX_AGE_MS) return { ...cached, live: true };
  for (const source of SOURCES) {
    try {
      const raw = await source();
      const rates = { ...FALLBACK_RATES };
      for (const [k, v] of Object.entries(raw)) if (Number(v) > 0) rates[k] = Number(v);
      rates.USD = 1;
      const out = { rates, at: Date.now() };
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(out)); } catch { /* ignore */ }
      return { ...out, live: true };
    } catch { /* try the next source */ }
  }
  if (cached) return { ...cached, live: true };
  return { rates: { ...FALLBACK_RATES }, at: null, live: false };
}
export const cachedFxRates = () => readCache()?.rates || { ...FALLBACK_RATES };

// Money helpers bound to the home currency, shared with child components through context.
export function makeMoney(currency = 'USD', rates = FALLBACK_RATES) {
  const info = currencyInfo(currency);
  const toHome = (amount, from) => convert(amount, from || currency, currency, rates);
  return {
    currency,
    symbol: info.symbol,
    rates,
    toHome,
    convert: (amount, from, to) => convert(amount, from, to, rates),
    fmt: (n, opts) => formatMoney(n, currency, opts),
    // whole units, e.g. totals and budgets
    fmt0: (n, opts) => formatMoney(Math.round(Number(n) || 0), currency, { dp: 0, ...opts }),
    // whole units when the amount is whole, otherwise cents (e.g. 45 -> $45, 45.5 -> $45.50)
    fmtAuto: (n, opts) => { const v = Number(n) || 0; return formatMoney(v, currency, { dp: Math.abs(v - Math.round(v)) < 0.005 ? 0 : undefined, ...opts }); },
    // Hong Kong MPF / salaries-tax figures, always in HK$
    fmtHK: (n, opts) => formatMoney(Math.round(Number(n) || 0), 'HKD', { dp: 0, ...opts }),
    // price in its own currency (a HK share in HK$, a US share in $)
    fmtIn: (n, code, opts) => formatMoney(n, code || currency, opts),
    axis: (v) => formatMoney(v, currency, { compact: true, dp: 0 })
  };
}

export const MoneyContext = createContext(makeMoney('USD'));
export const useMoney = () => useContext(MoneyContext);

// Round a converted amount to a friendly figure for examples and nudges (7,812 -> 8,000; 128 -> 130).
export function niceAmount(n) {
  const v = Math.abs(Number(n) || 0);
  if (v < 10) return Math.max(1, Math.round(v));
  const mag = Math.pow(10, Math.floor(Math.log10(v)) - 1);
  return Math.round(v / mag) * mag;
}
