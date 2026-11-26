# Study 2 re-run (market method) vs the numbers in the app

Returns are measured relative to the index (HSI / S&P 500) over the same 60 days.

Snapshot: `snapshot-2026-11-25` · 60-day returns · tuning 2019-10-01 to 2023-12-31, test from 2024-01-01

| Timing score | App | Re-run |
| --- | --- | --- |
| IC, HK train / test | 0.053 / 0.19 | -0.013 / 0.018 |
| IC, US train / test | 0.056 / 0.128 | 0.039 / 0.078 |
| HK stocks with positive test IC | 39 of 45 | 33 of 60 |
| HK test: top / all / bottom 60d return % | 6.26 / 4.03 / 2.16 | -0.83 / -0.26 / 0.46 |
| HK train: top / all / bottom | 0.16 / -0.33 / 0.21 | 1.51 / 2.37 / 3.3 |
| US test: top / all / bottom | 7.84 / 4.99 / 3.76 | 0.86 / -0.05 / -0.29 |

| Classic indicator reading, HK test IC | App | Re-run |
| --- | --- | --- |
| emaX | -0.2 | -0.01 |
| golden | -0.13 | -0.02 |
| macdX | -0.09 | 0.02 |
| diDir | -0.18 | -0.02 |
| ichi | -0.23 | -0.03 |
| tkX | -0.18 | 0.01 |
| superT | -0.18 | 0.02 |
| rev1m | 0.17 | 0 |

Not re-run: obvTrend, bbPos, fibPos, stoch (not exposed by signalSeries).

The app study used 45 Hang Seng blue chips; this re-run uses the 60 HK stocks in universe.json, so small differences are expected.
