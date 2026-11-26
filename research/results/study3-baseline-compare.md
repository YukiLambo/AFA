# Study 3 re-run (baseline method) vs the numbers in the app

Original method: excess vs the stock's own full-period average (look-ahead).

Snapshot: `snapshot-2026-11-25` · 60 HK + 40 US stocks · tuning 2019-10-01 to 2023-06-30, test from 2023-07-01

## Agreement with `EVIDENCE` (all states)

| Column | Rank correlation with app | Same sign |
| --- | --- | --- |
| Excess 10d | 0.86 | 87 of 98 |
| Hit change 10d | 0.88 | 84 of 98 |
| Excess 120d | 0.91 | 86 of 98 |
| Hit change 120d | 0.94 | 89 of 98 |

States whose app verdict (lean up / lean down / no edge) would change with the re-run numbers: 17 of 98.

| State | App 10d | Re-run 10d | App 120d | Re-run 120d |
| --- | --- | --- | --- | --- |
| farAbove50 | -0.55 / -3.5 / 2 | -0.23 / -1.8 / 1 | -3 / -5.1 / 2 | -1.47 / -2.9 / 2 |
| aboveSma200 | -0.31 / -1.4 / 3 | -0.18 / -0.9 / 4 | -1.67 / -4.2 / 3 | -0.82 / -2.5 / 3 |
| belowSma200 | 0.28 / 1.4 / 2 | 0.24 / 1.2 / 4 | 2.07 / 3.8 / 2 | 1.31 / 3.2 / 3 |
| rsi14gt70 | -0.67 / -3.7 / 3 | -0.16 / -0.9 / 1 | -2.91 / -6.1 / 3 | -1.7 / -4.8 / 3 |
| cciLow | 0.14 / 1.2 / 2 | 0.14 / 1.1 / 2 | 1.65 / 3.1 / 3 | 1.44 / 2.8 / 4 |
| belowCloud | 0.32 / 2 / 3 | 0.29 / 1.9 / 4 | 1.73 / 3.4 / 2 | 1.35 / 3.2 / 3 |
| cmfNeg | 0.32 / 2.2 / 2 | 0.33 / 2.2 / 3 | 1.59 / 4.1 / 3 | 1.8 / 4.3 / 4 |
| mom12Strong | -0.39 / -2.3 / 3 | -0.12 / -0.7 / 3 | -3.74 / -7.3 / 3 | -1.77 / -3.3 / 3 |
| mom12Weak | 0.69 / 2.3 / 3 | 0.26 / 0 / 3 | 6.29 / 11.2 / 3 | 4.64 / 7.4 / 3 |
| drop5 | 0.55 / 3.1 / 3 | 0.43 / 1.9 / 3 | 2.95 / 5.1 / 3 | 2.15 / 3.5 / 3 |
| invHammer | 0.39 / 3.1 / 2 | 0.38 / 2.9 / 1 | 1.77 / 3.8 / 2 | 2.11 / 4 / 3 |
| eveningStar | -0.16 / -1.9 / 1 | -0.65 / -3.8 / 2 | 1.58 / 1.5 / 1 | 0.68 / 0.4 / 0 |
| threeSoldiers | -0.37 / -4.6 / 1 | -0.34 / -4.4 / 0 | -4.25 / -7.9 / 1 | -4.36 / -9.1 / 4 |
| bullKicker | 0.48 / 4.4 / 2 | 0.4 / 3 / 1 | -0.78 / 0 / 1 | -0.48 / 0.8 / 1 |
| doubleTop | -0.64 / -3.3 / 2 | -0.47 / -2.3 / 2 | -0.53 / -1.2 / 1 | 0.03 / 0 / 0 |
| fallingWedgeBreak | -0.48 / -2.6 / 2 | -0.49 / -1.9 / 2 | 1.46 / 5.1 / 2 | 0.47 / 2.4 / 1 |
| rsiBullDiv | 0.52 / 2.9 / 1 | 0.65 / 3.5 / 2 | 0.44 / 2.4 / 1 | 0.54 / 3.4 / 2 |

## Composite outlook score

| | App | Re-run |
| --- | --- | --- |
| 10d IC, HK train / test | 0.047 / 0.077 | 0.048 / 0.086 |
| 10d IC, US train / test | 0.067 / 0.059 | 0.066 / 0.057 |
| 120d IC, HK train / test | 0.122 / 0.157 | 0.103 / 0.162 |
| 120d IC, US train / test | 0.159 / 0.231 | 0.147 / 0.192 |
| Stocks with positive test IC, 10d HK / US | 50 of 60 / 27 of 40 | 52 of 60 / 30 of 40 |
| Stocks with positive test IC, 120d HK / US | 45 of 60 / 34 of 40 | 46 of 60 / 32 of 40 |
| 10d quintile excess % (low → high) | -0.42, -0.08, -0.19, -0.19, 1.06 | -0.18, -0.13, -0.18, -0.1, 0.59 |
| 120d quintile excess % (low → high) | -3.59, -0.55, 0.15, 0.32, 5.01 | -2.08, -0.76, -0.21, 0.56, 2.49 |

These figures use the original method, including its known weaknesses (overlapping returns, look-ahead "normal" return, no multiple-testing control). See README.
