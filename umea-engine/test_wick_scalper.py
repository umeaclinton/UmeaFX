import pandas as pd
import numpy as np

df = pd.read_parquet('data/raw/FXVol60_H1.parquet')
df['range'] = df['high'] - df['low']
df['body'] = (df['close'] - df['open']).abs()
df['is_bull'] = df['close'] > df['open']
df['is_bear'] = df['close'] < df['open']
df['ema20'] = df['close'].ewm(span=20, adjust=False).mean()

# Test the User's Strategy:
# 1H Wick Retracement Scalper:
# When 1H candle closes in trend:
# Next 1H: Place Limit Order at (Open +/- dip_entry)
# SL = stop_dist
# TP = take_dist

print("=== 1H WICK RETRACEMENT STRATEGY BACKTEST (24,718 CANDLES) ===")
print("Dip Entry | SL (pts) | TP (pts) | Total Trades | Win Rate % | Profit Factor | Net Points PnL")
print("-" * 80)

configs = [
    (60, 120, 200),
    (75, 150, 250),
    (80, 160, 240),
    (100, 150, 250),
    (100, 200, 300),
    (120, 200, 300),
    (150, 250, 350),
]

for dip_entry, sl_pts, tp_pts in configs:
    wins = 0
    losses = 0
    trades = 0

    for i in range(25, len(df)):
        prev = df.iloc[i - 1]
        curr = df.iloc[i]

        # Bullish Setup: Prev candle closed BULLISH and above EMA20
        if prev['is_bull'] and prev['close'] > prev['ema20'] and prev['body'] > 100:
            limit_price = curr['open'] - dip_entry
            # Did current bar dip to limit_price?
            if curr['low'] <= limit_price:
                trades += 1
                sl_price = limit_price - sl_pts
                tp_price = limit_price + tp_pts

                hit_sl = curr['low'] <= sl_price
                hit_tp = curr['high'] >= tp_price

                if hit_tp and not hit_sl:
                    wins += 1
                elif hit_sl and not hit_tp:
                    losses += 1
                elif hit_tp and hit_sl:
                    # Conservative assumption: SL hit first
                    losses += 1
                else:
                    # Bar closed without hitting either: evaluate close
                    if curr['close'] > limit_price:
                        wins += 1
                    else:
                        losses += 1

        # Bearish Setup: Prev candle closed BEARISH and below EMA20
        elif prev['is_bear'] and prev['close'] < prev['ema20'] and prev['body'] > 100:
            limit_price = curr['open'] + dip_entry
            if curr['high'] >= limit_price:
                trades += 1
                sl_price = limit_price + sl_pts
                tp_price = limit_price - tp_pts

                hit_sl = curr['high'] >= sl_price
                hit_tp = curr['low'] <= tp_price

                if hit_tp and not hit_sl:
                    wins += 1
                elif hit_sl and not hit_tp:
                    losses += 1
                elif hit_tp and hit_sl:
                    losses += 1
                else:
                    if curr['close'] < limit_price:
                        wins += 1
                    else:
                        losses += 1

    total = wins + losses
    if total > 0:
        wr = (wins / total) * 100.0
        gross_win = wins * tp_pts
        gross_loss = losses * sl_pts
        pf = gross_win / gross_loss if gross_loss > 0 else 0
        net_pts = gross_win - gross_loss
        print(f"{dip_entry:9d} | {sl_pts:8d} | {tp_pts:8d} | {total:12d} | {wr:9.1f}% | {pf:13.2f} | {net_pts:+14,d}")
