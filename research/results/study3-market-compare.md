# Study 3 re-run (market method) vs the numbers in the app

Excess = return minus the index (HSI / S&P 500) over the same days, minus the average of that for all stock-days in the cell; hit change = how much more often the stock beat the index than the average stock-day.

Snapshot: `snapshot-2026-11-25` · 60 HK + 40 US stocks · tuning 2019-10-01 to 2023-06-30, test from 2023-07-01

## Agreement with `EVIDENCE` (all states)

| Column | Rank correlation with app | Same sign |
| --- | --- | --- |
| Excess 10d | -0.01 | 48 of 98 |
| Hit change 10d | -0.09 | 40 of 98 |
| Excess 120d | -0.37 | 30 of 98 |
| Hit change 120d | -0.56 | 17 of 98 |

States whose app verdict (lean up / lean down / no edge) would change with the re-run numbers: 40 of 98.

| State | App 10d | Re-run 10d | App 120d | Re-run 120d |
| --- | --- | --- | --- | --- |
| farBelow50 | 2.26 / 13.1 / 4 | 0.42 / 2.3 / 3 | 6.87 / 10.6 / 4 | 0.96 / -1.2 / 2 |
| farAbove50 | -0.55 / -3.5 / 2 | 0.37 / 0.7 / 3 | -3 / -5.1 / 2 | 4.03 / 1.6 / 3 |
| aboveSma200 | -0.31 / -1.4 / 3 | 0.09 / 0.7 / 2 | -1.67 / -4.2 / 3 | 1.62 / 3.3 / 4 |
| belowSma200 | 0.28 / 1.4 / 2 | -0.09 / -0.7 / 2 | 2.07 / 3.8 / 2 | -1.81 / -4 / 4 |
| golden | -0.24 / -1.1 / 2 | 0.1 / 0.6 / 1 | -1.4 / -3.7 / 2 | 1.63 / 3.3 / 3 |
| death | 0.21 / 1.1 / 1 | -0.1 / -0.5 / 2 | 1.71 / 3.3 / 2 | -1.83 / -4.1 / 3 |
| rsi14lt30 | 1.38 / 8.9 / 3 | 0.18 / 1.1 / 2 | 4.42 / 10.8 / 3 | -1.2 / -1.1 / 2 |
| rsi14gt70 | -0.67 / -3.7 / 3 | 0.45 / 3.2 / 4 | -2.91 / -6.1 / 3 | 2.87 / 3.9 / 2 |
| stochLt20 | 0.1 / 0.7 / 1 | -0.1 / -0.8 / 2 | 1.27 / 3 / 3 | -0.7 / -1 / 3 |
| cciVeryLow | 0.56 / 3.5 / 3 | -0.07 / -0.4 / 1 | 3.27 / 6.4 / 3 | -0.82 / -0.3 / 1 |
| cciLow | 0.14 / 1.2 / 2 | -0.13 / -1.1 / 3 | 1.65 / 3.1 / 3 | -0.55 / -1 / 2 |
| bbBelow | 0.51 / 3.3 / 3 | -0.07 / -0.8 / 1 | 2.52 / 3.8 / 3 | -0.53 / -0.7 / 2 |
| adxUp | -0.22 / -0.8 / 1 | 0.25 / 2 / 4 | -1.79 / -3.3 / 2 | 1.04 / 1.9 / 2 |
| adxDown | 0.84 / 6.1 / 4 | 0.22 / 2.3 / 2 | 2.83 / 6 / 3 | -0.1 / 0.3 / 1 |
| belowCloud | 0.32 / 2 / 3 | -0.06 / -0.5 / 2 | 1.73 / 3.4 / 2 | -0.88 / -1.7 / 4 |
| cmfPos | -0.22 / -1.5 / 2 | 0.07 / 1.3 / 2 | -1.68 / -3.8 / 3 | 0.44 / 1.9 / 3 |
| cmfNeg | 0.32 / 2.2 / 2 | -0.09 / -0.9 / 1 | 1.59 / 4.1 / 3 | -0.28 / -0.7 / 1 |
| mom12Strong | -0.39 / -2.3 / 3 | 0.24 / 1.2 / 3 | -3.74 / -7.3 / 3 | 3.77 / 6 / 4 |
| mom12Weak | 0.69 / 2.3 / 3 | -0.09 / -2.6 / 2 | 6.29 / 11.2 / 3 | 0.06 / -3.7 / 2 |
| near52High | -0.35 / -3.3 / 2 | 0.24 / 2.7 / 2 | -4.48 / -8.8 / 3 | 1.48 / 4.3 / 2 |
| deepDraw | 1.51 / 7.5 / 4 | 0.1 / -0.7 / 1 | 4.87 / 9.6 / 4 | 0.28 / -3.9 / 1 |
| highVol | 0.66 / 3.7 / 3 | -0.19 / -1.4 / 3 | 3.13 / 1 / 2 | -1.29 / -5.3 / 2 |
| new20Low | 0.47 / 3.3 / 3 | -0.11 / -1.1 / 1 | 2.65 / 5.2 / 4 | -0.91 / -1.2 / 2 |
| new20High | -0.18 / -1.3 / 1 | 0.14 / 0.9 / 2 | -1.87 / -3.7 / 4 | 1.25 / 2.3 / 2 |
| new55Low | 0.92 / 5.7 / 3 | 0.05 / -0.4 / 1 | 3.37 / 8.5 / 3 | -0.84 / -1 / 2 |
| new55High | -0.41 / -2.9 / 2 | 0.19 / 1.8 / 2 | -2.34 / -5 / 3 | 2.07 / 3.5 / 3 |
| drop5 | 0.55 / 3.1 / 3 | 0.15 / 0.4 / 2 | 2.95 / 5.1 / 3 | 1.33 / -0.5 / 3 |
| rsiReclaim30 | 0.51 / 3.9 / 3 | 0.13 / 0.6 / 1 | 3.27 / 7.4 / 2 | -0.93 / -0.8 / 1 |
| invHammer | 0.39 / 3.1 / 2 | 0.04 / 1.5 / 0 | 1.77 / 3.8 / 2 | 0.49 / 0.6 / 2 |
| spinTopAfterDown | 0.71 / 3 / 4 | 0.24 / 1.6 / 1 | 1.22 / 2.4 / 2 | 0.3 / -0.9 / 1 |
| bullKicker | 0.48 / 4.4 / 2 | 0.17 / 0.3 / 1 | -0.78 / 0 / 1 | 0.29 / 0.8 / 1 |
| bearKicker | 0.08 / 1.9 / 1 | -0.26 / -2.2 / 0 | 4.17 / 4.7 / 2 | 0.68 / 0.3 / 0 |
| doubleTop | -0.64 / -3.3 / 2 | -0.47 / -4.1 / 1 | -0.53 / -1.2 / 1 | -0.34 / -1.7 / 1 |
| baseBreakout | 0.03 / 0.6 / 0 | 0.18 / 2 / 1 | -1.36 / -3 / 1 | 0.62 / 4.1 / 2 |
| bearFlag | 0.37 / -5 / 0 | 0.36 / 2.1 / 0 | 1.46 / 2.3 / 0 | -1.99 / -4.4 / 2 |
| ascTriangle | -0.4 / -2.4 / 3 | 0.12 / 2.4 / 2 | -2.33 / -5.3 / 2 | 1.29 / 4.1 / 3 |
| descTriangle | 0.14 / 3 / 1 | -0.21 / 0 / 2 | 2.5 / 8.3 / 2 | -1.59 / -2.3 / 2 |
| fallingWedgeBreak | -0.48 / -2.6 / 2 | -0.16 / -0.8 / 1 | 1.46 / 5.1 / 2 | 0.02 / -0.2 / 1 |
| abcdBear | -0.13 / -3.2 / 0 | -0.06 / 0.5 / 2 | -1.78 / -6.1 / 2 | 0.87 / 1.3 / 1 |
| rsiBearDiv | -0.04 / 0 / 0 | 0.2 / 1.9 / 3 | -0.78 / -1.3 / 1 | 2.18 / 4 / 2 |

## Composite outlook score

| | App | Re-run |
| --- | --- | --- |
| 10d IC, HK train / test | 0.047 / 0.077 | 0.007 / 0.005 |
| 10d IC, US train / test | 0.067 / 0.059 | 0.047 / 0.024 |
| 120d IC, HK train / test | 0.122 / 0.157 | -0.045 / 0.107 |
| 120d IC, US train / test | 0.159 / 0.231 | 0.097 / 0.131 |
| Stocks with positive test IC, 10d HK / US | 50 of 60 / 27 of 40 | 31 of 60 / 21 of 40 |
| Stocks with positive test IC, 120d HK / US | 45 of 60 / 34 of 40 | 40 of 60 / 30 of 40 |
| 10d quintile excess % (low → high) | -0.42, -0.08, -0.19, -0.19, 1.06 | 0.37, -0.07, -0.15, -0.18, 0.03 |
| 120d quintile excess % (low → high) | -3.59, -0.55, 0.15, 0.32, 5.01 | 3.23, -0.23, -0.6, -0.97, -1.43 |

IC here is measured on returns relative to the index. Still open: overlapping returns and multiple testing (step 3), one fixed tuning split (step 4).
