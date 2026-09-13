from pathlib import Path
import pandas as pd
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

from backtest.strategy import AdvancedSMCStrategy

console = Console()

def run_comparison(symbol: str = "XAUUSD"):
    m15_path = Path(__file__).resolve().parent / "data" / "raw" / f"{symbol}_M15.parquet"
    h1_path = Path(__file__).resolve().parent / "data" / "raw" / f"{symbol}_H1.parquet"

    df_m15 = pd.read_parquet(m15_path)
    df_h1 = pd.read_parquet(h1_path)

    console.print(Panel.fit(
        f"[bold yellow]UmeaFX Quantitative Strategy Comparison[/bold yellow]\n"
        f"Symbol: [bold]{symbol}[/bold] | Data: {len(df_m15):,} M15 candles ({df_m15.index[0].date()} to {df_m15.index[-1].date()})\n"
        f"Comparing Raw SMC vs. Advanced SMC (with Session Killzones & H1 Trend Alignment)",
        border_style="yellow"
    ))

    # Configuration A: Baseline Raw SMC (No session filter, no HTF filter)
    runner_raw = AdvancedSMCStrategy(
        risk_to_reward=2.5,
        use_session_filter=False,
        use_htf_filter=False
    )
    res_raw = runner_raw.run(df_m15, df_h1)

    # Configuration B: Advanced SMC (London/NY Killzones + H1 Trend Filter)
    runner_adv = AdvancedSMCStrategy(
        risk_to_reward=2.5,
        use_session_filter=True,
        use_htf_filter=True
    )
    res_adv = runner_adv.run(df_m15, df_h1)

    # Comparison Table
    comp_table = Table(title="Strategy Comparison: Raw vs Advanced Multi-Timeframe", show_header=True, header_style="bold green")
    comp_table.add_column("Metric", style="bold")
    comp_table.add_column("Raw SMC (All Hours)", justify="right")
    comp_table.add_column("Advanced SMC (Killzones + H1 Bias)", justify="right", style="bold cyan")

    comp_table.add_row("Starting Balance", f"${res_raw.initial_balance:,.2f}", f"${res_adv.initial_balance:,.2f}")
    comp_table.add_row("Final Balance", f"${res_raw.final_equity:,.2f}", f"${res_adv.final_equity:,.2f}")
    
    raw_pnl_col = "green" if res_raw.total_pnl >= 0 else "red"
    adv_pnl_col = "green" if res_adv.total_pnl >= 0 else "red"
    comp_table.add_row("Net Profit", f"[{raw_pnl_col}]${res_raw.total_pnl:+,.2f}[/{raw_pnl_col}]", f"[{adv_pnl_col}]${res_adv.total_pnl:+,.2f}[/{adv_pnl_col}]")
    comp_table.add_row("Net Return (%)", f"[{raw_pnl_col}]{(res_raw.total_pnl/res_raw.initial_balance)*100:+.2f}%[/{raw_pnl_col}]", f"[{adv_pnl_col}]{(res_adv.total_pnl/res_adv.initial_balance)*100:+.2f}%[/{adv_pnl_col}]")
    comp_table.add_row("Total Trades", str(res_raw.total_trades), str(res_adv.total_trades))
    comp_table.add_row("Win Rate", f"{res_raw.win_rate:.1f}%", f"{res_adv.win_rate:.1f}%")
    comp_table.add_row("Profit Factor", f"{res_raw.profit_factor:.2f}", f"{res_adv.profit_factor:.2f}")
    comp_table.add_row("Max Drawdown (%)", f"{res_raw.max_drawdown_pct:.2f}%", f"{res_adv.max_drawdown_pct:.2f}%")
    comp_table.add_row("Max Drawdown ($)", f"${res_raw.max_drawdown_amount:,.2f}", f"${res_adv.max_drawdown_amount:,.2f}")
    comp_table.add_row("Average R-Multiple", f"{res_raw.average_r_multiple:+.2f}R", f"{res_adv.average_r_multiple:+.2f}R")

    console.print(comp_table)

    # Show Advanced Trades
    if res_adv.trades:
        trades_table = Table(title="Advanced Strategy: Executed Trades Log", show_header=True, header_style="bold cyan")
        trades_table.add_column("ID")
        trades_table.add_column("Type")
        trades_table.add_column("Entry Time")
        trades_table.add_column("Entry ($)")
        trades_table.add_column("SL ($)")
        trades_table.add_column("TP ($)")
        trades_table.add_column("Exit")
        trades_table.add_column("PnL ($)")
        trades_table.add_column("Return")

        for t in res_adv.trades:
            outcome_col = "green" if t.pnl > 0 else "red"
            trades_table.add_row(
                str(t.id),
                t.order_type.value.replace("_LIMIT", ""),
                t.open_time.strftime("%Y-%m-%d %H:%M") if t.open_time else "N/A",
                f"${t.entry_price:.2f}",
                f"${t.stop_loss:.2f}",
                f"${t.take_profit:.2f}",
                t.exit_reason.value if t.exit_reason else "OPEN",
                f"[{outcome_col}]${t.pnl:+,.2f}[/{outcome_col}]",
                f"[{outcome_col}]{t.r_multiple:+.1f}R[/{outcome_col}]"
            )
        console.print(trades_table)

if __name__ == "__main__":
    run_comparison("XAUUSD")
