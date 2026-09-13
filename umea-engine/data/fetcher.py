import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict
import pandas as pd
import MetaTrader5 as mt5
from rich.console import Console
from rich.table import Table

console = Console()

TIMEFRAME_MAP = {
    "M1": mt5.TIMEFRAME_M1,
    "M5": mt5.TIMEFRAME_M5,
    "M15": mt5.TIMEFRAME_M15,
    "M30": mt5.TIMEFRAME_M30,
    "H1": mt5.TIMEFRAME_H1,
    "H4": mt5.TIMEFRAME_H4,
    "D1": mt5.TIMEFRAME_D1,
}

class MT5DataFetcher:
    def __init__(self, terminal_path: Optional[str] = None):
        self.terminal_path = terminal_path
        self.raw_dir = Path(__file__).resolve().parent / "raw"
        self.raw_dir.mkdir(parents=True, exist_ok=True)

    def connect(self) -> bool:
        if mt5.terminal_info() is not None and mt5.terminal_info().connected:
            return True
        
        paths = [
            self.terminal_path,
            r"C:\Program Files\FBS MetaTrader 5\terminal64.exe",
            r"C:\Program Files\MetaTrader 5\terminal64.exe",
            r"C:\Program Files\HFM Metatrader 5\terminal64.exe"
        ]
        
        for path in paths:
            if path and Path(path).exists():
                if mt5.initialize(path=path):
                    return True
        
        return mt5.initialize()

    def disconnect(self):
        mt5.shutdown()

    def fetch_rates(self, symbol: str, timeframe: str, count: int = 10000) -> Optional[pd.DataFrame]:
        """Fetch the most recent N candles for a symbol and timeframe."""
        if not self.connect():
            console.print("[red]Failed to connect to MT5[/red]")
            return None

        if timeframe not in TIMEFRAME_MAP:
            raise ValueError(f"Invalid timeframe: {timeframe}. Choose from {list(TIMEFRAME_MAP.keys())}")

        mt5_tf = TIMEFRAME_MAP[timeframe]
        
        # Ensure symbol is selected
        if not mt5.symbol_select(symbol, True):
            console.print(f"[red]Failed to select symbol {symbol}[/red]")
            return None

        rates = mt5.copy_rates_from_pos(symbol, mt5_tf, 0, count)
        if rates is None or len(rates) == 0:
            console.print(f"[yellow]No data returned for {symbol} ({timeframe}): {mt5.last_error()}[/yellow]")
            return None

        df = pd.DataFrame(rates)
        df['time'] = pd.to_datetime(df['time'], unit='s')
        df.set_index('time', inplace=True)
        return df

    def save_data(self, df: pd.DataFrame, symbol: str, timeframe: str) -> Dict[str, Path]:
        """Save dataframe to Parquet and CSV for easy inspection."""
        base_name = f"{symbol}_{timeframe}"
        parquet_path = self.raw_dir / f"{base_name}.parquet"
        csv_path = self.raw_dir / f"{base_name}.csv"

        df.to_parquet(parquet_path)
        df.to_csv(csv_path)
        return {"parquet": parquet_path, "csv": csv_path}

    def fetch_multi_timeframe(self, symbol: str = "XAUUSD", timeframes = ("H4", "H1", "M15", "M5"), count: int = 10000):
        """Fetch and cache all timeframes in the SMC MTF hierarchy."""
        console.print(f"[bold cyan]Fetching historical data for {symbol} across {list(timeframes)} ({count} bars each)...[/bold cyan]")
        
        summary_table = Table(title=f"Historical Data Cache: {symbol}", show_header=True, header_style="bold green")
        summary_table.add_column("Timeframe", style="bold")
        summary_table.add_column("Candles")
        summary_table.add_column("Start Date")
        summary_table.add_column("End Date")
        summary_table.add_column("File Saved")

        results = {}
        for tf in timeframes:
            df = self.fetch_rates(symbol, tf, count=count)
            if df is not None and not df.empty:
                paths = self.save_data(df, symbol, tf)
                start_str = df.index[0].strftime("%Y-%m-%d %H:%M")
                end_str = df.index[-1].strftime("%Y-%m-%d %H:%M")
                summary_table.add_row(tf, str(len(df)), start_str, end_str, paths["parquet"].name)
                results[tf] = df

        self.disconnect()
        console.print(summary_table)
        return results

if __name__ == "__main__":
    fetcher = MT5DataFetcher()
    fetcher.fetch_multi_timeframe(symbol="XAUUSD", timeframes=("H4", "H1", "M15", "M5"), count=10000)
