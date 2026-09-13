import pandas as pd
import numpy as np

df = pd.read_parquet('data/raw/FXVol60_H1.parquet')
df['hour'] = df.index.hour
df['date'] = df.index.date

records = []
for d, g in df.groupby('date'):
    if len(g) >= 23:
        day_open = g['open'].iloc[0]
        day_high = g['high'].max()
        day_low = g['low'].min()
        day_close = g['close'].iloc[-1]
        
        max_run_up = day_high - day_open
        max_run_down = day_open - day_low
        day_net = day_close - day_open
        
        records.append({
            'date': d,
            'day_open': day_open,
            'max_run_up': max_run_up,
            'max_run_down': max_run_down,
            'total_range': day_high - day_low,
            'day_net': day_net,
            'reversion_from_high': (day_high - day_close) / max_run_up if max_run_up > 0 else 0,
            'reversion_from_low': (day_close - day_low) / max_run_down if max_run_down > 0 else 0,
        })

df_days = pd.DataFrame(records)
print("=== DAILY PROFILE ANALYSIS (1,027 DAYS) ===")
print(f"Average Daily Range: {df_days['total_range'].mean():.2f} pts")
print(f"Average Max Run Up from Open: {df_days['max_run_up'].mean():.2f} pts")
print(f"Average Max Run Down from Open: {df_days['max_run_down'].mean():.2f} pts")
print(f"Average Net Close vs Open (Net Daily Body): {abs(df_days['day_net']).mean():.2f} pts")

# Ratio of Daily Net Body to Total Range:
# If this ratio is small, it means the market always pulls back significantly from the extremes!
wick_ratio = 1.0 - (abs(df_days['day_net']) / df_days['total_range'])
print(f"Average Daily Reversion/Wick Ratio: {wick_ratio.mean()*100:.1f}%")
print(f"Average Pullback from High of the Day before close: {df_days['reversion_from_high'].mean()*100:.1f}%")
print(f"Average Pullback from Low of the Day before close: {df_days['reversion_from_low'].mean()*100:.1f}%")
