"""
UMEA-RangeBreak Deep Mechanics & Predictive Model
Investigates:
1. Breakout Hazard Rate (Probability of break as range age increases)
2. Directional Prediction Accuracy using Pre-Break Position & Momentum
3. Post-Break Follow-Through: Momentum vs Immediate Consolidation
"""

import os
import pandas as pd
import numpy as np

DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "range_break_100_m5.csv")
REPORT_PATH = os.path.join(os.path.dirname(__file__), "..", "analysis", "deep_mechanics_report.txt")

def deep_study():
    df = pd.read_csv(DATA_PATH)
    df['time'] = pd.to_datetime(df['time'])
    df.sort_values('time', inplace=True)
    df.reset_index(drop=True, inplace=True)

    df['range'] = df['high'] - df['low']
    df['body'] = df['close'] - df['open']

    break_threshold = df['range'].quantile(0.98)
    df['rolling_med_range'] = df['range'].rolling(50).median()
    df['is_break'] = (df['range'] > break_threshold) & (df['range'] / df['rolling_med_range'] > 2.5)

    break_indices = df[df['is_break']].index.tolist()
    print(f"Total Breaks Analyzed: {len(break_indices):,}")

    # 1. Hazard Rate / Probability of Break vs Range Age
    # For every bar, how many bars has it been since the last break?
    range_ages = []
    last_break = 0
    for i in range(len(df)):
        if df.loc[i, 'is_break']:
            range_ages.append(i - last_break)
            last_break = i
    
    range_ages = pd.Series(range_ages[1:]) # Drop the first partial range
    print("\n==================================================")
    print("1. RANGE AGE & BREAKOUT PROBABILITY (HAZARD FUNCTION)")
    print("==================================================")
    print(f"Percentile of Range Duration (in M5 bars):")
    for q in [0.25, 0.50, 0.75, 0.80, 0.90, 0.95]:
        print(f"  {int(q*100)}% of ranges break within {range_ages.quantile(q):.0f} bars ({range_ages.quantile(q)*5:.0f} mins / {range_ages.quantile(q)*5/60:.1f} hrs)")

    # 2. Pre-Break Directional Predictability
    print("\n==================================================")
    print("2. DIRECTIONAL PREDICTION ACCURACY")
    print("==================================================")

    records = []
    for idx in break_indices:
        if idx < 30 or idx >= len(df) - 5:
            continue
        actual_dir = 'UP' if df.loc[idx, 'body'] > 0 else 'DOWN'

        # Look at last 1, 3, 5 bars before the break
        b1 = df.loc[idx-1]
        b3 = df.loc[idx-3:idx-1]
        b5 = df.loc[idx-5:idx-1]
        b20 = df.loc[idx-20:idx-1]

        r20_high = b20['high'].max()
        r20_low = b20['low'].min()
        pos_in_range = (b1['close'] - r20_low) / (r20_high - r20_low) if r20_high > r20_low else 0.5

        ret5 = b1['close'] - df.loc[idx-5, 'open']
        b1_dir = 1 if b1['body'] > 0 else (-1 if b1['body'] < 0 else 0)

        records.append({
            'idx': idx,
            'actual_dir': actual_dir,
            'pos_in_range': pos_in_range,
            'ret5': ret5,
            'b1_dir': b1_dir,
            'break_size': df.loc[idx, 'range'],
            'next_1_ret': df.loc[idx+1, 'close'] - df.loc[idx, 'close'],
            'next_3_ret': df.loc[idx+3, 'close'] - df.loc[idx, 'close']
        })

    rdf = pd.DataFrame(records)

    # Test Rule 1: Range Position Threshold
    # If price is at the top (> 0.65) -> Predict UP
    # If price is at the bottom (< 0.35) -> Predict DOWN
    rdf['pred_pos'] = np.where(rdf['pos_in_range'] > 0.60, 'UP', np.where(rdf['pos_in_range'] < 0.40, 'DOWN', 'NEUTRAL'))
    
    valid_pos = rdf[rdf['pred_pos'] != 'NEUTRAL']
    accuracy_pos = (valid_pos['pred_pos'] == valid_pos['actual_dir']).mean()
    print(f"Rule 1: Range Position Filter (Top 40% vs Bottom 40%):")
    print(f"  Triggers on {len(valid_pos)/len(rdf)*100:.1f}% of breaks ({len(valid_pos):,} breaks)")
    print(f"  Accuracy: {accuracy_pos*100:.2f}%")

    # Stricter Filter: Top 30% (> 0.70) vs Bottom 30% (< 0.30)
    rdf['pred_pos_strict'] = np.where(rdf['pos_in_range'] > 0.70, 'UP', np.where(rdf['pos_in_range'] < 0.30, 'DOWN', 'NEUTRAL'))
    valid_strict = rdf[rdf['pred_pos_strict'] != 'NEUTRAL']
    accuracy_strict = (valid_strict['pred_pos_strict'] == valid_strict['actual_dir']).mean()
    print(f"Rule 2: Strict Range Position Filter (Top 30% vs Bottom 30%):")
    print(f"  Triggers on {len(valid_strict)/len(rdf)*100:.1f}% of breaks ({len(valid_strict):,} breaks)")
    print(f"  Accuracy: {accuracy_strict*100:.2f}%")

    # Extreme Filter: Position > 0.75 or < 0.25 AND Momentum in same direction
    rdf['pred_combo'] = np.where((rdf['pos_in_range'] > 0.65) & (rdf['ret5'] > 0), 'UP',
                         np.where((rdf['pos_in_range'] < 0.35) & (rdf['ret5'] < 0), 'DOWN', 'NEUTRAL'))
    valid_combo = rdf[rdf['pred_combo'] != 'NEUTRAL']
    accuracy_combo = (valid_combo['pred_combo'] == valid_combo['actual_dir']).mean()
    print(f"Rule 3: Position + 5-Bar Momentum Combo:")
    print(f"  Triggers on {len(valid_combo)/len(rdf)*100:.1f}% of breaks ({len(valid_combo):,} breaks)")
    print(f"  Accuracy: {accuracy_combo*100:.2f}%")

    # 3. Post-Break Behavior (Trade Execution Strategy)
    print("\n==================================================")
    print("3. POST-BREAK BEHAVIOR (HOW TO TRADE IT)")
    print("==================================================")
    print(f"Average Breakout Candle Size: {rdf['break_size'].mean():.1f} pts (Median: {rdf['break_size'].median():.1f} pts)")
    
    # After an UP break: Does the NEXT candle (idx+1) continue UP or retrace?
    up_breaks = rdf[rdf['actual_dir'] == 'UP']
    down_breaks = rdf[rdf['actual_dir'] == 'DOWN']

    print(f"\nAfter UP Break:")
    print(f"  Next 1 bar return: {up_breaks['next_1_ret'].mean():+.2f} pts (Win rate continuation: {(up_breaks['next_1_ret'] > 0).mean()*100:.1f}%)")
    print(f"  Next 3 bars return: {up_breaks['next_3_ret'].mean():+.2f} pts (Win rate continuation: {(up_breaks['next_3_ret'] > 0).mean()*100:.1f}%)")

    print(f"\nAfter DOWN Break:")
    print(f"  Next 1 bar return: {down_breaks['next_1_ret'].mean():+.2f} pts (Win rate continuation: {(down_breaks['next_1_ret'] < 0).mean()*100:.1f}%)")
    print(f"  Next 3 bars return: {down_breaks['next_3_ret'].mean():+.2f} pts (Win rate continuation: {(down_breaks['next_3_ret'] < 0).mean()*100:.1f}%)")

    # Save summary report
    with open(REPORT_PATH, 'w') as f:
        f.write("UMEA-RangeBreak 100 Index: Deep Mechanics Report\n")
        f.write("==================================================\n")
        f.write(f"Total Breaks Analyzed: {len(rdf):,}\n")
        f.write(f"Average Breakout Size: {rdf['break_size'].mean():.1f} pts\n")
        f.write(f"Directional Prediction Accuracy (Strict Range Position): {accuracy_strict*100:.2f}%\n")
        f.write(f"Directional Prediction Accuracy (Position + Momentum Combo): {accuracy_combo*100:.2f}%\n")

    print(f"\n[DONE] Deep mechanics report saved to {REPORT_PATH}")

if __name__ == "__main__":
    deep_study()
