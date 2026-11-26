# Nightly company data

`.github/workflows/fundamentals.yml` runs `fetch.mjs` every night at 05:30 Hong Kong time, and you can also start it from the Actions tab with **Run workflow**. It writes `public/data/fundamentals.json`, and the deploy workflow then republishes the site.

| Field | Meaning |
| --- | --- |
| `forwardEps`, `trailingEps` | Analysts' next-12-month EPS and the last 12 months' EPS, in the trading currency |
| `fcfPerShare` | Levered free cash flow ÷ shares (free cash flow to equity) |
| `dps` | Dividend per share (annual rate) |
| `netDebtPerShare`, `bookPerShare`, `beta` | Inputs for steps 6 and 7 (discount rate, peer multiples) |
| `trailingPE`, `forwardPE`, `priceToBook`, `evToEbitda` | Multiples for peer comparison |
| `growthNextYear`, `growth5y`, `earningsGrowth` | Analysts' growth estimates (fractions, e.g. 0.12 = 12%) |
| `asOf` | The night this record was last fetched successfully |

**Risk-free rate:** `market.riskFree` holds the US 10-year Treasury yield (^TNX). The app uses it for both markets, because the HKD is pegged to the USD. The CAPM required return is risk-free + adjusted beta × equity risk premium. The premium is 4.5% for the US and 5.5% for HK (`EQUITY_PREMIUM` in `src/lib/fundamentals.js`). Beta is pulled a third of the way towards 1.

**Coverage:** the 100 stocks in `research/universe.json`, plus any symbols listed in `extra-symbols.json`. Other stocks fall back to the old manual inputs in the app.

**Currency:** HK-listed mainland companies often report in CNY or USD. The job converts per-share figures into the trading currency using Yahoo's FX rates. It decides which currency Yahoo's EPS fields are in by checking them against the price-based P/E (see `parse.mjs`; `parse.test.mjs` covers this).

**Reliability:** Yahoo's endpoint is unofficial. It can rate-limit (HTTP 429) or change without notice. When a symbol fails, the job keeps that symbol's previous record. The app tells users the data is unofficial and should be checked against the company's results.
