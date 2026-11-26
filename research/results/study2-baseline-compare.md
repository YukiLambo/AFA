# Study 2 re-run (baseline method) vs the numbers in the app

Original method: raw 60-day returns.

Snapshot: `snapshot-2026-11-25` · 60-day returns · tuning 2019-10-01 to 2023-12-31, test from 2024-01-01

| Timing score | App | Re-run |
| --- | --- | --- |
| IC, HK train / test | 0.053 / 0.19 | 0.059 / 0.165 |
| IC, US train / test | 0.056 / 0.128 | 0.121 / 0.125 |
| HK stocks with positive test IC | 39 of 45 | 52 of 60 |
| HK test: top / all / bottom 60d return % | 6.26 / 4.03 / 2.16 | 5.58 / 3.82 / 2.45 |
| HK train: top / all / bottom | 0.16 / -0.33 / 0.21 | 0.47 / 0 / 0.26 |
| US test: top / all / bottom | 7.84 / 4.99 / 3.76 | 5.86 / 3.97 / 3.27 |

| Classic indicator reading, HK test IC | App | Re-run |
| --- | --- | --- |
| emaX | -0.2 | -0.14 |
| golden | -0.13 | -0.04 |
| macdX | -0.09 | -0.02 |
| diDir | -0.18 | -0.11 |
| ichi | -0.23 | -0.17 |
| tkX | -0.18 | -0.1 |
| superT | -0.18 | -0.1 |
| rev1m | 0.17 | 0.15 |

Not re-run: obvTrend, bbPos, fibPos, stoch (not exposed by signalSeries).

The app study used 45 Hang Seng blue chips; this re-run uses the 60 HK stocks in universe.json, so small differences are expected.
