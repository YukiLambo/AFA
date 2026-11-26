// Trading costs for Hong Kong and US stocks (step 12), used by paper trading and the research backtests.
// Figures are the published rates as of late 2026 plus typical online-broker charges; brokers differ, so the
// broker lines are assumptions you can change here. Each trade also pays half the bid-ask spread, estimated as
// half of one price step (tick): liquid large caps usually trade one tick wide.

export const COSTS = {
  HK: {
    stampDuty: 0.001,        // 0.1% of value, buyer and seller each, rounded up to the next HK$1 (IRD)
    tradingFee: 0.0000565,   // HKEX trading fee 0.00565%
    sfcLevy: 0.000027,       // SFC transaction levy 0.0027%
    afrcLevy: 0.0000015,     // AFRC levy 0.00015%
    settlement: { rate: 0.00002, min: 2, max: 100 }, // CCASS settlement, charged by most brokers
    broker: { rate: 0.0003, min: 3 }                  // assumption: online broker 0.03%, minimum HK$3
  },
  US: {
    secFeeSell: 0.0000278,   // SEC Section 31 fee on sales (rate changes each fiscal year)
    tafPerShareSell: 0.000166, tafMax: 8.3, // FINRA trading activity fee on sales
    broker: { rate: 0, min: 0 }               // assumption: commission-free broker
  }
};

// HKEX spread table: the price step for a given price
export function hkTick(price) {
  const T = [[0.25, 0.001], [0.5, 0.005], [10, 0.01], [20, 0.02], [100, 0.05], [200, 0.1], [500, 0.2], [1000, 0.5], [2000, 1], [5000, 2]];
  for (const [upTo, tick] of T) if (price < upTo) return tick;
  return 5;
}
export const tickOf = (market, price) => (market === 'HK' ? hkTick(price) : price < 1 ? 0.0001 : 0.01);

// Costs of one order. `value` and the result are in the trading currency. side: 'buy' | 'sell'.
// Returns explicit fees (paid in cash) and the spread cost (paid through a worse fill price).
// stampExempt: HK warrants, CBBCs and ETFs pay no stamp duty.
export function tradeCost({ market, side, price, shares, stampExempt = false }) {
  const value = price * shares;
  const lines = [];
  if (market === 'HK') {
    const C = COSTS.HK;
    if (!stampExempt) lines.push(['Stamp duty 0.1%', Math.ceil(value * C.stampDuty)]);
    lines.push(['Exchange fee and levies', value * (C.tradingFee + C.sfcLevy + C.afrcLevy)]);
    lines.push(['Settlement', Math.min(C.settlement.max, Math.max(C.settlement.min, value * C.settlement.rate))]);
    lines.push(['Broker commission', Math.max(C.broker.min, value * C.broker.rate)]);
  } else {
    const C = COSTS.US;
    if (C.broker.rate || C.broker.min) lines.push(['Broker commission', Math.max(C.broker.min, value * C.broker.rate)]);
    if (side === 'sell') {
      lines.push(['SEC fee', value * C.secFeeSell]);
      lines.push(['FINRA fee', Math.min(C.tafMax, shares * C.tafPerShareSell)]);
    }
  }
  const fees = lines.reduce((s, [, v]) => s + v, 0);
  const halfSpread = tickOf(market, price) / 2;
  return { fees, lines, halfSpread, spreadCost: halfSpread * shares, total: fees + halfSpread * shares, pct: value > 0 ? (fees + halfSpread * shares) / value : 0 };
}

// Cost of a buy plus a later sell, as a share of the trade value: what a backtest should subtract per round trip.
// `value` sets the size for the minimum charges (default HK$100,000 / US$10,000).
export function roundTripPct(market, price, value = market === 'HK' ? 100000 : 10000) {
  const shares = value / price;
  return tradeCost({ market, side: 'buy', price, shares }).pct + tradeCost({ market, side: 'sell', price, shares }).pct;
}
