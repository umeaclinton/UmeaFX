import pandas as pd
import numpy as np
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

console = Console()

def analyze_wick_retracements():
    df = pd.read_parquet('data/raw/FXVol60_H1.parquet')
    
    df['range'] = df['high'] - df['low']
    df['body'] = (df['close'] - df['open']).abs()
    df['is_bull'] = df['close'] > df['open']
    df['is_bear'] = df['close'] < df['open']
    
    # Lower wick for bull candle: open - low
    # Upper wick for bear candle: high - open
    # For ANY candle:
    # Lower wick = min(open, close) - low
    # Upper wick = high - max(open, close)
    df['lower_wick'] = df[['open', 'close']].min(axis=1) - df['low']
    df['upper_wick'] = df['high'] - df[['open', 'close']].max(axis=1)

    console.print(Panel.fit(
        f"[bold cyan]Intra-Hour Wick Retracement & Momentum Continuation Study[/bold cyan]\n"
        f"Symbol: FX Vol 60 | Total 1H Candles: {len(df):,} (1,029 days)\n"
        f"Objective: Measure how deep the next 1H candle dips before expanding in trend direction.",
        border_style="cyan"
    ))

    # Study: Given Candle N is BULLISH with decent body:
    # Look at Candle N+1:
    # How deep is the dip below Candle N+1 Open? (dip = Open - Low)
    # Does Candle N+1 break above Candle N High?
    # What is the expansion above Candle N+1 Open? (expansion = High - Open)
    
    records_bull = []
    records_bear = []

    for i in range(1, len(df)):
        prev = df.iloc[i - 1]
        curr = df.iloc[i]

        # Case 1: Prev candle was BULLISH
        if prev['is_bull'] and prev['range'] > 100:
            dip = curr['open'] - curr['low']  # How deep it dipped below open
            exp = curr['high'] - curr['open']  # How high it expanded above open
            broke_prev_high = curr['high'] > prev['high']
            closed_bull = curr['is_bull']
            dip_pct_prev_range = (dip / prev['range']) * 100.0

            records_bull.append({
                'prev_range': prev['range'],
                'prev_body': prev['body'],
                'dip': dip,
                'exp': exp,
                'dip_pct': dip_pct_prev_range,
                'broke_prev_high': broke_prev_high,
                'closed_bull': closed_bull,
                'broke_prev_low': curr['low'] < prev['low']
            })

        # Case 2: Prev candle was BEARISH
        if prev['is_bear'] and prev['range'] > 100:
            rally = curr['high'] - curr['open']  # How high it pulled back above open
            drop = curr['open'] - curr['low']    # How low it dropped below open
            broke_prev_low = curr['low'] < prev['low']
            closed_bear = curr['is_bear']
            rally_pct_prev_range = (rally / prev['range']) * 100.0

            records_bear.append({
                'prev_range': prev['range'],
                'prev_body': prev['body'],
                'rally': rally,
                'drop': drop,
                'rally_pct': rally_pct_prev_range,
                'broke_prev_low': broke_prev_low,
                'closed_bear': closed_bear,
                'broke_prev_high': curr['high'] > prev['high']
            })

    df_b = pd.DataFrame(records_bull)
    df_s = pd.DataFrame(records_bear)

    # Summary Statistics
    t_sum = Table(title="1. 1H Candle Retracement Mechanics", show_header=True, header_style="bold green")
    t_sum.add_column("Metric", style="bold")
    t_sum.add_column("Bullish Trend Follower", justify="right")
    t_sum.add_column("Bearish Trend Follower", justify="right")

    t_sum.add_row("Total Occurrences Analyzed", f"{len(df_b):,}", f"{len(df_s):,}")
    t_sum.add_row("Average Retracement / Wick Dip", f"{df_b['dip'].mean():.2f} pts", f"{df_s['rally'].mean():.2f} pts")
    t_sum.add_row("Median Retracement / Wick Dip", f"{df_b['dip'].median():.2f} pts", f"{df_s['rally'].median():.2f} pts")
    t_sum.add_row("Average Retracement % of Prev Range", f"{df_b['dip_pct'].mean():.1f}%", f"{df_s['rally_pct'].mean():.1f}%")
    t_sum.add_row("Next Candle Breaks Prev Extreme", f"{df_b['broke_prev_high'].mean()*100:.1f}%", f"{df_s['broke_prev_low'].mean()*100:.1f}%")
    t_sum.add_row("Next Candle Completely Violates Opposite End", f"{df_b['broke_prev_low'].mean()*100:.1f}%", f"{df_s['broke_prev_high'].mean()*100:.1f}%")
    console.print(t_sum)

    # 2. Retracement Depth Brackets
    # How often does price retrace X points, and if you buy that dip, what is the win rate?
    brackets = [50, 100, 150, 200, 250, 300]
    t_brack = Table(title="2. Performance of Buying the 1H Wick Dip (Bullish Continuation)", show_header=True, header_style="bold yellow")
    t_brack.add_column("Dip Distance (pts below Open)", justify="center", style="bold")
    t_brack.add_column("% of Candles Reaching This Dip", justify="right")
    t_brack.add_column("Avg Remaining Expansion Up", justify="right")
    t_brack.add_column("Breaks Prev High After Dip", justify="right")
    t_brack.add_column("Viable 2R Expansion (>2x Dip)", justify="right")

    for b in brackets:
        # Candles that dipped at least b points
        sub = df_b[df_b['dip'] >= b]
        reach_pct = (len(sub) / len(df_b)) * 100.0
        # From the entry point (open - b), how much did it go up?
        # entry = open - b. expansion from entry = (high - open) + b
        exp_from_entry = sub['exp'] + b
        breaks_prev = sub['broke_prev_high'].mean() * 100.0
        # Check if expansion is >= 2 * b (meaning at least a 2R gain if SL = b)
        hits_2r = (exp_from_entry >= 2.0 * b).mean() * 100.0

        t_brack.add_row(
            f"{b} pts",
            f"{reach_pct:.1f}%",
            f"{exp_from_entry.mean():.1f} pts",
            f"{breaks_prev:.1f}%",
            f"{hits_2r:.1f}%"
        )

    console.print(t_brack)

if __name__ == "__main__":
    analyze_wick_retracements()
