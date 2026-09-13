from pathlib import Path
import pandas as pd
import numpy as np
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

console = Console()

def analyze_patterns():
    file_path = Path(__file__).resolve().parent / "data" / "raw" / "FXVol60_H1.parquet"
    if not file_path.exists():
        console.print("[red]FXVol60_H1.parquet not found![/red]")
        return

    df = pd.read_parquet(file_path)
    console.print(Panel.fit(
        f"[bold cyan]FX Vol 60 (Weltrade Synthetic) — 1-Hour Pattern & Statistical Mining[/bold cyan]\n"
        f"Total 1H Candles: {len(df):,} | Date Range: {df.index[0]} to {df.index[-1]}\n"
        f"Total Days Analyzed: {len(df) // 24:,} full 24-hour cycles",
        border_style="cyan"
    ))

    # Candle metrics
    df['hour'] = df.index.hour
    df['day_of_week'] = df.index.day_name()
    df['date'] = df.index.date
    df['is_bull'] = df['close'] > df['open']
    df['is_bear'] = df['close'] < df['open']
    df['body'] = (df['close'] - df['open']).abs()
    df['range'] = df['high'] - df['low']
    df['return'] = df['close'] - df['open']

    # 1. Hourly Directional Heatmap (Hour 0 to 23)
    hourly_stats = []
    for h in range(24):
        h_df = df[df['hour'] == h]
        total = len(h_df)
        bulls = h_df['is_bull'].sum()
        bears = h_df['is_bear'].sum()
        bull_pct = (bulls / total) * 100.0 if total > 0 else 0
        bear_pct = (bears / total) * 100.0 if total > 0 else 0
        avg_range = h_df['range'].mean()
        avg_body = h_df['body'].mean()
        net_drift = h_df['return'].mean()

        hourly_stats.append({
            'hour': h,
            'total': total,
            'bull_pct': bull_pct,
            'bear_pct': bear_pct,
            'avg_range': avg_range,
            'avg_body': avg_body,
            'net_drift': net_drift
        })

    hourly_table = Table(title="1. Hourly Directional Probability (Hour 00:00 to 23:00 Broker Time)", show_header=True, header_style="bold green")
    hourly_table.add_column("Hour", justify="center", style="bold")
    hourly_table.add_column("Total Bars", justify="right")
    hourly_table.add_column("Bullish %", justify="right")
    hourly_table.add_column("Bearish %", justify="right")
    hourly_table.add_column("Bias Rating", justify="center")
    hourly_table.add_column("Avg Range", justify="right")
    hourly_table.add_column("Avg Body", justify="right")
    hourly_table.add_column("Avg Net Drift", justify="right")

    for s in hourly_stats:
        bias = "BALANCED"
        style = "white"
        if s['bull_pct'] >= 53.0:
            bias = f"BULL BIAS ({s['bull_pct']:.1f}%)"
            style = "bold green"
        elif s['bear_pct'] >= 53.0:
            bias = f"BEAR BIAS ({s['bear_pct']:.1f}%)"
            style = "bold red"

        hourly_table.add_row(
            f"{s['hour']:02d}:00",
            f"{s['total']:,}",
            f"{s['bull_pct']:.1f}%",
            f"{s['bear_pct']:.1f}%",
            f"[{style}]{bias}[/{style}]",
            f"{s['avg_range']:.2f}",
            f"{s['avg_body']:.2f}",
            f"{s['net_drift']:+.2f}"
        )
    console.print(hourly_table)

    # 2. Sequential Candle Persistence (Markov Transitions)
    # If candle N is Bullish, what is candle N+1?
    df['prev_bull'] = df['is_bull'].shift(1)
    df['prev_bear'] = df['is_bear'].shift(1)
    df['prev2_bull'] = df['is_bull'].shift(1) & df['is_bull'].shift(2)
    df['prev2_bear'] = df['is_bear'].shift(1) & df['is_bear'].shift(2)
    df['prev3_bull'] = df['is_bull'].shift(1) & df['is_bull'].shift(2) & df['is_bull'].shift(3)
    df['prev3_bear'] = df['is_bear'].shift(1) & df['is_bear'].shift(2) & df['is_bear'].shift(3)

    seq_table = Table(title="2. Sequential Candle Persistence (Momentum vs Mean-Reversion)", show_header=True, header_style="bold magenta")
    seq_table.add_column("Preceding Sequence", style="bold")
    seq_table.add_column("Occurrences", justify="right")
    seq_table.add_column("Next Candle Bullish %", justify="right")
    seq_table.add_column("Next Candle Bearish %", justify="right")
    seq_table.add_column("Market Tendency", justify="center")

    # After 1 Bull
    sub1 = df[df['prev_bull'] == True]
    b1 = (sub1['is_bull'].sum() / len(sub1)) * 100
    r1 = (sub1['is_bear'].sum() / len(sub1)) * 100
    seq_table.add_row("After 1 Green (Bullish) 1H", f"{len(sub1):,}", f"{b1:.1f}%", f"{r1:.1f}%", "Continuation" if b1 > 50 else "Reversal")

    # After 1 Bear
    sub2 = df[df['prev_bear'] == True]
    b2 = (sub2['is_bull'].sum() / len(sub2)) * 100
    r2 = (sub2['is_bear'].sum() / len(sub2)) * 100
    seq_table.add_row("After 1 Red (Bearish) 1H", f"{len(sub2):,}", f"{b2:.1f}%", f"{r2:.1f}%", "Reversal" if b2 > 50 else "Continuation")

    # After 2 Bulls
    sub3 = df[df['prev2_bull'] == True]
    b3 = (sub3['is_bull'].sum() / len(sub3)) * 100
    r3 = (sub3['is_bear'].sum() / len(sub3)) * 100
    seq_table.add_row("After 2 Consecutive Green 1H", f"{len(sub3):,}", f"{b3:.1f}%", f"{r3:.1f}%", "Continuation" if b3 > 50 else "Reversal")

    # After 2 Bears
    sub4 = df[df['prev2_bear'] == True]
    b4 = (sub4['is_bull'].sum() / len(sub4)) * 100
    r4 = (sub4['is_bear'].sum() / len(sub4)) * 100
    seq_table.add_row("After 2 Consecutive Red 1H", f"{len(sub4):,}", f"{b4:.1f}%", f"{r4:.1f}%", "Reversal" if b4 > 50 else "Continuation")

    # After 3 Bulls
    sub5 = df[df['prev3_bull'] == True]
    b5 = (sub5['is_bull'].sum() / len(sub5)) * 100
    r5 = (sub5['is_bear'].sum() / len(sub5)) * 100
    seq_table.add_row("After 3 Consecutive Green 1H", f"{len(sub5):,}", f"{b5:.1f}%", f"{r5:.1f}%", "Continuation" if b5 > 50 else "Reversal")

    # After 3 Bears
    sub6 = df[df['prev3_bear'] == True]
    b6 = (sub6['is_bull'].sum() / len(sub6)) * 100
    r6 = (sub6['is_bear'].sum() / len(sub6)) * 100
    seq_table.add_row("After 3 Consecutive Red 1H", f"{len(sub6):,}", f"{b6:.1f}%", f"{r6:.1f}%", "Reversal" if b6 > 50 else "Continuation")

    console.print(seq_table)

    # 3. High of the Day (HOD) and Low of the Day (LOD) Timing
    daily_groups = df.groupby('date')
    hod_hours = []
    lod_hours = []
    daily_ranges = []

    for date, g in daily_groups:
        if len(g) >= 20:  # Full or nearly full day
            max_idx = g['high'].idxmax()
            min_idx = g['low'].idxmin()
            hod_hours.append(max_idx.hour)
            lod_hours.append(min_idx.hour)
            daily_ranges.append(g['high'].max() - g['low'].min())

    hod_series = pd.Series(hod_hours).value_counts(normalize=True).sort_index() * 100
    lod_series = pd.Series(lod_hours).value_counts(normalize=True).sort_index() * 100
    avg_day_range = np.mean(daily_ranges)

    timing_table = Table(title=f"3. Intraday Cycle: When does FX Vol 60 set Daily High & Low? (Avg Daily Range: {avg_day_range:.2f} pts)", show_header=True, header_style="bold yellow")
    timing_table.add_column("Hour (Broker Time)", justify="center")
    timing_table.add_column("Prob of High of Day (HOD)", justify="right")
    timing_table.add_column("Prob of Low of Day (LOD)", justify="right")
    timing_table.add_column("Cycle Significance", justify="center")

    top_hod = hod_series.nlargest(3).index.tolist()
    top_lod = lod_series.nlargest(3).index.tolist()

    for h in range(24):
        p_h = hod_series.get(h, 0.0)
        p_l = lod_series.get(h, 0.0)
        note = "-"
        if h in top_hod:
            note = "[bold green]Peak HOD Formation[/bold green]"
        elif h in top_lod:
            note = "[bold red]Peak LOD Formation[/bold red]"

        timing_table.add_row(f"{h:02d}:00", f"{p_h:.1f}%", f"{p_l:.1f}%", note)

    console.print(timing_table)

if __name__ == "__main__":
    analyze_patterns()
