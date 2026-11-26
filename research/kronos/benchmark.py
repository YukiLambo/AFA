"""Kronos benchmark (step 13): does the Kronos foundation model forecast 20-day stock returns better than a random
walk ("no change") on the same stocks and dates as research/forecast.mjs?

Kronos (https://github.com/shiyu-coder/Kronos, MIT licence) is a transformer pre-trained on candlestick data from
many exchanges. This script only measures it; nothing in the app depends on it.

    node research/kronos/export_adjusted.mjs research/kronos/adjusted.csv
    python research/kronos/benchmark.py --kronos-dir /path/to/Kronos --csv research/kronos/adjusted.csv

Run by .github/workflows/kronos-benchmark.yml (manual). Scores, as in forecast.mjs:
  Theil's U        RMSE of the forecast 20-day log return / RMSE of a zero forecast (below 1 = better than no change)
  Direction right  share of forecasts whose sign matched the actual return
  Rank IC          each date, Spearman correlation across stocks between forecast and actual return, averaged
                   (what matters for picking stocks), with a simple t-statistic over dates
"""
import argparse, json, math, os, sys, time
import numpy as np
import pandas as pd


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--kronos-dir', required=True, help='checkout of github.com/shiyu-coder/Kronos')
    ap.add_argument('--csv', default='research/kronos/adjusted.csv')
    ap.add_argument('--model', default='NeoQuasar/Kronos-small')
    ap.add_argument('--tokenizer', default='NeoQuasar/Kronos-Tokenizer-base')
    ap.add_argument('--start', default='2019-10-01')
    ap.add_argument('--step', type=int, default=63, help='trading days between forecast dates')
    ap.add_argument('--context', type=int, default=400, help='days of history given to the model (max 512)')
    ap.add_argument('--horizon', type=int, default=20)
    ap.add_argument('--samples', type=int, default=5, help='sampled paths per forecast, averaged by Kronos')
    ap.add_argument('--limit-dates', type=int, default=0, help='only the first N dates (for a quick test)')
    ap.add_argument('--random-init', action='store_true', help='untrained tiny model: tests the pipeline offline')
    ap.add_argument('--out', default='research/results/kronos')
    a = ap.parse_args()

    sys.path.insert(0, a.kronos_dir)
    import torch
    from model import Kronos, KronosTokenizer, KronosPredictor
    torch.manual_seed(0); np.random.seed(0)

    if a.random_init:
        tok = KronosTokenizer(d_in=6, d_model=32, n_heads=2, ff_dim=64, n_enc_layers=1, n_dec_layers=1, ffn_dropout_p=0, attn_dropout_p=0, resid_dropout_p=0, s1_bits=4, s2_bits=4, beta=1, gamma0=1, gamma=1, zeta=1, group_size=4)
        mdl = Kronos(s1_bits=4, s2_bits=4, n_layers=1, d_model=32, n_heads=2, ff_dim=64, ffn_dropout_p=0, attn_dropout_p=0, resid_dropout_p=0, token_dropout_p=0, learn_te=True)
        model_name = 'random-init (pipeline test, not a real result)'
    else:
        tok = KronosTokenizer.from_pretrained(a.tokenizer)
        mdl = Kronos.from_pretrained(a.model)
        model_name = a.model
    device = 'cuda:0' if torch.cuda.is_available() else 'cpu'
    pred = KronosPredictor(mdl, tok, device=device, max_context=512)

    df = pd.read_csv(a.csv, parse_dates=['date']).sort_values(['symbol', 'date'])
    series = {s: g.reset_index(drop=True) for s, g in df.groupby('symbol')}
    market = {s: g['market'].iloc[0] for s, g in series.items()}

    # forecast dates: every `step` trading days of a calendar shared by each market (union of its stocks' dates)
    rows = []
    t0 = time.time()
    for mkt in ['HK', 'US']:
        syms = [s for s in series if market[s] == mkt]
        cal = sorted(set(pd.concat([series[s]['date'] for s in syms])))
        cal = [d for d in cal if d >= pd.Timestamp(a.start)]
        dates = cal[::a.step]
        if a.limit_dates: dates = dates[:a.limit_dates]
        for d in dates:
            batch, meta = [], []
            for s in syms:
                g = series[s]
                pos = g.index[g['date'] == d]
                if not len(pos): continue
                i = int(pos[0])
                if i < a.context or i + a.horizon >= len(g): continue
                hist = g.iloc[i - a.context + 1:i + 1]
                fut = g.iloc[i + 1:i + 1 + a.horizon]
                x = hist[['open', 'high', 'low', 'close', 'volume']].copy().reset_index(drop=True)
                x['amount'] = x['volume'] * x[['open', 'high', 'low', 'close']].mean(axis=1)
                batch.append((x, pd.Series(hist['date'].values), pd.Series(fut['date'].values)))
                meta.append((s, float(hist['close'].iloc[-1]), float(fut['close'].iloc[-1])))
            if len(batch) < 5: continue
            out = pred.predict_batch([b[0] for b in batch], [b[1] for b in batch], [b[2] for b in batch],
                                     pred_len=a.horizon, T=1.0, top_p=0.9, sample_count=a.samples, verbose=False)
            for (s, p0, p1), o in zip(meta, out):
                f = float(o['close'].iloc[-1])
                rows.append({'market': mkt, 'date': str(d.date()), 'symbol': s,
                             'forecast': math.log(max(f, 1e-9) / p0), 'actual': math.log(p1 / p0)})
            print(f'{mkt} {d.date()}: {len(batch)} stocks, {len(rows)} forecasts so far, {time.time() - t0:.0f}s', flush=True)

    res = pd.DataFrame(rows)
    summary = {'model': model_name, 'kronosCommit': os.environ.get('KRONOS_COMMIT'), 'start': a.start, 'step': a.step,
               'context': a.context, 'horizon': a.horizon, 'samples': a.samples, 'markets': {}}
    for mkt, g in res.groupby('market'):
        rmse = math.sqrt(((g.actual - g.forecast) ** 2).mean()); rw = math.sqrt((g.actual ** 2).mean())
        nz = g[(g.forecast != 0) & (g.actual != 0)]
        ics = [x.forecast.rank().corr(x.actual.rank()) for _, x in g.groupby('date') if len(x) >= 5]
        ics = [v for v in ics if not math.isnan(v)]
        ic_t = (np.mean(ics) / (np.std(ics, ddof=1) / math.sqrt(len(ics)))) if len(ics) > 2 and np.std(ics) > 0 else None
        summary['markets'][mkt] = {
            'forecasts': int(len(g)), 'dates': int(g.date.nunique()),
            'theilU': round(rmse / rw, 3), 'directionRightPct': round(100 * (np.sign(nz.forecast) == np.sign(nz.actual)).mean(), 1),
            'rankIC': round(float(np.mean(ics)), 3) if ics else None, 'rankICt': round(float(ic_t), 2) if ic_t is not None else None,
            'meanForecastPct': round(100 * g.forecast.mean(), 2), 'meanActualPct': round(100 * g.actual.mean(), 2)}
    os.makedirs(os.path.dirname(a.out) or '.', exist_ok=True)
    with open(a.out + '.json', 'w') as fh: json.dump(summary, fh, indent=1)
    md = ['# Kronos vs random walk', '', f"Model `{model_name}`, {a.horizon}-day log-return forecasts every {a.step} trading days from {a.start}, "
          f"{a.context} days of context, {a.samples} sampled paths averaged. Theil's U below 1 = better than no change.", '',
          '| Market | Forecasts | Dates | Theil\'s U | Direction right (%) | Rank IC (t) |', '| --- | --- | --- | --- | --- | --- |']
    for mkt, r in summary['markets'].items():
        md.append(f"| {mkt} | {r['forecasts']} | {r['dates']} | {r['theilU']} | {r['directionRightPct']} | {r['rankIC']} ({r['rankICt']}) |")
    md += ['', 'For comparison, the app\'s own projection (research/results/forecast.md) has Theil\'s U 1.02 (HK) and 1.05 (US) at 20 days.']
    with open(a.out + '.md', 'w') as fh: fh.write('\n'.join(md) + '\n')
    print('\n'.join(md))


if __name__ == '__main__':
    main()
