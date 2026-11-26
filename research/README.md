# A.F.A. research: re-runnable studies

This folder holds the scripts and a fixed price snapshot behind the evidence numbers the app shows. Before this
folder, those numbers (`EVIDENCE`, `CALIB`, `STUDY3` in `src/lib/horizonModel.js` and `STUDY2` in
`src/lib/indicators.js`) were constants with no code to reproduce them.

The scripts import the app's own indicator and pattern code, so the study and the app always use the same
definitions.

## Re-run

Needs Node 18 or newer. There are no extra packages.

```bash
# 1. Re-run the studies on the committed snapshot (about 10 seconds each)
node research/study3.mjs      # 2-week / 6-month outlook evidence (horizonModel.js)
node research/study2.mjs      # 60-day timing score (indicators.js, used by the trade plan)

# 2. Optional: download a fresh snapshot (about 5 minutes; creates data/snapshot-<date>/)
node research/fetch_snapshot.mjs --end 2026-11-25
#    Behind a proxy on Node 22: NODE_USE_ENV_PROXY=1 node research/fetch_snapshot.mjs

# Use a specific snapshot (the default is the newest folder in data/)
AFA_SNAPSHOT=snapshot-2026-11-25 node research/study3.mjs
```

Each study writes `results/<study>.json` (the full numbers) and `results/<study>-compare.md` (the re-run
side by side with what the app has hard-coded).

## Files

| Path | What it is |
| --- | --- |
| `universe.json` | 60 HK and 40 US large caps, plus the Hang Seng Index and S&P 500 |
| `fetch_snapshot.mjs` | Downloads daily prices from Tencent's public feed (the app's own source) |
| `data/snapshot-2026-11-25/prices.csv.gz` | Raw daily OHLCV from 2 Jan 2018 to 25 Nov 2026, 102 series, 223,145 rows |
| `data/snapshot-2026-11-25/manifest.json` | Source, date range, SHA-256 and the row count for each symbol |
| `corporate_actions.json` | Bonus issues the automatic split rule misses |
| `lib/data.mjs` | Loads a snapshot and applies the app's split adjustment |
| `lib/stats.mjs` | Mean, t-statistic, Spearman rank correlation, quantiles |
| `study3.mjs` | Re-runs the evidence behind the 2-week and 6-month outlook |
| `study2.mjs` | Re-runs the evidence behind the timing score |
| `results/` | Output of the last run |

## How close the re-run is to the app's numbers (snapshot 2026-11-25)

**Study 3** reproduces the original closely.

- Per-state evidence has a rank correlation of 0.86–0.94 with the app's numbers. 84–89 of 98 states have the same sign.
- The composite score's IC matches to within about 0.01 for the 10-day horizon and 0.02–0.04 for 120 days.
- The verdict (lean up, lean down or no edge) changes for 17 of 98 states. Most are borderline cases that sit near the cut-offs.
- The quintile spreads are about half the size the app uses. For 120 days, the top quintile is +2.5% versus +5.0%. The app therefore overstates how large the edge is.

**Study 2** reproduces the direction of every result.

- The timing score's test IC is 0.165 versus 0.19 in HK and 0.125 versus 0.128 in the US.
- Classic trend readings are negative in both versions. They are a little weaker in the re-run.

The full tables are in `results/study3-compare.md` and `results/study2-compare.md`. The app's constants are
**not** changed in this step. They will be updated once the method fixes below are in.

## Known issues (fixed in the next steps)

These are reproduced on purpose here, so that each later change can be measured against this baseline.

1. **Look-ahead "normal" return.** Excess return is measured against the stock's average over the whole period, including days after the signal. Step 2 measures it against the Hang Seng or S&P 500 over the same days.
2. **Overlapping returns.** Daily samples of 10- and 120-day returns overlap, so plain t-statistics overstate certainty. For 120 days the overstatement is several times. Step 3 uses Newey–West t-statistics.
3. **Multiple testing.** About 100 states are tested, so some will pass by chance. Step 3 adds Benjamini–Hochberg false-discovery control.
4. **One fixed split.** The model is tuned once (2019–2023) and tested once. Step 4 refits it every 6 months.
5. **Survivorship.** The universe is today's large caps. The app shrinks effects by 25% for this; that factor is a guess and is not measured.
6. **Prices are split-adjusted but not dividend-adjusted.** Tencent's feed now returns unadjusted prices even when `qfq` is requested. High-dividend stocks (banks, utilities, telecoms) show a price drop on each ex-dividend date. This can make some "oversold" readings look more common than they are.

## Data notes

- Source: `web.ifzq.gtimg.cn/appstock/app/fqkline/get`, the same endpoint the app uses for history. The feed has no service-level agreement. Re-downloads can differ slightly if Tencent revises its history, so studies run on the committed snapshot.
- Stock splits are detected with the app's rule from `adjustSplits` in `src/App.jsx`.
- **App bug found:** in `adjustSplits` the 1.5-for-1 branch sits inside `ratio >= 1.8`, so it can never run. Bonus issues in that range are missed: Sino Biopharm (2018 and 2020) and CSPC (2020). The research loader handles them through `corporate_actions.json`. The live app still shows a false one-day crash of about 33–40% in those charts.
