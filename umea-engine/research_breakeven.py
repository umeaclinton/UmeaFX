import pandas as pd
import numpy as np
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

console = Console()

def test_breakeven_statistics():
    df = pd.read_parquet('data/raw/FXVol60_H1.parquet')
    df['is_bull'] = df['close'] > df['open']
    df['is_bear'] = df['close'] < df['open']
    df['body'] = (df['close'] - df['open']).abs()
    df['ema20'] = df['close'].ewm(span=20, adjust=False).mean()

    # Base settings:
    # Dip entry = 120 pts
    # Initial SL = 250 pts
    # TP = 500 pts

    dip_entry = 120.0
    initial_sl = 250.0
    tp_pts = 500.0

    # Let's test Breakeven Triggers:
    # None (no BE), 150, 200, 250 (1R), 300, 350
    be_triggers = [None, 150, 200, 250, 300, 350, 400]

    console.print(Panel.fit(
        f"[bold cyan]Statistical Breakeven Study on FX Vol 60 (24,718 Candles)[/bold cyan]\n"
        f"Base Trade: Initial SL = 250 pts | Target TP = 500 pts (1:2 R:R)\n"
        f"Question: At what profit distance should SL move to BE (+10 pts lock)\n"
        f"without prematurely stopping out trades on their way to the 500 pt TP?",
        border_style="cyan"
    ))

    t_res = Table(title="Breakeven Performance vs Premature Stop-Out Analysis", show_header=True, header_style="bold green")
    t_res.add_column("BE Trigger", justify="center", style="bold")
    t_res.add_column("Total Trades", justify="right")
    t_res.add_column("Full TP (500 pts)", justify="right")
    t_res.add_column("Stopped at BE", justify="right")
    t_res.add_column("Full Loss (-250 pts)", justify="right")
    t_res.add_column("Premature BE Kill Rate", justify="right")
    t_res.add_column("Profit Factor", justify="right")
    t_res.add_column("Net Points PnL", justify="right", style="bold cyan")

    for be_trig in be_triggers:
        tp_count = 0
        be_count = 0
        sl_count = 0
        premature_kills = 0 # Would have hit TP, but got stopped out at BE first!
        net_pts = 0.0

        for i in range(25, len(df)):
            c1 = df.iloc[i - 2]
            c2 = df.iloc[i - 1]
            c3 = df.iloc[i]

            # Bullish Mode 1 Setup
            if c1['is_bull'] and c2['is_bull'] and c2['body'] >= 120 and c2['close'] > c2['ema20']:
                limit_p = c3['open'] - dip_entry
                if c3['low'] <= limit_p:
                    # In trade!
                    # Next bars in trade: check bar c3 and up to 4 subsequent bars
                    # Let's see price path from limit_p
                    end_idx = min(len(df), i + 6)
                    bars_window = df.iloc[i:end_idx]

                    entry_p = limit_p
                    tp_p = entry_p + tp_pts
                    sl_p = entry_p - initial_sl
                    be_active = False

                    outcome = None

                    for b_idx in range(len(bars_window)):
                        bar = bars_window.iloc[b_idx]
                        b_low = bar['low']
                        b_high = bar['high']

                        # Check if BE trigger reached
                        if be_trig is not None and not be_active:
                            if b_high >= (entry_p + be_trig):
                                be_active = True
                                sl_p = entry_p + 15.0 # Lock +15 pts profit at BE

                        # Check SL / BE hit
                        if b_low <= sl_p:
                            if be_active:
                                outcome = "BE"
                                be_count += 1
                                net_pts += 15.0
                                # Check if it eventually would have reached TP
                                remaining_high = bars_window.iloc[b_idx:]['high'].max()
                                if remaining_high >= tp_p:
                                    premature_kills += 1
                            else:
                                outcome = "SL"
                                sl_count += 1
                                net_pts -= initial_sl
                            break

                        # Check TP hit
                        if b_high >= tp_p:
                            outcome = "TP"
                            tp_count += 1
                            net_pts += tp_pts
                            break

                    if outcome is None:
                        # Trade timed out
                        last_c = bars_window.iloc[-1]['close']
                        pnl = last_c - entry_p
                        net_pts += pnl

            # Bearish Mode 1 Setup
            elif c1['is_bear'] and c2['is_bear'] and c2['body'] >= 120 and c2['close'] < c2['ema20']:
                limit_p = c3['open'] + dip_entry
                if c3['high'] >= limit_p:
                    end_idx = min(len(df), i + 6)
                    bars_window = df.iloc[i:end_idx]

                    entry_p = limit_p
                    tp_p = entry_p - tp_pts
                    sl_p = entry_p + initial_sl
                    be_active = False

                    outcome = None

                    for b_idx in range(len(bars_window)):
                        bar = bars_window.iloc[b_idx]
                        b_low = bar['low']
                        b_high = bar['high']

                        if be_trig is not None and not be_active:
                            if b_low <= (entry_p - be_trig):
                                be_active = True
                                sl_p = entry_p - 15.0

                        if b_high >= sl_p:
                            if be_active:
                                outcome = "BE"
                                be_count += 1
                                net_pts += 15.0
                                remaining_low = bars_window.iloc[b_idx:]['low'].min()
                                if remaining_low <= tp_p:
                                    premature_kills += 1
                            else:
                                outcome = "SL"
                                sl_count += 1
                                net_pts -= initial_sl
                            break

                        if b_low <= tp_p:
                            outcome = "TP"
                            tp_count += 1
                            net_pts += tp_pts
                            break

                    if outcome is None:
                        last_c = bars_window.iloc[-1]['close']
                        pnl = entry_p - last_c
                        net_pts += pnl

        tot = tp_count + be_count + sl_count
        gross_w = (tp_count * tp_pts) + (be_count * 15.0)
        gross_l = sl_count * initial_sl
        pf = gross_w / gross_l if gross_l > 0 else 0
        prem_rate = (premature_kills / (premature_kills + tp_count) * 100.0) if (premature_kills + tp_count) > 0 else 0

        trig_str = "No BE" if be_trig is None else f"+{be_trig} pts"
        t_res.add_row(
            trig_str,
            f"{tot:,}",
            f"{tp_count:,}",
            f"{be_count:,}",
            f"{sl_count:,}",
            f"{prem_rate:.1f}%",
            f"{pf:.2f}",
            f"{net_pts:+,.0f}"
        )

    console.print(t_res)

if __name__ == "__main__":
    test_breakeven_statistics()
