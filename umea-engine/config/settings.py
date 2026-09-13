from pathlib import Path
from dataclasses import dataclass
from typing import Optional, List

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data" / "raw"
DATA_DIR.mkdir(parents=True, exist_ok=True)

@dataclass
class EngineConfig:
    symbol: str = "XAUUSD"
    # Standard MTF hierarchy: H4 context, H1 structure, M15 setup, M5 entry
    timeframes: List[str] = ("H4", "H1", "M15", "M5")
    # Number of historical candles to fetch per timeframe
    bars_count: int = 10000
    # MT5 installation path override (None = auto-detect standard path)
    mt5_path: Optional[str] = None
    # Data storage format: parquet or csv
    data_format: str = "parquet"

config = EngineConfig()
