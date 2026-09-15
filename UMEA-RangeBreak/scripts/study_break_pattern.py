"""
UMEA-RangeBreak Pattern & Frequency Study
Performs deep quantitative analysis on 100,000 M5 bars of Deriv Range Break 100 Index
to discover:
1. Breakout definition and size distribution
2. Range duration and break frequency
3. Directional bias (Bullish vs Bearish) and preceding predictors
4. Time & volatility signatures before the break
"""

import os
import pandas as pd
import numpy as np

DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "range_break_100_m5.csv")
REPORT_PATH = os.path.join(os.path.dirname(__file__), "..", "analysis", "break_study_report.txt")

def analyze():
    print(f"Loading data from {DATA_PATH}...")
    df = pd.read_csv(DATA_PATH)
    df['time'] = pd.to_datetime(df['time'])
    df.sort_values('time', inplace=True)
    df.reset_index(drop=True, inplace=True)

    print(f"Loaded {len(df):,} M5 bars.")

    # Calculate basic price metrics
    df['range'] = df['high'] - df['low']
    df['body'] = df['close'] - df['open']
    df['abs_body'] = df['body'].abs()
    df['direction'] = np.where(df['body'] > 0, 1, np.where(df['body'] < 0, -1, 0))

    # Rolling median and ATR to detect outliers (breakout spikes)
    df['rolling_med_range'] = df['range'].rolling(50).median()
    df['range_ratio'] = df['range'] / df['rolling_med_range']

    print("Price range percentiles:")
    for p in [50, 75, 90, 95, 99, 99.5, 99.9]:
        print(f"  {p}th percentile range: {df['range'].quantile(p/100):.2f} pts")

    # In Range Break 100, breakout candles are massive compared to consolidation candles
    # Let's inspect the threshold for breakout candles.
    # Typically, normal candles have ranges around 10-30 pts, while breaks are 100-300+ pts
    q95 = df['range'].quantile(0.95)
    q99 = df['range'].quantile(0.99)
    break_threshold = df['range'].quantile(0.98)
    print(f"\nBreakout threshold candidate (98th percentile): {break_threshold:.2f} pts")

    # Flag breakout bars where range is > 3x the 50-bar rolling median and > 98th percentile
    df['is_break'] = (df['range'] > break_threshold) & (df['range_ratio'] > 2.5)

    break_indices = df[df['is_break']].index
    print(f"Identified {len(break_indices):,} breakout candles ({len(break_indices)/len(df)*100:.2f}% of all bars)")

    # Analyze break candles
    break_df = df.loc[break_indices].copy()
    break_df['break_dir'] = np.where(break_df['body'] > 0, 'UP', 'DOWN')

    up_breaks = (break_df['break_dir'] == 'UP').sum()
    down_breaks = (break_df['break_dir'] == 'DOWN').sum()
    print(f"\nBreak Direction Split:")
    print(f"  UP Breaks:   {up_breaks:,} ({up_breaks/len(break_df)*100:.2f}%)")
    print(f"  DOWN Breaks: {down_breaks:,} ({down_breaks/len(break_df)*100:.2f}%)")

    # Range Duration / Frequency (Bars between consecutive breaks)
    bars_between = np.diff(break_indices)
    print("\nRange Duration (M5 bars between breaks):")
    print(f"  Mean bars between breaks:   {np.mean(bars_between):.1f} bars ({np.mean(bars_between)*5:.1f} mins / {np.mean(bars_between)*5/60:.2f} hours)")
    print(f"  Median bars between breaks: {np.median(bars_between):.1f} bars ({np.median(bars_between)*5:.1f} mins / {np.median(bars_between)*5/60:.2f} hours)")
    print(f"  Min bars between breaks:    {np.min(bars_between)} bars")
    print(f"  Max bars between breaks:    {np.max(bars_between)} bars")
    print(f"  Std Dev:                    {np.std(bars_between):.1f} bars")

    # Autoregressive / Transition probabilities: Does UP lead to UP or DOWN?
    break_dirs = break_df['break_dir'].values
    up_after_up = 0
    down_after_up = 0
    up_after_down = 0
    down_after_down = 0

    for i in range(len(break_dirs) - 1):
        curr_b = break_dirs[i]
        next_b = break_dirs[i+1]
        if curr_b == 'UP':
            if next_b == 'UP':
                up_after_up += 1
            else:
                down_after_up += 1
        elif curr_b == 'DOWN':
            if next_b == 'UP':
                up_after_down += 1
            else:
                down_after_down += 1

    print("\nTransition Probabilities (Consecutive Breaks):")
    print(f"  After UP break -> Next UP:   {up_after_up:,} ({up_after_up/(up_after_up+down_after_up)*100:.2f}%) | Next DOWN: {down_after_up:,} ({down_after_up/(up_after_up+down_after_up)*100:.2f}%)")
    print(f"  After DOWN break -> Next UP: {up_after_down:,} ({up_after_down/(up_after_down+down_after_down)*100:.2f}%) | Next DOWN: {down_after_down:,} ({down_after_down/(up_after_down+down_after_down)*100:.2f}%)")

    # Pre-Break Behavior: What happens in the 3, 5, and 10 bars BEFORE a break?
    print("\nAnalyzing Pre-Break Price Action...")
    pre_break_features = []
    
    for idx in break_indices:
        if idx < 20:
            continue
        actual_dir = break_df.loc[idx, 'break_dir']
        
        # Look at last 5 bars before the break
        prior_5 = df.loc[idx-5:idx-1]
        prior_body_sum = prior_5['body'].sum()
        prior_return = (df.loc[idx-1, 'close'] - df.loc[idx-5, 'open'])
        
        # Position in recent range: Where was price relative to the 20-bar High and Low?
        prior_20 = df.loc[idx-20:idx-1]
        p20_high = prior_20['high'].max()
        p20_low = prior_20['low'].min()
        close_minus_1 = df.loc[idx-1, 'close']
        
        if p20_high > p20_low:
            range_position = (close_minus_1 - p20_low) / (p20_high - p20_low)
        else:
            range_position = 0.5
            
        pre_break_features.append({
            'actual_dir': actual_dir,
            'prior_5_return': prior_return,
            'prior_body_sum': prior_body_sum,
            'range_position': range_position
        })

    feat_df = pd.DataFrame(pre_break_features)
    print(f"Analyzed {len(feat_df):,} pre-break windows.")
    
    up_feats = feat_df[feat_df['actual_dir'] == 'UP']
    down_feats = feat_df[feat_df['actual_dir'] == 'DOWN']
    
    print("\nPre-Break Metrics Comparison:")
    print(f"  Mean 5-bar return before UP break:   {up_feats['prior_5_return'].mean():+.2f} pts")
    print(f"  Mean 5-bar return before DOWN break: {down_feats['prior_5_return'].mean():+.2f} pts")
    print(f"  Mean Range Position (0=floor, 1=ceiling) before UP break:   {up_feats['range_position'].mean():.3f}")
    print(f"  Mean Range Position (0=floor, 1=ceiling) before DOWN break: {down_feats['range_position'].mean():.3f}")

    # Generate full report text
    os.makedirs(os.path.dirname(REPORT_PATH), exist_ok=True)
    with open(REPORT_PATH, 'w') as f:
        f.write("UMEA-RangeBreak 100 Index: Statistical Study Report\n")
        f.write(f"Total M5 Bars: {len(df):,} | Date Span: {df['time'].min()} to {df['time'].max()}\n")
        f.write(f"Total Breakouts Identified: {len(break_df):,}\n\n")
        f.write(f"UP Breaks: {up_breaks:,} ({up_breaks/len(break_df)*100:.2f}%)\n")
        f.write(f"DOWN Breaks: {down_breaks:,} ({down_breaks/len(break_df)*100:.2f}%)\n\n")
        f.write(f"Mean Duration Between Breaks: {np.mean(bars_between):.1f} bars ({np.mean(bars_between)*5:.1f} mins)\n")
        f.write(f"Median Duration: {np.median(bars_between):.1f} bars\n")
        f.write(f"Min Duration: {np.min(bars_between)} bars | Max Duration: {np.max(bars_between)} bars\n\n")
        f.write(f"Transition UP -> UP: {up_after_up/(up_after_up+down_after_up)*100:.2f}%\n")
        f.write(f"Transition UP -> DOWN: {down_after_up/(up_after_up+down_after_up)*100:.2f}%\n")
        f.write(f"Transition DOWN -> UP: {up_after_down/(up_after_down+down_after_down)*100:.2f}%\n")
        f.write(f"Transition DOWN -> DOWN: {down_after_down/(up_after_down+down_after_down)*100:.2f}%\n")

    print(f"\n[DONE] Full report written to {REPORT_PATH}")

if __name__ == "__main__":
    analyze()
