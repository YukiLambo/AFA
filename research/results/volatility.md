# Volatility forecasts

Snapshot `snapshot-2026-11-25`, a forecast every 10 trading days per stock from 2019-01-01. QLIKE: lower is better. RMSE ratio below 1 = better than the old flat one-year estimate. Coverage of the ±1.96σ√H range should be about 95%.

| Market | Days ahead | Method | Forecasts | QLIKE | RMSE ratio vs flat | Inside 95% range (%) |
| --- | --- | --- | --- | --- | --- | --- |
| HK | 10 | flat | 9118 | 0.4044 | 1 | 94.1 |
| HK | 10 | ewma | 9118 | 0.4207 | 1.007 | 92.7 |
| HK | 10 | garch | 9118 | 0.3643 | 0.962 | 94 |
| HK | 120 | flat | 9118 | 0.1439 | 1 | 95.4 |
| HK | 120 | ewma | 9118 | 0.237 | 1.256 | 93.7 |
| HK | 120 | garch | 9118 | 0.132 | 0.965 | 96.1 |
| US | 10 | flat | 6400 | 0.6089 | 1 | 94.1 |
| US | 10 | ewma | 6400 | 0.5032 | 0.953 | 92.7 |
| US | 10 | garch | 6400 | 0.4321 | 0.897 | 94.3 |
| US | 120 | flat | 6400 | 0.2903 | 1 | 95.4 |
| US | 120 | ewma | 6400 | 0.3421 | 1.126 | 93.1 |
| US | 120 | garch | 6400 | 0.2129 | 0.869 | 96.5 |
