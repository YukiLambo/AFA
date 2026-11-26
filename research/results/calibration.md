# Trade-plan probability calibration

Snapshot `snapshot-2026-11-25`: the app's short (10-day) and long (120-day) plans, built every 10 trading days per stock from 2019-01-01, bought at that day's close and followed for the plan's horizon. Plans overlap, so treat the numbers as descriptive. Returns are before costs.

## Does the correction work on later data?

Table fitted on plans before 2023-01-01, scored on plans after. Brier score: lower is better.

| Plan | Test plans | Stated (raw) | Stated (corrected) | Actual target first | Brier raw | Brier corrected | Brier, constant average |
| --- | --- | --- | --- | --- | --- | --- | --- |
| short | 8455 | 36.8% | 28.3% | 31.5% | 0.2205 | 0.217 | 0.2168 |
| long | 8455 | 52.3% | 43.1% | 49.1% | 0.2466 | 0.2503 | 0.258 |

## Short-term plan (10 days) · HK

10678 plans. Target first 30.7% (plans said 35.6%), stop first 31.4%, neither by the end 37.9%. Brier 0.2168 vs 0.2126 for always predicting the average. Average result 0.12% per trade (plans said 0.14%).

By signal: Hold 10678 (target first 30.7%, average 0.12%).

| Stated probability | Plans | Stated (avg) | Target first | Stop first | Target first, of those resolved |
| --- | --- | --- | --- | --- | --- |
| 0–30% | 1841 | 25.8% | 29.4% | 32.2% | 47.8% |
| 30–40% | 6361 | 35.9% | 29.7% | 35.8% | 45.3% |
| 40–50% | 2476 | 42.3% | 34% | 19.4% | 63.6% |

## Short-term plan (10 days) · US

7440 plans. Target first 28.8% (plans said 37.8%), stop first 30.4%, neither by the end 40.8%. Brier 0.2142 vs 0.2051 for always predicting the average. Average result 0.3% per trade (plans said 0.26%).

By signal: Hold 7440 (target first 28.8%, average 0.3%).

| Stated probability | Plans | Stated (avg) | Target first | Stop first | Target first, of those resolved |
| --- | --- | --- | --- | --- | --- |
| 0–30% | 380 | 26.3% | 26.8% | 27.1% | 49.8% |
| 30–40% | 4795 | 36.9% | 28.2% | 37.2% | 43.1% |
| 40–50% | 2265 | 41.7% | 30.5% | 16.7% | 64.6% |

## Short-term plan (10 days) · all

18118 plans. Target first 29.9% (plans said 36.5%), stop first 31%, neither by the end 39.1%. Brier 0.2158 vs 0.2096 for always predicting the average. Average result 0.2% per trade (plans said 0.19%).

By signal: Hold 18118 (target first 29.9%, average 0.2%).

| Stated probability | Plans | Stated (avg) | Target first | Stop first | Target first, of those resolved |
| --- | --- | --- | --- | --- | --- |
| 0–30% | 2221 | 25.9% | 29% | 31.3% | 48.1% |
| 30–40% | 11156 | 36.3% | 29.1% | 36.4% | 44.4% |
| 40–50% | 4741 | 42% | 32.3% | 18.1% | 64.1% |

## Long-term plan (120 days) · HK

10678 plans. Target first 46.3% (plans said 52.6%), stop first 25.2%, neither by the end 28.4%. Brier 0.2473 vs 0.2487 for always predicting the average. Average result 0.04% per trade (plans said 4.2%).

By signal: Accumulate 999 (target first 43.4%, average 3.33%); Hold 9679 (target first 46.6%, average -0.3%).

| Stated probability | Plans | Stated (avg) | Target first | Stop first | Target first, of those resolved |
| --- | --- | --- | --- | --- | --- |
| 0–30% | 141 | 26.2% | 46.8% | 34.8% | 57.4% |
| 30–40% | 611 | 36.3% | 49.1% | 31.9% | 60.6% |
| 40–50% | 2660 | 46.8% | 37.7% | 29.6% | 56.1% |
| 50–60% | 5529 | 54.5% | 43.4% | 25.7% | 62.8% |
| 60–70% | 1686 | 63.2% | 67.5% | 14.1% | 82.8% |
| 70–80% | 51 | 71.1% | 84.3% | 9.8% | 89.6% |

## Long-term plan (120 days) · US

7440 plans. Target first 41.4% (plans said 50.5%), stop first 18.9%, neither by the end 39.8%. Brier 0.2434 vs 0.2425 for always predicting the average. Average result 4.7% per trade (plans said 7.21%).

By signal: Accumulate 947 (target first 35%, average 8.41%); Hold 6493 (target first 42.3%, average 4.16%).

| Stated probability | Plans | Stated (avg) | Target first | Stop first | Target first, of those resolved |
| --- | --- | --- | --- | --- | --- |
| 30–40% | 43 | 38.2% | 81.4% | 4.7% | 94.6% |
| 40–50% | 3572 | 47.5% | 30% | 21.5% | 58.3% |
| 50–60% | 3592 | 52.9% | 50.2% | 16.8% | 74.9% |
| 60–70% | 232 | 62.7% | 71.1% | 12.5% | 85.1% |

## Long-term plan (120 days) · all

18118 plans. Target first 44.3% (plans said 51.7%), stop first 22.6%, neither by the end 33.1%. Brier 0.2457 vs 0.2467 for always predicting the average. Average result 1.95% per trade (plans said 5.44%).

By signal: Accumulate 1946 (target first 39.3%, average 5.8%); Hold 16172 (target first 44.9%, average 1.49%).

| Stated probability | Plans | Stated (avg) | Target first | Stop first | Target first, of those resolved |
| --- | --- | --- | --- | --- | --- |
| 0–30% | 141 | 26.2% | 46.8% | 34.8% | 57.4% |
| 30–40% | 654 | 36.4% | 51.2% | 30.1% | 63% |
| 40–50% | 6232 | 47.2% | 33.3% | 24.9% | 57.2% |
| 50–60% | 9121 | 53.8% | 46.1% | 22.2% | 67.5% |
| 60–70% | 1918 | 63.1% | 67.9% | 13.9% | 83% |
| 70–80% | 52 | 71.1% | 84.6% | 9.6% | 89.8% |
