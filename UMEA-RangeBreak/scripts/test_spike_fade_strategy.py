"""
UMEA-RangeBreak: Spike Fade & Boundary Ping-Pong Strategy Tester
Simulates the user's strategy on 100,125 M1 bars:
1. Fade the extreme peak of a Buy Spike (SELL on exhaustion)
2. Fade the extreme bottom of a Sell Spike (BUY on exhaustion)
3. Fading subsequent re-tests of the newly established range boundaries
"""

import os
import pandas as pd
import numpy as np

DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "range_break_100_m1.csv")
REPORT_PATH = os.path.join(os.path.dirname(__file__), "..", "analysis", "spike_fade_report.txt")

def run_test():
    print(f"Loading M1 data from {DATA_PATH}...")
    df = pd.read_csv(DATA_PATH)
    df['time'] = pd.to_datetime(df['time'])
    df.sort_values('time', inplace=True)
    df.reset_index(drop=True, inplace=True)
    print(f"Loaded {len(df):,} M1 bars.")

    df['range'] = df['high'] - df['low']
    df['body'] = df['close'] - df['open']
    df['abs_body'] = df['body'].abs()

    # In M1, normal candles have ranges < 10-15 pts.
    # A true spike candle has a body > 80 pts (often 100-200 pts in a single minute).
    spike_threshold = 80.0
    df['is_buy_spike'] = df['body'] >= spike_threshold
    df['is_sell_spike'] = df['body'] <= -spike_threshold

    buy_spikes = df[df['is_buy_spike']].index.tolist()
    sell_spikes = df[df['is_sell_spike']].index.tolist()

    print(f"\nIdentified {len(buy_spikes):,} BUY Spikes (Bullish impulses >= {spike_threshold} pts)")
    print(f"Identified {len(sell_spikes):,} SELL Spikes (Bearish impulses <= -{spike_threshold} pts)")

    # -------------------------------------------------------------
    # 1. EVALUATE BUY SPIKE FADE (SELL AT SPIKE PEAK)
    # -------------------------------------------------------------
    print("\n==================================================")
    print("1. BUY SPIKE FADE: SELL AT CLOSE OF BUY SPIKE")
    print("==================================================")

    buy_fade_results = []
    for idx in buy_spikes:
        if idx + 30 >= len(df):
            continue

        spike_high = df.loc[idx, 'high']
        entry_price = df.loc[idx, 'close'] # Enter SELL at close of spike bar

        # Track the next 15 bars (15 minutes)
        sub_df = df.loc[idx+1 : idx+15]
        
        # Max Adverse Excursion (highest price went above entry)
        max_high = sub_df['high'].max()
        adverse_pts = max(0.0, max_high - entry_price)
        exceeded_spike_high = max_high > spike_high

        # Max Favorable Excursion (lowest price went below entry - our profit)
        min_low = sub_df['low'].min()
        favorable_pts = max(0.0, entry_price - min_low)

        # Measure 1-min, 3-min, 5-min close returns
        ret_1m = entry_price - df.loc[idx+1, 'close']
        ret_3m = entry_price - df.loc[idx+3, 'close']
        ret_5m = entry_price - df.loc[idx+5, 'close']

        buy_fade_results.append({
            'idx': idx,
            'entry_price': entry_price,
            'spike_high': spike_high,
            'adverse_pts': adverse_pts,
            'favorable_pts': favorable_pts,
            'exceeded_spike_high': exceeded_spike_high,
            'ret_1m': ret_1m,
            'ret_3m': ret_3m,
            'ret_5m': ret_5m
        })

    bdf = pd.DataFrame(buy_fade_results)
    
    print(f"Total Buy Spike Fades Analyzed: {len(bdf):,}")
    print(f"Average Profit Drawdown (MAE):   {bdf['adverse_pts'].mean():.2f} pts (Median: {bdf['adverse_pts'].median():.2f} pts)")
    print(f"Average Max Retracement (MFE):   {bdf['favorable_pts'].mean():.2f} pts (Median: {bdf['favorable_pts'].median():.2f} pts)")
    print(f"How often did price exceed the Spike High in 15 mins? {bdf['exceeded_spike_high'].mean()*100:.2f}% (Holds true {(1-bdf['exceeded_spike_high'].mean())*100:.2f}% of the time!)")

    # Win rates at various TP targets (with No SL or SL at Spike High)
    print("\nWin Rates for Quick Scalp Take-Profit (Within 15 mins, SL at Spike High):")
    for tp in [5, 10, 15, 20, 25, 30, 40, 50]:
        # Won if reached TP before hitting spike_high
        # Let's compute exact bar-by-bar outcome
        wins = 0
        for _, row in bdf.iterrows():
            idx = int(row['idx'])
            entry = row['entry_price']
            sh = row['spike_high']
            hit_tp = False
            hit_sl = False
            for k in range(1, 16):
                b = df.loc[idx + k]
                if b['high'] > sh: # pierced spike high
                    hit_sl = True
                    break
                if entry - b['low'] >= tp: # reached TP
                    hit_tp = True
                    break
            if hit_tp:
                wins += 1
        win_rate = wins / len(bdf) * 100
        print(f"  TP = +{tp:2d} pts: Win Rate = {win_rate:5.2f}% ({wins:,} wins out of {len(bdf):,})")

    # -------------------------------------------------------------
    # 2. EVALUATE SELL SPIKE FADE (BUY AT SPIKE BOTTOM)
    # -------------------------------------------------------------
    print("\n==================================================")
    print("2. SELL SPIKE FADE: BUY AT CLOSE OF SELL SPIKE")
    print("==================================================")

    sell_fade_results = []
    for idx in sell_spikes:
        if idx + 30 >= len(df):
            continue

        spike_low = df.loc[idx, 'low']
        entry_price = df.loc[idx, 'close'] # Enter BUY at close of spike bar

        sub_df = df.loc[idx+1 : idx+15]
        min_low = sub_df['low'].min()
        adverse_pts = max(0.0, entry_price - min_low)
        exceeded_spike_low = min_low < spike_low

        max_high = sub_df['high'].max()
        favorable_pts = max(0.0, max_high - entry_price)

        sell_fade_results.append({
            'idx': idx,
            'entry_price': entry_price,
            'spike_low': spike_low,
            'adverse_pts': adverse_pts,
            'favorable_pts': favorable_pts,
            'exceeded_spike_low': exceeded_spike_low
        })

    sdf = pd.DataFrame(sell_fade_results)
    print(f"Total Sell Spike Fades Analyzed: {len(sdf):,}")
    print(f"Average Profit Drawdown (MAE):   {sdf['adverse_pts'].mean():.2f} pts (Median: {sdf['adverse_pts'].median():.2f} pts)")
    print(f"Average Max Bounce (MFE):        {sdf['favorable_pts'].mean():.2f} pts (Median: {sdf['favorable_pts'].median():.2f} pts)")
    print(f"How often did price pierce below the Spike Low in 15 mins? {sdf['exceeded_spike_low'].mean()*100:.2f}% (Holds true {(1-sdf['exceeded_spike_low'].mean())*100:.2f}% of the time!)")

    print("\nWin Rates for Quick Scalp Take-Profit (Within 15 mins, SL at Spike Low):")
    for tp in [5, 10, 15, 20, 25, 30, 40, 50]:
        wins = 0
        for _, row in sdf.iterrows():
            idx = int(row['idx'])
            entry = row['entry_price']
            sl_price = row['spike_low']
            hit_tp = False
            for k in range(1, 16):
                b = df.loc[idx + k]
                if b['low'] < sl_price:
                    break
                if b['high'] - entry >= tp:
                    hit_tp = True
                    break
            if hit_tp:
                wins += 1
        win_rate = wins / len(sdf) * 100
        print(f"  TP = +{tp:2d} pts: Win Rate = {win_rate:5.2f}% ({wins:,} wins out of {len(sdf):,})")

    # -------------------------------------------------------------
    # 3. SAVE COMPREHENSIVE REPORT
    # -------------------------------------------------------------
    os.makedirs(os.path.dirname(REPORT_PATH), exist_ok=True)
    with open(REPORT_PATH, 'w') as f:
        f.write("UMEA-RangeBreak 100 Index: Spike Fade Strategy Report\n")
        f.write("==================================================\n")
        f.write(f"Total M1 Bars Tested: {len(df):,}\n")
        f.write(f"Total Buy Spikes Tested: {len(bdf):,} | Total Sell Spikes Tested: {len(sdf):,}\n\n")
        f.write(f"Spike High Integrity (15 min window): {(1-bdf['exceeded_spike_high'].mean())*100:.2f}% respected\n")
        f.write(f"Spike Low Integrity (15 min window):  {(1-sdf['exceeded_spike_low'].mean())*100:.2f}% respected\n\n")
        f.write(f"Avg Retracement after Buy Spike:  {bdf['favorable_pts'].mean():.2f} pts\n")
        f.write(f"Avg Retracement after Sell Spike: {sdf['favorable_pts'].mean():.2f} pts\n")

    print(f"\n[DONE] Strategy report saved to {REPORT_PATH}")

if __name__ == "__main__":
    run_test()
