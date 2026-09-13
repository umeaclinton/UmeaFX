import pandas as pd
import numpy as np

df = pd.read_parquet('data/raw/FXVol60_H1.parquet')
df['range'] = df['high'] - df['low']
df['body'] = (df['close'] - df['open']).abs()
df['is_bull'] = df['close'] > df['open']
df['is_bear'] = df['close'] < df['open']
df['ema20'] = df['close'].ewm(span=20, adjust=False).mean()

print("=== MOMENTUM-FILTERED 1H WICK RETRACEMENT TEST ===")
print("Dip Entry | SL (pts) | TP (pts) | Total Trades | Win Rate % | Profit Factor | Net Points PnL")
print("-" * 80)

# Filter:
# 1. Two consecutive candles in same direction (strong trend impulse)
# 2. Strong candle body (> 200 pts)
configs = [
    (100, 150, 250),
    (100, 200, 300),
    (120, 180, 300),
    (120, 200, 300),
    (150, 200, 350),
    (150, 250, 400),
    (150, 200, 300)
]

for dip_entry, sl_pts, tp_pts in configs:
    wins = 0
    losses = 0

    for i in range(25, len(df)):
        c1 = df.iloc[i - 2]
        c2 = df.iloc[i - 1]
        c3 = df.iloc[i]

        # Bullish Momentum: 2 consecutive green candles with solid bodies and above EMA20
        if c1['is_bull'] and c2['is_bull'] and c2['body'] >= 200 and c2['close'] > c2['ema20']:
            limit_price = c3['open'] - dip_entry
            if c3['low'] <= limit_price:
                sl_price = limit_price - sl_pts
                tp_price = limit_price + tp_pts

                hit_sl = c3['low'] <= sl_price
                hit_tp = c3['high'] >= tp_price

                if hit_tp and not hit_sl:
                    wins += 1
                elif hit_sl and not hit_tp:
                    losses += 1
                elif hit_tp and hit_sl:
                    losses += 1
                else:
                    if c3['close'] > limit_price:
                        wins += 1
                    else:
                        losses += 1

        # Bearish Momentum: 2 consecutive red candles with solid bodies and below EMA20
        elif c1['is_bear'] and c2['is_bear'] and c2['body'] >= 200 and c2['close'] < c2['ema20']:
            limit_price = c3['open'] + dip_entry
            if c3['high'] >= limit_price:
                sl_price = limit_price + sl_pts
                tp_price = limit_price - tp_pts

                hit_sl = c3['high'] >= sl_price
                hit_tp = c3['low'] <= tp_price

                if hit_tp and not hit_sl:
                    wins += 1
                elif hit_sl and not hit_tp:
                    losses += 1
                elif hit_tp and hit_sl:
                    losses += 1
                else:
                    if c3['close'] < limit_price:
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
