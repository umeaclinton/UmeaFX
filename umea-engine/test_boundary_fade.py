import pandas as pd
import numpy as np

df = pd.read_parquet('data/raw/FXVol60_H1.parquet')
df['hour'] = df.index.hour
df['date'] = df.index.date

# Test: What percentage of days does price touch +1200 from Open, and what does it do after?
trades = []
for d, g in df.groupby('date'):
    if len(g) >= 20:
        day_open = g['open'].iloc[0]
        # Check hour by hour
        short_triggered = False
        long_triggered = False
        
        for i in range(len(g)):
            bar = g.iloc[i]
            # If price reaches +1250 above day_open
            if not short_triggered and bar['high'] >= day_open + 1250:
                short_triggered = True
                # What is the minimum price after this bar until end of day?
                remaining = g.iloc[i:]
                min_after = remaining['low'].min()
                # Did it pull back by at least 400 pts?
                pullback = (day_open + 1250) - min_after
                trades.append({
                    'type': 'SHORT',
                    'date': d,
                    'entry_hour': bar['hour'],
                    'entry_price': day_open + 1250,
                    'pullback_pts': pullback,
                    'reached_open': min_after <= day_open,
                    'max_adverse': remaining['high'].max() - (day_open + 1250)
                })

            # If price reaches -1250 below day_open
            if not long_triggered and bar['low'] <= day_open - 1250:
                long_triggered = True
                remaining = g.iloc[i:]
                max_after = remaining['high'].max()
                bounce = max_after - (day_open - 1250)
                trades.append({
                    'type': 'LONG',
                    'date': d,
                    'entry_hour': bar['hour'],
                    'entry_price': day_open - 1250,
                    'pullback_pts': bounce,
                    'reached_open': max_after >= day_open,
                    'max_adverse': (day_open - 1250) - remaining['low'].min()
                })

df_tr = pd.DataFrame(trades)
print("=== DAILY ENVELOPE BOUNDARY MEAN-REVERSION (1,250 PTS FROM OPEN) ===")
print(f"Total Triggers: {len(df_tr)} across 1,027 days (roughly {len(df_tr)/1027:.2f} per day)")
print(f"Average Reversion/Pullback: {df_tr['pullback_pts'].mean():.2f} pts")
print(f"Pullback >= 300 pts: {(df_tr['pullback_pts'] >= 300).mean()*100:.1f}%")
print(f"Pullback >= 500 pts: {(df_tr['pullback_pts'] >= 500).mean()*100:.1f}%")
print(f"Pullback >= 800 pts: {(df_tr['pullback_pts'] >= 800).mean()*100:.1f}%")
print(f"Returned All the Way to Daily Open (1,250 pts gain!): {df_tr['reached_open'].mean()*100:.1f}%")
print(f"Average Adverse Excursion (Drawdown before reversion): {df_tr['max_adverse'].mean():.2f} pts")
