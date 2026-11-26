# Study 3 re-run (market method) vs the numbers in the app

Excess = return minus the index (HSI / S&P 500) over the same days, minus the average of that for all stock-days in the cell; hit change = how much more often the stock beat the index than the average stock-day.

Snapshot: `snapshot-2026-11-25` · 60 HK + 40 US stocks · tuning 2019-10-01 to 2023-06-30, test from 2023-07-01

## Agreement with `EVIDENCE` (all states)

| Column | Rank correlation with app | Same sign |
| --- | --- | --- |
| Excess 10d | 1 | 98 of 98 |
| Hit change 10d | 1 | 98 of 98 |
| Excess 120d | 1 | 98 of 98 |
| Hit change 120d | 1 | 98 of 98 |

States whose app verdict (lean up / lean down / no edge) would change with the re-run numbers: 14 of 98.

| State | App 10d | Re-run 10d | App 120d | Re-run 120d |
| --- | --- | --- | --- | --- |
| farBelow50 | 0.42 / 2.3 / 3 | 0.42 / 2.3 / 0 | 0.96 / -1.2 / 2 | 0.96 / -1.2 / 0 |
| aboveSma200 | 0.09 / 0.7 / 2 | 0.09 / 0.7 / 0 | 1.62 / 3.3 / 4 | 1.62 / 3.3 / 0 |
| golden | 0.1 / 0.6 / 1 | 0.1 / 0.6 / 0 | 1.63 / 3.3 / 3 | 1.63 / 3.3 / 0 |
| rsi14gt70 | 0.45 / 3.2 / 4 | 0.45 / 3.2 / 1 | 2.87 / 3.9 / 2 | 2.87 / 3.9 / 1 |
| adxUp | 0.25 / 2 / 4 | 0.25 / 2 / 0 | 1.04 / 1.9 / 2 | 1.04 / 1.9 / 0 |
| mom12Strong | 0.24 / 1.2 / 3 | 0.24 / 1.2 / 1 | 3.77 / 6 / 4 | 3.77 / 6 / 1 |
| near52High | 0.24 / 2.7 / 2 | 0.24 / 2.7 / 0 | 1.48 / 4.3 / 2 | 1.48 / 4.3 / 0 |
| lowVol | 0.08 / 0.3 / 2 | 0.08 / 0.3 / 0 | 2.31 / 4.6 / 3 | 2.31 / 4.6 / 1 |
| highVol | -0.19 / -1.4 / 3 | -0.19 / -1.4 / 2 | -1.29 / -5.3 / 2 | -1.29 / -5.3 / 1 |
| new55High | 0.19 / 1.8 / 2 | 0.19 / 1.8 / 0 | 2.07 / 3.5 / 3 | 2.07 / 3.5 / 0 |
| eveningStar | -0.2 / -2.4 / 1 | -0.2 / -2.4 / 0 | 2.83 / 3.1 / 2 | 2.83 / 3.1 / 3 |
| bearFlag | 0.36 / 2.1 / 0 | 0.36 / 2.1 / 0 | -1.99 / -4.4 / 2 | -1.99 / -4.4 / 1 |
| ascTriangle | 0.12 / 2.4 / 2 | 0.12 / 2.4 / 0 | 1.29 / 4.1 / 3 | 1.29 / 4.1 / 0 |
| rsiBearDiv | 0.2 / 1.9 / 3 | 0.2 / 1.9 / 0 | 2.18 / 4 / 2 | 2.18 / 4 / 1 |

## Statistical strength

Newey–West t-statistics on daily averages (lags = horizon − 1). Median plain t ÷ Newey–West t: 1.6× at 10 days, 2.1× at 120 days, which is how much the plain t overstated certainty.

States that pass Benjamini–Hochberg false-discovery control at q ≤ 0.1 (combined over the four cells): **1 of 98** at 10 days, **9 of 98** at 120 days.

- 10 days: doubleTop (-0.47%, q 0.042)
- 120 days: eveningStar (+2.83%, q 0), new20Low (-0.91%, q 0), descTriangle (-1.59%, q 0), baseBreakdown (-2.11%, q 0.002), bearFlag (-1.99%, q 0.006), spinTopAfterUp (+2.79%, q 0.026), rsiReclaim30 (-0.93%, q 0.042), belowSma200 (-1.81%, q 0.082), new55Low (-0.84%, q 0.095)

## Composite outlook score

| | App | Re-run |
| --- | --- | --- |
| 10d IC, HK train / test | 0.007 / 0.005 | 0.007 / 0.005 |
| 10d IC, US train / test | 0.047 / 0.024 | 0.047 / 0.024 |
| 120d IC, HK train / test | -0.045 / 0.107 | -0.045 / 0.107 |
| 120d IC, US train / test | 0.097 / 0.131 | 0.097 / 0.131 |
| Stocks with positive test IC, 10d HK / US | 31 of 60 / 21 of 40 | 31 of 60 / 21 of 40 |
| Stocks with positive test IC, 120d HK / US | 40 of 60 / 30 of 40 | 40 of 60 / 30 of 40 |
| 10d quintile excess % (low → high) | 0.37, -0.07, -0.15, -0.18, 0.03 | 0.37, -0.07, -0.15, -0.18, 0.03 |
| 120d quintile excess % (low → high) | 3.23, -0.23, -0.6, -0.97, -1.43 | 3.23, -0.23, -0.6, -0.97, -1.43 |

IC here is measured on returns relative to the index. Still open: one fixed tuning split (step 4).
