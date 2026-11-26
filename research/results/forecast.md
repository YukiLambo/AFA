# Forecast vs random walk

Snapshot `snapshot-2026-11-25`, a forecast every 21 trading days per stock from 2019-10-01. Theil's U below 1 means more accurate than "no change". A 95% range should contain the outcome about 95% of the time.

| Market | Days ahead | Method | Forecasts | RMSE of log return (%) | Theil's U | Direction right (%) | Inside 95% range (%) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| HK | 5 | holt | 4912 | 5.77 | 1.101 | 50.3 | 93 |
| HK | 5 | logDamped | 4912 | 5.29 | 1.009 | 49.4 | 94.3 |
| HK | 5 | drift | 4912 | 5.25 | 1.001 | 51.3 | — |
| HK | 5 | randomWalk | 4912 | 5.24 | 1 | — | — |
| HK | 20 | holt | 4912 | 52.56 | 4.924 | 48.6 | 87.6 |
| HK | 20 | logDamped | 4912 | 10.88 | 1.02 | 50.1 | 94 |
| HK | 20 | drift | 4912 | 11.05 | 1.035 | 51 | — |
| HK | 20 | randomWalk | 4912 | 10.67 | 1 | — | — |
| US | 5 | holt | 3400 | 5.09 | 1.124 | 48.8 | 92.3 |
| US | 5 | logDamped | 3400 | 4.67 | 1.032 | 50.5 | 94.2 |
| US | 5 | drift | 3400 | 4.57 | 1.01 | 51 | — |
| US | 5 | randomWalk | 3400 | 4.53 | 1 | — | — |
| US | 20 | holt | 3400 | 17.17 | 1.726 | 50.7 | 86.6 |
| US | 20 | logDamped | 3400 | 10.45 | 1.05 | 50.4 | 92.7 |
| US | 20 | drift | 3400 | 10.21 | 1.026 | 52.2 | — |
| US | 20 | randomWalk | 3400 | 9.95 | 1 | — | — |
