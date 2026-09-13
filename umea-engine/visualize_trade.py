from pathlib import Path
import pandas as pd
import plotly.graph_objects as go
from rich.console import Console

console = Console()

def generate_trade_chart(trade_id: int = 13, symbol: str = "XAUUSD"):
    """
    Renders an interactive HTML candlestick chart showing:
    - Candlesticks around the trade
    - Entry level
    - Stop Loss level (Red)
    - Take Profit level (Green)
    """
    m15_path = Path(__file__).resolve().parent / "data" / "raw" / f"{symbol}_M15.parquet"
    df = pd.read_parquet(m15_path)

    # Let's find Trade 13 (a winning buy trade around 2026-08/09)
    # Entry: $4642, SL: $4629, TP: $4676
    entry = 4642.0
    sl = 4629.0
    tp = 4676.0

    # Slice candles around this price region
    sub_df = df[(df['high'] >= 4620) & (df['low'] <= 4685)].tail(80)

    fig = go.Figure()

    # Candlesticks
    fig.add_trace(go.Candlestick(
        x=sub_df.index,
        open=sub_df['open'],
        high=sub_df['high'],
        low=sub_df['low'],
        close=sub_df['close'],
        name="XAUUSD M15",
        increasing_line_color='#26a69a',
        decreasing_line_color='#ef5350'
    ))

    # Add Entry Line
    fig.add_hline(y=entry, line_dash="dash", line_color="#2196F3", annotation_text=f"ENTRY: ${entry:.2f}")
    # Add TP Line
    fig.add_hline(y=tp, line_dash="dash", line_color="#4CAF50", annotation_text=f"TAKE PROFIT (2.5R): ${tp:.2f}")
    # Add SL Line
    fig.add_hline(y=sl, line_dash="dash", line_color="#F44336", annotation_text=f"STOP LOSS: ${sl:.2f}")

    fig.update_layout(
        title=f"UmeaFX SMC Trade #{trade_id} Execution (XAUUSD M15)",
        yaxis_title="Price (USD)",
        xaxis_title="Time (UTC)",
        template="plotly_dark",
        xaxis_rangeslider_visible=False
    )

    output_path = Path(__file__).resolve().parent / "trade_sample.html"
    fig.write_html(str(output_path))
    console.print(f"[bold green]Interactive trade chart saved to:[/bold green] {output_path}")

if __name__ == "__main__":
    generate_trade_chart(13)
