import pandas as pd
import numpy as np

df = pd.read_parquet('data/raw/FXVol60_H1.parquet')
df['hour'] = df.index.hour
df['date'] = df.index.date

tp_options = [200, 300, 400, 500, 600]
sl_options = [300, 400, 500, 600, 800, 1000]

print("=== GRID TEST: TP vs SL for 1,250 Pt Daily Envelope Fade ===")
print("TP (pts) | SL (pts) | Total Trades | Win Rate % | Profit Factor | Net Points PnL")
print("-" * 75)

best_pf = 0
best_config = None

for tp in tp_options:
    for sl in sl_options:
        wins = 0
        losses = 0
        pnl = 0
        trades_count = 0

        for d, g in df.groupby('date'):
            if len(g) >= 20:
                day_open = g['open'].iloc[0]
                short_done = False
                long_done = False

                for i in range(len(g)):
                    bar = g.iloc[i]
                    # Short trigger
                    if not short_done and bar['high'] >= day_open + 1250:
                        short_done = True
                        trades_count += 1
                        entry = day_open + 1250
                        target = entry - tp
                        stop = entry + sl

                        # Check remaining bars
                        rem = g.iloc[i:]
                        min_p = rem['low'].min()
                        max_p = rem['high'].max()

                        # Which touched first?
                        hit_tp = min_p <= target
                        hit_sl = max_p >= stop

                        if hit_tp and not hit_sl:
                            wins += 1
                            pnl += tp
                        elif hit_sl and not hit_tp:
                            losses += 1
                            pnl -= sl
                        elif hit_tp and hit_sl:
                            tp_idx = rem[rem['low'] <= target].index[0]
                            sl_idx = rem[rem['high'] >= stop].index[0]
                            if tp_idx < sl_idx:
                                wins += 1
                                pnl += tp
                            else:
                                losses += 1
                                pnl -= sl
                        else:
                            # End of day close
                            eod = rem['close'].iloc[-1]
                            pnl += (entry - eod)

                    # Long trigger
                    if not long_done and bar['low'] <= day_open - 1250:
                        long_done = True
                        trades_count += 1
                        entry = day_open - 1250
                        target = entry + tp
                        stop = entry - sl

                        rem = g.iloc[i:]
                        min_p = rem['low'].min()
                        max_p = rem['high'].max()

                        hit_tp = max_p >= target
                        hit_sl = min_p <= stop

                        if hit_tp and not hit_sl:
                            wins += 1
                            pnl += tp
                        elif hit_sl and not hit_tp:
                            losses += 1
                            pnl -= sl
                        elif hit_tp and hit_sl:
                            tp_idx = rem[rem['high'] >= target].index[0]
                            sl_idx = rem[rem['low'] <= stop].index[0]
                            if tp_idx < sl_idx:
                                wins += 1
                                pnl += tp
                            else:
                                losses += 1
                                pnl -= sl
                        else:
                            eod = rem['close'].iloc[-1]
                            pnl += (eod - entry)

        total = wins + losses
        if total > 0:
            wr = (wins / total) * 100
            gross_win = wins * tp
            gross_loss = losses * sl
            pf = (gross_win / gross_loss) if gross_loss > 0 else 99.0
            if pf > 1.15:
                print(f"{tp:8d} | {sl:8d} | {total:12d} | {wr:9.1f}% | {pf:13.2f} | {pnl:+14.1f}")
