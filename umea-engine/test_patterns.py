import pandas as pd
import numpy as np

df = pd.read_parquet('data/raw/FXVol60_H1.parquet')
df['range'] = df['high'] - df['low']
df['body'] = (df['close'] - df['open']).abs()
df['is_bull'] = df['close'] > df['open']
df['is_bear'] = df['close'] < df['open']
df['atr'] = df['range'].rolling(14).mean()
df['hour'] = df.index.hour
df['date'] = df.index.date

# 1. Opening Range Breakout (ORB): Hours 00:00 to 02:00 vs Rest of the Day
daily_records = []
for d, g in df.groupby('date'):
    if len(g) >= 23:
        # Opening range: First 3 hours (00:00, 01:00, 02:00)
        open_range = g[g['hour'].isin([0, 1, 2])]
        rest_of_day = g[g['hour'] > 2]
        if len(open_range) == 3 and len(rest_of_day) > 0:
            or_high = open_range['high'].max()
            or_low = open_range['low'].min()
            or_size = or_high - or_low

            rod_high = rest_of_day['high'].max()
            rod_low = rest_of_day['low'].min()

            broke_high = rod_high > or_high
            broke_low = rod_low < or_low

            daily_records.append({
                'date': d,
                'or_high': or_high,
                'or_low': or_low,
                'or_size': or_size,
                'broke_high': broke_high,
                'broke_low': broke_low,
                'both_broken': broke_high and broke_low,
                'only_high': broke_high and not broke_low,
                'only_low': broke_low and not broke_high,
                'neither': not broke_high and not broke_low,
                'day_close': g['close'].iloc[-1],
                'day_open': g['open'].iloc[0],
            })

df_or = pd.DataFrame(daily_records)
print("=== 1. DAILY OPENING RANGE BREAKOUT (ORB 00:00-02:00) ===")
print(f"Total Days: {len(df_or):,}")
print(f"Broke High of Opening Range: {df_or['broke_high'].mean()*100:.1f}%")
print(f"Broke Low of Opening Range: {df_or['broke_low'].mean()*100:.1f}%")
print(f"Trending Day (Only broke High, never Low): {df_or['only_high'].mean()*100:.1f}%")
print(f"Trending Day (Only broke Low, never High): {df_or['only_low'].mean()*100:.1f}%")
print(f"Both High and Low Broken (Expansive/Chop): {df_or['both_broken'].mean()*100:.1f}%")

# 2. Extreme Candle Reversion / Continuation
large_candles = df[df['range'] > 2.0 * df['atr']].copy()
print(f"\n=== 2. VOLATILITY EXPANSION REACTIONS (> 2.0x ATR) ===")
print(f"Total Extreme Candles: {len(large_candles)}")

results = []
for idx in large_candles.index:
    loc = df.index.get_loc(idx)
    if loc + 1 < len(df):
        curr = df.iloc[loc]
        nxt = df.iloc[loc + 1]
        results.append({
            'curr_bull': curr['is_bull'],
            'curr_bear': curr['is_bear'],
            'next_bull': nxt['is_bull'],
            'next_bear': nxt['is_bear'],
            'curr_body_pct': curr['body'] / curr['range'] if curr['range'] > 0 else 0,
            'next_return': nxt['close'] - nxt['open']
        })

df_res = pd.DataFrame(results)
bulls = df_res[df_res['curr_bull'] == True]
bears = df_res[df_res['curr_bear'] == True]

print(f"After Extreme Bull Candle -> Next Bullish: {bulls['next_bull'].mean()*100:.1f}% | Next Bearish: {bulls['next_bear'].mean()*100:.1f}%")
print(f"After Extreme Bear Candle -> Next Bearish: {bears['next_bear'].mean()*100:.1f}% | Next Bullish: {bears['next_bull'].mean()*100:.1f}%")

# 3. What if the extreme candle has a VERY LARGE BODY (Marubozu / Institutional impulse > 75% body)?
high_body_bulls = bulls[bulls['curr_body_pct'] >= 0.75]
high_body_bears = bears[bears['curr_body_pct'] >= 0.75]

print(f"\nAfter Strong Solid Body Bull (>75% body) -> Next Bull: {high_body_bulls['next_bull'].mean()*100:.1f}% | Next Bear: {high_body_bulls['next_bear'].mean()*100:.1f}%")
print(f"After Strong Solid Body Bear (>75% body) -> Next Bear: {high_body_bears['next_bear'].mean()*100:.1f}% | Next Bull: {high_body_bears['next_bull'].mean()*100:.1f}%")
