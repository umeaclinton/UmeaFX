import pandas as pd
import numpy as np

df = pd.read_parquet('data/raw/FXVol60_H1.parquet')
df['hour'] = df.index.hour
df['date'] = df.index.date
df['is_bull'] = df['close'] > df['open']
df['is_bear'] = df['close'] < df['open']

trades = []
for d, g in df.groupby('date'):
    if len(g) >= 20:
        day_open = g['open'].iloc[0]
        short_taken = False
        long_taken = False

        for i in range(1, len(g)):
            bar = g.iloc[i]
            prev_bar = g.iloc[i - 1]

            # Short Setup: Price pushed > 1200 above day_open, and then prints the FIRST BEARISH 1H candle!
            if not short_taken and prev_bar['high'] >= day_open + 1200 and bar['is_bear']:
                short_taken = True
                entry = bar['close']
                sl = g['high'].iloc[:i+1].max() + 100  # SL above high of day so far + 100 pts
                sl_dist = sl - entry
                
                # Check outcome in remaining bars of the day
                remaining = g.iloc[i+1:]
                if len(remaining) > 0 and sl_dist > 50:
                    tp = entry - (sl_dist * 1.5)  # 1.5R target
                    hit_tp = remaining['low'].min() <= tp
                    hit_sl = remaining['high'].max() >= sl
                    
                    pnl_r = 0.0
                    if hit_tp and not hit_sl:
                        pnl_r = 1.5
                    elif hit_sl and not hit_tp:
                        pnl_r = -1.0
                    elif hit_tp and hit_sl:
                        # Which occurred first?
                        first_tp_idx = remaining[remaining['low'] <= tp].index[0]
                        first_sl_idx = remaining[remaining['high'] >= sl].index[0]
                        pnl_r = 1.5 if first_tp_idx < first_sl_idx else -1.0
                    else:
                        # Close at end of day
                        end_close = remaining['close'].iloc[-1]
                        pnl_r = (entry - end_close) / sl_dist

                    trades.append({
                        'type': 'SHORT',
                        'date': d,
                        'hour': bar['hour'],
                        'entry': entry,
                        'sl_dist': sl_dist,
                        'pnl_r': pnl_r,
                        'win': pnl_r > 0
                    })

            # Long Setup: Price pushed > 1200 below day_open, and then prints the FIRST BULLISH 1H candle!
            if not long_taken and prev_bar['low'] <= day_open - 1200 and bar['is_bull']:
                long_taken = True
                entry = bar['close']
                sl = g['low'].iloc[:i+1].min() - 100
                sl_dist = entry - sl
                
                remaining = g.iloc[i+1:]
                if len(remaining) > 0 and sl_dist > 50:
                    tp = entry + (sl_dist * 1.5)
                    hit_tp = remaining['high'].max() >= tp
                    hit_sl = remaining['low'].min() <= sl

                    pnl_r = 0.0
                    if hit_tp and not hit_sl:
                        pnl_r = 1.5
                    elif hit_sl and not hit_tp:
                        pnl_r = -1.0
                    elif hit_tp and hit_sl:
                        first_tp_idx = remaining[remaining['high'] >= tp].index[0]
                        first_sl_idx = remaining[remaining['low'] <= sl].index[0]
                        pnl_r = 1.5 if first_tp_idx < first_sl_idx else -1.0
                    else:
                        end_close = remaining['close'].iloc[-1]
                        pnl_r = (end_close - entry) / sl_dist

                    trades.append({
                        'type': 'LONG',
                        'date': d,
                        'hour': bar['hour'],
                        'entry': entry,
                        'sl_dist': sl_dist,
                        'pnl_r': pnl_r,
                        'win': pnl_r > 0
                    })

df_ct = pd.DataFrame(trades)
print("=== CONFIRMED DAILY EXTREME REVERSION (1.5R TARGET) ===")
print(f"Total Trades: {len(df_ct)} over 1,027 days ({len(df_ct)/1027:.2f} trades/day)")
print(f"Winning Trades: {df_ct['win'].sum()} ({(df_ct['win'].mean())*100:.1f}%)")
print(f"Average Return per Trade: {df_ct['pnl_r'].mean():+.2f}R")
print(f"Total Return in R: {df_ct['pnl_r'].sum():+.1f}R")
gross_win = df_ct[df_ct['pnl_r'] > 0]['pnl_r'].sum()
gross_loss = abs(df_ct[df_ct['pnl_r'] < 0]['pnl_r'].sum())
print(f"Profit Factor: {gross_win / gross_loss:.2f}")
