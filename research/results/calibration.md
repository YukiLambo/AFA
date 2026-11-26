# Trade-plan probability calibration

Snapshot `snapshot-2026-11-25`: the app's short (10-day) and long (120-day) plans, built every 10 trading days per stock from 2019-01-01, bought at that day's close and followed for the plan's horizon. Plans overlap, so treat the numbers as descriptive. Returns are before costs.

## Does the correction work on later data?

Table fitted on plans before 2023-01-01, scored on plans after. Brier score: lower is better.

| Plan | Test plans | Stated (raw) | Stated (corrected) | Actual target first | Brier raw | Brier corrected | Brier, constant average |
| --- | --- | --- | --- | --- | --- | --- | --- |
| short | 8455 | 36.3% | 26.9% | 30.8% | 0.219 | 0.2147 | 0.2145 |
| long | 8455 | 52.1% | 43% | 49.3% | 0.2475 | 0.2528 | 0.2585 |

## Short-term plan (10 days) · HK

10678 plans. Target first 29.8% (plans said 35%), stop first 31.5%, neither by the end 38.6%. Brier 0.2152 vs 0.2094 for always predicting the average. Average result 0.11% per trade (plans said 0.17%).

By signal: Hold 10678 (target first 29.8%, average 0.11%).

| Stated probability | Plans | Stated (avg) | Target first | Stop first | Target first, of those resolved |
| --- | --- | --- | --- | --- | --- |
| 0–30% | 2190 | 24.1% | 27.9% | 30.1% | 48.1% |
| 30–40% | 6087 | 36% | 29.3% | 36.5% | 44.5% |
| 40–50% | 2401 | 42.3% | 33% | 20% | 62.2% |

## Short-term plan (10 days) · US

7440 plans. Target first 27.2% (plans said 36.7%), stop first 30.5%, neither by the end 42.4%. Brier 0.2083 vs 0.1978 for always predicting the average. Average result 0.32% per trade (plans said 0.31%).

By signal: Hold 7440 (target first 27.2%, average 0.32%).

| Stated probability | Plans | Stated (avg) | Target first | Stop first | Target first, of those resolved |
| --- | --- | --- | --- | --- | --- |
| 0–30% | 763 | 23% | 25.4% | 30.5% | 45.4% |
| 30–40% | 4547 | 36.6% | 27% | 36.7% | 42.4% |
| 40–50% | 2130 | 41.7% | 28.1% | 17.2% | 62% |

## Short-term plan (10 days) · all

18118 plans. Target first 28.7% (plans said 35.7%), stop first 31.1%, neither by the end 40.2%. Brier 0.2124 vs 0.2048 for always predicting the average. Average result 0.2% per trade (plans said 0.23%).

By signal: Hold 18118 (target first 28.7%, average 0.2%).

| Stated probability | Plans | Stated (avg) | Target first | Stop first | Target first, of those resolved |
| --- | --- | --- | --- | --- | --- |
| 0–30% | 2953 | 23.8% | 27.3% | 30.2% | 47.4% |
| 30–40% | 10634 | 36.3% | 28.3% | 36.6% | 43.6% |
| 40–50% | 4531 | 42% | 30.7% | 18.7% | 62.1% |

## Long-term plan (120 days) · HK

10678 plans. Target first 46.5% (plans said 52.2%), stop first 25.7%, neither by the end 27.9%. Brier 0.2453 vs 0.2487 for always predicting the average. Average result 0.06% per trade (plans said 2.72%).

By signal: Accumulate 999 (target first 43.6%, average 3.29%); Hold 9679 (target first 46.8%, average -0.27%).

| Stated probability | Plans | Stated (avg) | Target first | Stop first | Target first, of those resolved |
| --- | --- | --- | --- | --- | --- |
| 0–30% | 232 | 23.9% | 32.3% | 42.2% | 43.4% |
| 30–40% | 662 | 35.6% | 41.5% | 38.4% | 52% |
| 40–50% | 2558 | 46.8% | 39.9% | 28.5% | 58.3% |
| 50–60% | 5596 | 54.5% | 44.2% | 26% | 63% |
| 60–70% | 1590 | 63.3% | 67.8% | 13% | 83.9% |
| 70–80% | 40 | 71% | 95% | 0% | 100% |

## Long-term plan (120 days) · US

7440 plans. Target first 41.3% (plans said 50.3%), stop first 19.9%, neither by the end 38.8%. Brier 0.2436 vs 0.2424 for always predicting the average. Average result 4.83% per trade (plans said 4.19%).

By signal: Accumulate 947 (target first 35.2%, average 8.55%); Hold 6493 (target first 42.2%, average 4.29%).

| Stated probability | Plans | Stated (avg) | Target first | Stop first | Target first, of those resolved |
| --- | --- | --- | --- | --- | --- |
| 30–40% | 65 | 37.6% | 53.8% | 21.5% | 71.4% |
| 40–50% | 3663 | 47.1% | 32.2% | 24.9% | 56.4% |
| 50–60% | 3433 | 53% | 48.4% | 15.4% | 75.9% |
| 60–70% | 277 | 62.9% | 70.4% | 9.4% | 88.2% |

## Long-term plan (120 days) · all

18118 plans. Target first 44.3% (plans said 51.4%), stop first 23.3%, neither by the end 32.3%. Brier 0.2446 vs 0.2468 for always predicting the average. Average result 2.02% per trade (plans said 3.32%).

By signal: Accumulate 1946 (target first 39.5%, average 5.85%); Hold 16172 (target first 44.9%, average 1.56%).

| Stated probability | Plans | Stated (avg) | Target first | Stop first | Target first, of those resolved |
| --- | --- | --- | --- | --- | --- |
| 0–30% | 232 | 23.9% | 32.3% | 42.2% | 43.4% |
| 30–40% | 727 | 35.8% | 42.6% | 36.9% | 53.6% |
| 40–50% | 6221 | 47% | 35.3% | 26.4% | 57.2% |
| 50–60% | 9029 | 53.9% | 45.8% | 22% | 67.6% |
| 60–70% | 1867 | 63.2% | 68.2% | 12.5% | 84.5% |
| 70–80% | 42 | 71% | 95.2% | 0% | 100% |
