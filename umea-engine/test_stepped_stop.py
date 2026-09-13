import pandas as pd
import numpy as np

df = pd.read_parquet('data/raw/FXVol60_H1.parquet')
df['is_bull'] = df['close'] > df['open']
df['is_bear'] = df['close'] < df['open']
df['body'] = (df['close'] - df['open']).abs()
df['ema20'] = df['close'].ewm(span=20, adjust=False).mean()

dip_entry = 120.0
initial_sl = 250.0
tp_pts = 500.0

print("=== TESTING STEPPED / TRAILING RISK REDUCTION ===")
# Profile A: Move SL to -100 pts (cut risk by 60%) when at +250 pts profit
# Profile B: Move SL to -50 pts (cut risk by 80%) when at +300 pts profit
# Profile C: Move SL to +100 pts (lock profit) when at +350 pts profit
# Profile D: No BE (Pure SL 250 / TP 500)

profiles = [
    ("No BE (Fixed SL 250, TP 500)", None, None),
    ("Stepped Risk: At +250 pts, move SL to -100 pts", 250, -100),
    ("Stepped Risk: At +300 pts, move SL to -50 pts", 300, -50),
    ("Stepped Lock: At +350 pts, move SL to +100 pts", 350, 100),
    ("Stepped Lock: At +400 pts, move SL to +150 pts", 400, 150),
]

for name, trig, new_sl in profiles:
    tp_count = 0
    sl_count = 0
    stepped_stops = 0
    net_pts = 0.0

    for i in range(25, len(df)):
        c1 = df.iloc[i - 2]
        c2 = df.iloc[i - 1]
        c3 = df.iloc[i]

        if c1['is_bull'] and c2['is_bull'] and c2['body'] >= 120 and c2['close'] > c2['ema20']:
            limit_p = c3['open'] - dip_entry
            if c3['low'] <= limit_p:
                entry_p = limit_p
                tp_p = entry_p + tp_pts
                current_sl_p = entry_p - initial_sl
                stepped_active = False

                end_idx = min(len(df), i + 6)
                bars_window = df.iloc[i:end_idx]

                for b_idx in range(len(bars_window)):
                    bar = bars_window.iloc[b_idx]
                    
                    if trig is not None and not stepped_active:
                        if bar['high'] >= (entry_p + trig):
                            stepped_active = True
                            current_sl_p = entry_p + new_sl

                    if bar['low'] <= current_sl_p:
                        if stepped_active:
                            stepped_stops += 1
                            net_pts += new_sl
                        else:
                            sl_count += 1
                            net_pts -= initial_sl
                        break

                    if bar['high'] >= tp_p:
                        tp_count += 1
                        net_pts += tp_pts
                        break

    tot = tp_count + sl_count + stepped_stops
    gross_w = (tp_count * tp_pts) + (stepped_stops * max(0, new_sl if new_sl is not None else 0))
    gross_l = (sl_count * initial_sl) + (stepped_stops * abs(min(0, new_sl if new_sl is not None else 0)))
    pf = gross_w / gross_l if gross_l > 0 else 0
    print(f"\nProfile: {name}")
    print(f"Total: {tot:,} | TP Hits: {tp_count:,} | Trailed/Stepped Exits: {stepped_stops:,} | Full Losses: {sl_count:,}")
    print(f"Profit Factor: {pf:.2f} | Net Points PnL: {net_pts:+,.0f}")
