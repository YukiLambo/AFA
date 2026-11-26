# Walk-forward test of the outlook model

Snapshot `snapshot-2026-11-25`. Refit every 6 months from 2021-01-01 on data whose outcomes were known before each window; scored on the next 6 months. Returns relative to the index.

## Cross-sectional rank IC (average over windows; windows with IC > 0)

| Horizon | Market | Walk-forward | App constants (fitted with hindsight) |
| --- | --- | --- | --- |
| 10 days | HK | 0.005 (7 of 12) | 0.008 (7 of 12) |
| 10 days | US | 0.007 (6 of 12) | 0.011 (6 of 12) |
| 120 days | HK | 0.013 (6 of 11) | 0.031 (7 of 11) |
| 120 days | US | 0.03 (7 of 11) | 0.048 (7 of 11) |

## Top 20% minus bottom 20% of predicted lift, return vs index (% points)

| Horizon | Market | Walk-forward | App constants |
| --- | --- | --- | --- |
| 10 days | HK | 0.132 (7 of 12) | 0.276 (7 of 12) |
| 10 days | US | 0.188 (6 of 12) | 0.266 (6 of 12) |
| 120 days | HK | 0.252 (6 of 11) | 0.938 (6 of 11) |
| 120 days | US | 1.808 (7 of 11) | 1.358 (7 of 11) |

## Signals passing false-discovery control, by number of windows

- 10 days (12 windows): bearEngulf 4, piercing 4, macdBullDiv 1, mom12Strong 1
- 120 days (11 windows): threeCrows 5, farAbove50 4, bullHarami 4, fallingWedgeBreak 4, drop5 3, gravestone 3, bullEngulf 3, bullFlag 3, gartleyBull 3, emaBear 2, shootingStar 2, spinTopAfterDown 2, spinTopAfterUp 2, bearEngulf 2, dragonfly 2, belowCloud 1, hammer 1, morningStar 1, threeSoldiers 1, tweezerBottom 1, doubleBottom 1, baseBreakdown 1

## Per window

| Horizon | Window | Signals passing | Calibration slope (pts) | IC HK | IC US |
| --- | --- | --- | --- | --- | --- |
| short | 2021-01-01 | 1 | -3.1 | 0.018 | -0.07 |
| short | 2021-07-01 | 0 | -1.7 | -0.009 | 0.004 |
| short | 2022-01-01 | 0 | -1 | 0.028 | 0.053 |
| short | 2022-07-01 | 0 | -1.7 | 0.008 | -0.043 |
| short | 2023-01-01 | 2 | -0.2 | 0.055 | 0.076 |
| short | 2023-07-01 | 1 | -0.5 | -0.068 | -0.085 |
| short | 2024-01-01 | 2 | -1 | 0.01 | 0.136 |
| short | 2024-07-01 | 3 | -1.6 | -0.04 | -0.034 |
| short | 2025-01-01 | 0 | -1.2 | 0.032 | 0.085 |
| short | 2025-07-01 | 1 | -1.5 | -0.012 | -0.061 |
| short | 2026-01-01 | 0 | -0.8 | 0.039 | 0.066 |
| short | 2026-07-01 | 0 | -1.8 | -0.005 | -0.038 |
| long | 2021-01-01 | 19 | -18.2 | 0.012 | -0.108 |
| long | 2021-07-01 | 13 | -12.9 | -0.136 | -0.056 |
| long | 2022-01-01 | 11 | -10.8 | -0.008 | 0.279 |
| long | 2022-07-01 | 4 | -7.4 | -0.007 | -0.245 |
| long | 2023-01-01 | 3 | -9.3 | 0.114 | 0.167 |
| long | 2023-07-01 | 1 | -6.5 | 0.101 | 0.113 |
| long | 2024-01-01 | 0 | -7.9 | 0.038 | 0.006 |
| long | 2024-07-01 | 0 | -8.5 | -0.03 | 0.17 |
| long | 2025-01-01 | 0 | -7.7 | -0.074 | -0.131 |
| long | 2025-07-01 | 0 | -8.1 | 0.045 | 0.112 |
| long | 2026-01-01 | 0 | -7.2 | 0.085 | 0.023 |
