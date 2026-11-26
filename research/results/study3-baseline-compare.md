# Study 3 re-run (baseline method) vs the numbers in the app

Original method: excess vs the stock's own full-period average (look-ahead).

Snapshot: `snapshot-2026-11-25` · 60 HK + 40 US stocks · tuning 2019-10-01 to 2023-06-30, test from 2023-07-01

## Agreement with `EVIDENCE` (all states)

| Column | Rank correlation with app | Same sign |
| --- | --- | --- |
| Excess 10d | 0.18 | 45 of 98 |
| Hit change 10d | -0.03 | 43 of 98 |
| Excess 120d | -0.28 | 38 of 98 |
| Hit change 120d | -0.52 | 23 of 98 |

States whose app verdict (lean up / lean down / no edge) would change with the re-run numbers: 38 of 98.

| State | App 10d | Re-run 10d | App 120d | Re-run 120d |
| --- | --- | --- | --- | --- |
| farBelow50 | 0.42 / 2.3 / 3 | 1.25 / 6.7 / 4 | 0.96 / -1.2 / 2 | 4.34 / 7.6 / 4 |
| aboveSma200 | 0.09 / 0.7 / 2 | -0.18 / -0.9 / 4 | 1.62 / 3.3 / 4 | -0.82 / -2.5 / 3 |
| belowSma200 | -0.09 / -0.7 / 2 | 0.24 / 1.2 / 4 | -1.81 / -4 / 4 | 1.31 / 3.2 / 3 |
| golden | 0.1 / 0.6 / 1 | -0.11 / -0.6 / 2 | 1.63 / 3.3 / 3 | -0.64 / -2.2 / 3 |
| death | -0.1 / -0.5 / 2 | 0.14 / 0.8 / 2 | -1.83 / -4.1 / 3 | 0.99 / 2.4 / 3 |
| rsi14lt30 | 0.18 / 1.1 / 2 | 1.08 / 6.8 / 3 | -1.2 / -1.1 / 2 | 4.41 / 10.9 / 4 |
| rsi14gt70 | 0.45 / 3.2 / 4 | -0.16 / -0.9 / 1 | 2.87 / 3.9 / 2 | -1.7 / -4.8 / 3 |
| stochLt20 | -0.1 / -0.8 / 2 | 0.11 / 0.6 / 3 | -0.7 / -1 / 3 | 1.15 / 3.1 / 4 |
| cciVeryLow | -0.07 / -0.4 / 1 | 0.67 / 3.2 / 3 | -0.82 / -0.3 / 1 | 2.56 / 6 / 3 |
| bbBelow | -0.07 / -0.8 / 1 | 0.55 / 3.3 / 3 | -0.53 / -0.7 / 2 | 2.26 / 3.9 / 3 |
| adxUp | 0.25 / 2 / 4 | -0.15 / -0.7 / 3 | 1.04 / 1.9 / 2 | -1.3 / -2.7 / 3 |
| adxDown | 0.22 / 2.3 / 2 | 0.67 / 4.5 / 4 | -0.1 / 0.3 / 1 | 2.46 / 5.7 / 4 |
| belowCloud | -0.06 / -0.5 / 2 | 0.29 / 1.9 / 4 | -0.88 / -1.7 / 4 | 1.35 / 3.2 / 3 |
| cmfPos | 0.07 / 1.3 / 2 | -0.24 / -1.3 / 3 | 0.44 / 1.9 / 3 | -1.55 / -3.7 / 4 |
| cmfNeg | -0.09 / -0.9 / 1 | 0.33 / 2.2 / 3 | -0.28 / -0.7 / 1 | 1.8 / 4.3 / 4 |
| mom12Strong | 0.24 / 1.2 / 3 | -0.12 / -0.7 / 3 | 3.77 / 6 / 4 | -1.77 / -3.3 / 3 |
| mom12Weak | -0.09 / -2.6 / 2 | 0.26 / 0 / 3 | 0.06 / -3.7 / 2 | 4.64 / 7.4 / 3 |
| near52High | 0.24 / 2.7 / 2 | -0.22 / -2.2 / 3 | 1.48 / 4.3 / 2 | -2.02 / -5.1 / 3 |
| deepDraw | 0.1 / -0.7 / 1 | 0.55 / 2.2 / 4 | 0.28 / -3.9 / 1 | 2.31 / 4.4 / 3 |
| highVol | -0.19 / -1.4 / 3 | 0.52 / 2.8 / 3 | -1.29 / -5.3 / 2 | 2.05 / -1.7 / 3 |
| new20Low | -0.11 / -1.1 / 1 | 0.46 / 3 / 3 | -0.91 / -1.2 / 2 | 2.28 / 4.8 / 4 |
| new20High | 0.14 / 0.9 / 2 | -0.2 / -1.3 / 2 | 1.25 / 2.3 / 2 | -1.36 / -3.1 / 3 |
| new55Low | 0.05 / -0.4 / 1 | 0.79 / 4.5 / 3 | -0.84 / -1 / 2 | 4.22 / 8.7 / 4 |
| new55High | 0.19 / 1.8 / 2 | -0.29 / -2 / 2 | 2.07 / 3.5 / 3 | -2.02 / -4.5 / 3 |
| drop5 | 0.15 / 0.4 / 2 | 0.43 / 1.9 / 3 | 1.33 / -0.5 / 3 | 2.15 / 3.5 / 3 |
| rsiReclaim30 | 0.13 / 0.6 / 1 | 0.63 / 3.9 / 3 | -0.93 / -0.8 / 1 | 3.66 / 8.5 / 4 |
| invHammer | 0.04 / 1.5 / 0 | 0.38 / 2.9 / 1 | 0.49 / 0.6 / 2 | 2.11 / 4 / 3 |
| spinTopAfterDown | 0.24 / 1.6 / 1 | 0.62 / 3 / 3 | 0.3 / -0.9 / 1 | 1.16 / 1.8 / 2 |
| eveningStar | -0.2 / -2.4 / 1 | -0.65 / -3.8 / 2 | 2.83 / 3.1 / 2 | 0.68 / 0.4 / 0 |
| threeSoldiers | 0.38 / 2.9 / 0 | -0.34 / -4.4 / 0 | -1.04 / -0.7 / 0 | -4.36 / -9.1 / 4 |
| bearKicker | -0.26 / -2.2 / 0 | 0.04 / 1 / 1 | 0.68 / 0.3 / 0 | 2.86 / 4 / 2 |
| baseBreakout | 0.18 / 2 / 1 | 0.01 / 0.7 / 0 | 0.62 / 4.1 / 2 | -1.01 / -2.3 / 2 |
| bearFlag | 0.36 / 2.1 / 0 | 0.58 / -1.4 / 0 | -1.99 / -4.4 / 2 | -1.35 / 2.3 / 1 |
| ascTriangle | 0.12 / 2.4 / 2 | -0.48 / -3.1 / 4 | 1.29 / 4.1 / 3 | -2.07 / -4.6 / 3 |
| descTriangle | -0.21 / 0 / 2 | 0.15 / 2.8 / 1 | -1.59 / -2.3 / 2 | 3.02 / 9.1 / 4 |
| abcdBear | -0.06 / 0.5 / 2 | -0.37 / -2.2 / 2 | 0.87 / 1.3 / 1 | -1.27 / -4.3 / 2 |
| rsiBullDiv | 0 / 1.8 / 1 | 0.65 / 3.5 / 2 | -1.33 / -2.7 / 2 | 0.54 / 3.4 / 2 |
| rsiBearDiv | 0.2 / 1.9 / 3 | -0.13 / -1.1 / 1 | 2.18 / 4 / 2 | -0.83 / -1.4 / 2 |

## Statistical strength

Plain t-statistics (original method).

States that pass Benjamini–Hochberg false-discovery control at q ≤ 0.1 (combined over the four cells): **62 of 98** at 10 days, **57 of 98** at 120 days.

- 10 days: farBelow50 (+1.25%, q 0), belowSma200 (+0.24%, q 0), rsi14lt30 (+1.08%, q 0), adxDown (+0.67%, q 0), aboveCloud (-0.21%, q 0), belowCloud (+0.29%, q 0), cmfNeg (+0.33%, q 0), deepDraw (+0.55%, q 0), highVol (+0.52%, q 0), aboveSma200 (-0.18%, q 0), cmfPos (-0.24%, q 0), bbBelow (+0.55%, q 0), emaBear (+0.19%, q 0), new55Low (+0.79%, q 0), drop5 (+0.43%, q 0), emaBull (-0.16%, q 0), near52High (-0.22%, q 0), rsiReclaim30 (+0.63%, q 0), cciVeryLow (+0.67%, q 0), new20Low (+0.46%, q 0), lowVol (+0.2%, q 0), macdBullDiv (+0.47%, q 0), rsiBullDiv (+0.65%, q 0), death (+0.14%, q 0), golden (-0.11%, q 0), ascTriangle (-0.48%, q 0), spinTopAfterDown (+0.62%, q 0), abcdBear (-0.37%, q 0), adxWeak (-0.11%, q 0), mom12Strong (-0.12%, q 0), obvUp (-0.1%, q 0), obvDown (+0.11%, q 0), adxUp (-0.15%, q 0), mom12Weak (+0.26%, q 0), fallingWedgeBreak (-0.49%, q 0.001), new55High (-0.29%, q 0.001), stochGt80 (-0.12%, q 0.001), farAbove50 (-0.23%, q 0.001), cciLow (+0.14%, q 0.002), superUp (-0.07%, q 0.004), stochLt20 (+0.11%, q 0.005), superDown (+0.08%, q 0.005), new20High (-0.2%, q 0.008), eveningStar (-0.65%, q 0.008), volOscNeg (+0.11%, q 0.01), hangingMan (-0.38%, q 0.012), cciHigh (-0.09%, q 0.025), rsiBearDiv (-0.13%, q 0.025), gartleyBear (-0.68%, q 0.027), doubleTop (-0.47%, q 0.029), macdBearDiv (-0.07%, q 0.03), volOscPos (+0.08%, q 0.034), macdXup (+0.12%, q 0.042), doji (-0.12%, q 0.043), psarFlipDown (-0.17%, q 0.048), belowS1 (+0.15%, q 0.052), invHammer (+0.38%, q 0.057), spinTopAfterUp (-0.24%, q 0.066), bullKicker (+0.4%, q 0.066), macdAbove (+0.05%, q 0.071), rsi14gt70 (-0.16%, q 0.09), macdBelow (-0.05%, q 0.092)
- 120 days: farBelow50 (+4.34%, q 0), aboveSma200 (-0.82%, q 0), belowSma200 (+1.31%, q 0), death (+0.99%, q 0), emaBull (-0.8%, q 0), emaBear (+1.04%, q 0), rsi14lt30 (+4.41%, q 0), cciLow (+1.44%, q 0), bbBelow (+2.26%, q 0), adxUp (-1.3%, q 0), adxDown (+2.46%, q 0), aboveCloud (-0.98%, q 0), belowCloud (+1.35%, q 0), superUp (-1.03%, q 0), superDown (+1.12%, q 0), obvUp (-0.75%, q 0), obvDown (+0.87%, q 0), cmfPos (-1.55%, q 0), cmfNeg (+1.8%, q 0), mom12Strong (-1.77%, q 0), mom12Weak (+4.64%, q 0), near52High (-2.02%, q 0), lowVol (+2.34%, q 0), new20Low (+2.28%, q 0), new55Low (+4.22%, q 0), rsiReclaim30 (+3.66%, q 0), deepDraw (+2.31%, q 0), golden (-0.64%, q 0), stochLt20 (+1.15%, q 0), rsi14gt70 (-1.7%, q 0), volOscPos (+1.08%, q 0), stochGt80 (-0.91%, q 0), drop5 (+2.15%, q 0), new55High (-2.02%, q 0), highVol (+2.05%, q 0), farAbove50 (-1.47%, q 0), cciHigh (-0.87%, q 0), cciVeryLow (+2.56%, q 0), descTriangle (+3.02%, q 0), ascTriangle (-2.07%, q 0), new20High (-1.36%, q 0), psarDown (+0.45%, q 0), psarUp (-0.41%, q 0), macdBullDiv (+0.92%, q 0), rsiBearDiv (-0.83%, q 0), abcdBear (-1.27%, q 0), threeSoldiers (-4.36%, q 0), macdBearDiv (-0.66%, q 0), macdBelow (+0.3%, q 0.002), macdAbove (-0.29%, q 0.002), belowS1 (+0.89%, q 0.002), bearKicker (+2.86%, q 0.003), invHammer (+2.11%, q 0.003), aboveR1 (-0.57%, q 0.037), baseBreakout (-1.01%, q 0.039), cupHandle (-1.26%, q 0.063), spinTopAfterDown (+1.16%, q 0.078)

## Composite outlook score

| | App | Re-run |
| --- | --- | --- |
| 10d IC, HK train / test | 0.007 / 0.005 | 0.048 / 0.086 |
| 10d IC, US train / test | 0.047 / 0.024 | 0.066 / 0.057 |
| 120d IC, HK train / test | -0.045 / 0.107 | 0.103 / 0.162 |
| 120d IC, US train / test | 0.097 / 0.131 | 0.147 / 0.192 |
| Stocks with positive test IC, 10d HK / US | 31 of 60 / 21 of 40 | 52 of 60 / 30 of 40 |
| Stocks with positive test IC, 120d HK / US | 40 of 60 / 30 of 40 | 46 of 60 / 32 of 40 |
| 10d quintile excess % (low → high) | 0.37, -0.07, -0.15, -0.18, 0.03 | -0.18, -0.13, -0.18, -0.1, 0.59 |
| 120d quintile excess % (low → high) | 3.23, -0.23, -0.6, -0.97, -1.43 | -2.08, -0.76, -0.21, 0.56, 2.49 |

These figures use the original method, including its known weaknesses (overlapping returns, look-ahead "normal" return, no multiple-testing control). See README.
