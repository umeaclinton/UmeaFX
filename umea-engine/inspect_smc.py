from pathlib import Path
import pandas as pd
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

from smc.swings import SwingDetector, SwingType
from smc.structure import StructureAnalyzer, StructureEventType
from smc.fvg import FVGDetector, FVGType, FVGStatus

console = Console()

def run_smc_inspection(symbol: str = "XAUUSD", timeframe: str = "H1"):
    file_path = Path(__file__).resolve().parent / "data" / "raw" / f"{symbol}_{timeframe}.parquet"
    if not file_path.exists():
        console.print(f"[red]Data file not found: {file_path}[/red]")
        return

    df = pd.read_parquet(file_path)
    console.print(Panel.fit(
        f"[bold cyan]SMC Algorithmic Inspection: {symbol} ({timeframe})[/bold cyan]\n"
        f"Total Candles: {len(df):,} | Range: {df.index[0]} to {df.index[-1]}",
        border_style="cyan"
    ))

    # 1. Swings Analysis
    detector = SwingDetector(left_bars=2, right_bars=2)
    swings = detector.detect(df)
    highs = [s for s in swings if s.swing_type == SwingType.HIGH]
    lows = [s for s in swings if s.swing_type == SwingType.LOW]

    swings_table = Table(title=f"Swings Summary ({timeframe})", show_header=True, header_style="bold green")
    swings_table.add_column("Metric", style="bold")
    swings_table.add_column("Value")
    swings_table.add_row("Total Confirmed Swings", str(len(swings)))
    swings_table.add_row("Swing Highs", f"{len(highs)} (HH: {sum(1 for s in highs if s.classification == 'HH')}, LH: {sum(1 for s in highs if s.classification == 'LH')})")
    swings_table.add_row("Swing Lows", f"{len(lows)} (HL: {sum(1 for s in lows if s.classification == 'HL')}, LL: {sum(1 for s in lows if s.classification == 'LL')})")
    console.print(swings_table)

    # 2. Market Structure Analysis (BOS, CHoCH, Sweeps)
    analyzer = StructureAnalyzer(left_bars=2, right_bars=2)
    events = analyzer.analyze(df)

    bos_bull = sum(1 for e in events if e.event_type == StructureEventType.BOS_BULLISH)
    bos_bear = sum(1 for e in events if e.event_type == StructureEventType.BOS_BEARISH)
    choch_bull = sum(1 for e in events if e.event_type == StructureEventType.CHOCH_BULLISH)
    choch_bear = sum(1 for e in events if e.event_type == StructureEventType.CHOCH_BEARISH)
    sweep_bsl = sum(1 for e in events if e.event_type == StructureEventType.SWEEP_BUYSIDE)
    sweep_ssl = sum(1 for e in events if e.event_type == StructureEventType.SWEEP_SELLSIDE)

    struct_table = Table(title=f"Market Structure Events ({timeframe})", show_header=True, header_style="bold magenta")
    struct_table.add_column("Event Type", style="bold")
    struct_table.add_column("Count")
    struct_table.add_column("Description")
    struct_table.add_row("Bullish BOS", str(bos_bull), "Body close above prior Swing High (Uptrend continuation)")
    struct_table.add_row("Bearish BOS", str(bos_bear), "Body close below prior Swing Low (Downtrend continuation)")
    struct_table.add_row("Bullish CHoCH (MSS)", str(choch_bull), "Body close above key Lower High (Bearish to Bullish reversal)")
    struct_table.add_row("Bearish CHoCH (MSS)", str(choch_bear), "Body close below key Higher Low (Bullish to Bearish reversal)")
    struct_table.add_row("Buy-Side Liquidity Sweep", str(sweep_bsl), "Wick pierced above Swing High, but candle closed inside (Fakeout)")
    struct_table.add_row("Sell-Side Liquidity Sweep", str(sweep_ssl), "Wick pierced below Swing Low, but candle closed inside (Fakeout)")
    console.print(struct_table)

    # 3. Fair Value Gaps
    fvg_detector = FVGDetector(min_gap_points=1.0)
    fvgs = fvg_detector.detect(df)
    bull_fvg = [f for f in fvgs if f.fvg_type == FVGType.BULLISH]
    bear_fvg = [f for f in fvgs if f.fvg_type == FVGType.BEARISH]

    fvg_table = Table(title=f"Fair Value Gaps ({timeframe})", show_header=True, header_style="bold yellow")
    fvg_table.add_column("Metric", style="bold")
    fvg_table.add_column("Value")
    fvg_table.add_row("Total FVGs (>= $1.00 gap)", str(len(fvgs)))
    fvg_table.add_row("Bullish FVGs", str(len(bull_fvg)))
    fvg_table.add_row("Bearish FVGs", str(len(bear_fvg)))
    fvg_table.add_row("Fully Mitigated", str(sum(1 for f in fvgs if f.status == FVGStatus.FULLY_MITIGATED)))
    fvg_table.add_row("Partially Mitigated", str(sum(1 for f in fvgs if f.status == FVGStatus.PARTIALLY_MITIGATED)))
    fvg_table.add_row("Still Unmitigated (Active Targets)", str(sum(1 for f in fvgs if f.status == FVGStatus.UNMITIGATED)))
    fvg_table.add_row("Invalidated (Violated)", str(sum(1 for f in fvgs if f.status == FVGStatus.INVALIDATED)))
    console.print(fvg_table)

    # 4. Show Recent Structure Events (Last 10)
    recent_table = Table(title="Recent 10 Structure Events in XAUUSD", show_header=True, header_style="bold cyan")
    recent_table.add_column("Time")
    recent_table.add_column("Event")
    recent_table.add_column("Level Broken")
    recent_table.add_column("Close Price")
    recent_table.add_column("Trend After")

    for ev in events[-10:]:
        recent_table.add_row(
            ev.time.strftime("%Y-%m-%d %H:%M"),
            f"[bold]{ev.event_type.value}[/bold]",
            f"${ev.level_broken:.2f}",
            f"${ev.close_price:.2f}",
            ev.trend_after.value
        )
    console.print(recent_table)

if __name__ == "__main__":
    run_smc_inspection(symbol="XAUUSD", timeframe="H1")
