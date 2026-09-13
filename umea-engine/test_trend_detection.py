import pandas as pd
import numpy as np

df = pd.read_parquet('data/raw/FXVol60_H1.parquet')
df['hour'] = df.index.hour
df['date'] = df.index.date
df['is_bull'] = df['close'] > df['open']
df['is_bear'] = df['close'] < df['open']
df['ema20'] = df['close'].ewm(span=20, adjust=False).mean()

print("=== TESTING TREND DIRECTION DETECTION METHODS FOR NEW DAY ===")

# Test 1: Just 1st candle of the day (Hour 0)
# If Hour 0 is Bullish, does the rest of the day close Bullish?
# If Hour 0 is Bullish, does price push up further than down?
m1_records = []
for d, g in df.groupby('date'):
    if len(g) >= 20:
        h0 = g[g['hour'] == 0]
        if len(h0) > 0:
            h0_bar = h0.iloc[0]
            rest = g[g['hour'] > 0]
            if len(rest) > 0:
                h0_bull = h0_bar['is_bull']
                day_net = rest['close'].iloc[-1] - h0_bar['open']
                max_up = rest['high'].max() - h0_bar['open']
                max_down = h0_bar['open'] - rest['low'].min()
                m1_records.append({
                    'h0_bull': h0_bull,
                    'rest_bull': day_net > 0,
                    'pushed_up_more': max_up > max_down
                })

df_m1 = pd.DataFrame(m1_records)
acc_single_candle = (df_m1['h0_bull'] == df_m1['rest_bull']).mean() * 100
acc_single_push = (df_m1['h0_bull'] == df_m1['pushed_up_more']).mean() * 100
print(f"Method 1 (Single 00:00 Candle): Accuracy in predicting day's net direction: {acc_single_candle:.1f}% | Push direction: {acc_single_push:.1f}%")

# Test 2: Opening Range Breakout (Hours 00:00 to 02:00)
# If Hour 2 or 3 breaks above Hour 0-1 High, does it trend up?
m2_records = []
for d, g in df.groupby('date'):
    if len(g) >= 20:
        or_bars = g[g['hour'].isin([0, 1])]
        rest = g[g['hour'] >= 2]
        if len(or_bars) == 2 and len(rest) > 0:
            or_h = or_bars['high'].max()
            or_l = or_bars['low'].min()
            
            # Find first break
            break_dir = None
            break_idx = None
            for i in range(len(rest)):
                bar = rest.iloc[i]
                if bar['close'] > or_h:
                    break_dir = 'BULL'
                    break_idx = i
                    break
                elif bar['close'] < or_l:
                    break_dir = 'BEAR'
                    break_idx = i
                    break
            
            if break_dir:
                remaining = rest.iloc[break_idx+1:]
                if len(remaining) > 0:
                    entry_p = rest.iloc[break_idx]['close']
                    end_p = remaining['close'].iloc[-1]
                    m2_records.append({
                        'break_dir': break_dir,
                        'win': (end_p > entry_p) if break_dir == 'BULL' else (end_p < entry_p),
                        'max_favorable': (remaining['high'].max() - entry_p) if break_dir == 'BULL' else (entry_p - remaining['low'].min()),
                        'max_adverse': (entry_p - remaining['low'].min()) if break_dir == 'BULL' else (remaining['high'].max() - entry_p)
                    })

df_m2 = pd.DataFrame(m2_records)
print(f"Method 2 (Opening Range 00:00-01:00 Breakout): Total Days with Break: {len(df_m2):,} | Continuation Accuracy: {df_m2['win'].mean()*100:.1f}%")
print(f"   Avg Favorable Push After Breakout: {df_m2['max_favorable'].mean():.1f} pts vs Avg Adverse: {df_m2['max_adverse'].mean():.1f} pts")

# Test 3: The 2-Consecutive Impulse Wave + EMA 20
# Whenever ANY two consecutive 1H candles close in same direction and align with EMA 20
m3_records = []
for i in range(25, len(df) - 1):
    c1 = df.iloc[i - 1]
    c2 = df.iloc[i]
    c3 = df.iloc[i + 1]
    
    if c1['is_bull'] and c2['is_bull'] and c2['close'] > c2['ema20']:
        m3_records.append({
            'trend': 'BULL',
            'next_bull': c3['is_bull'],
            'next_pushed_higher': c3['high'] > c2['high']
        })
    elif c1['is_bear'] and c2['is_bear'] and c2['close'] < c2['ema20']:
        m3_records.append({
            'trend': 'BEAR',
            'next_bear': c3['is_bear'],
            'next_pushed_lower': c3['low'] < c2['low']
        })

df_m3 = pd.DataFrame(m3_records)
bull_push = df_m3[df_m3['trend'] == 'BULL']['next_pushed_higher'].mean() * 100
bear_push = df_m3[df_m3['trend'] == 'BEAR']['next_pushed_lower'].mean() * 100
print(f"Method 3 (2 Consecutive Impulse Candles + EMA20): Total Signals: {len(df_m3):,}")
print(f"   Bullish Push Continuation Rate: {bull_push:.1f}%")
print(f"   Bearish Push Continuation Rate: {bear_push:.1f}%")
