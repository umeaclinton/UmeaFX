from dataclasses import dataclass
from enum import Enum
from typing import List, Optional
import pandas as pd

class FVGType(str, Enum):
    BULLISH = "BULLISH"
    BEARISH = "BEARISH"

class FVGStatus(str, Enum):
    UNMITIGATED = "UNMITIGATED"
    PARTIALLY_MITIGATED = "PARTIALLY_MITIGATED"
    FULLY_MITIGATED = "FULLY_MITIGATED"
    INVALIDATED = "INVALIDATED"

@dataclass
class FVG:
    index: int                  # Bar index of candle 2 (the displacement candle)
    time: pd.Timestamp          # Timestamp of candle 2
    fvg_type: FVGType
    top: float                  # Upper bound of the gap
    bottom: float               # Lower bound of the gap
    size: float                 # Gap size in price units
    ce: float                   # Consequent Encroachment (50% midpoint)
    status: FVGStatus = FVGStatus.UNMITIGATED
    mitigated_bar_index: Optional[int] = None
    mitigated_time: Optional[pd.Timestamp] = None

class FVGDetector:
    """
    Detects 3-candle Fair Value Gaps (FVG) and tracks mitigation in subsequent price action.
    """
    def __init__(self, min_gap_points: float = 0.5):
        self.min_gap_points = min_gap_points

    def detect(self, df: pd.DataFrame) -> List[FVG]:
        highs = df['high'].values
        lows = df['low'].values
        closes = df['close'].values
        times = df.index
        n = len(df)
        
        fvgs: List[FVG] = []

        # Detect FVGs
        for i in range(1, n - 1):
            c1_high = highs[i - 1]
            c1_low = lows[i - 1]
            c3_high = highs[i + 1]
            c3_low = lows[i + 1]

            # Bullish FVG: Low of candle 3 is higher than High of candle 1
            if c3_low > c1_high:
                gap = c3_low - c1_high
                if gap >= self.min_gap_points:
                    top = c3_low
                    bottom = c1_high
                    fvgs.append(FVG(
                        index=i,
                        time=times[i],
                        fvg_type=FVGType.BULLISH,
                        top=top,
                        bottom=bottom,
                        size=gap,
                        ce=(top + bottom) / 2.0,
                    ))

            # Bearish FVG: High of candle 3 is lower than Low of candle 1
            elif c3_high < c1_low:
                gap = c1_low - c3_high
                if gap >= self.min_gap_points:
                    top = c1_low
                    bottom = c3_high
                    fvgs.append(FVG(
                        index=i,
                        time=times[i],
                        fvg_type=FVGType.BEARISH,
                        top=top,
                        bottom=bottom,
                        size=gap,
                        ce=(top + bottom) / 2.0,
                    ))

        # Track mitigation chronologically across future bars
        for fvg in fvgs:
            start_bar = fvg.index + 2  # Price can mitigate starting from candle 4 onwards
            for j in range(start_bar, n):
                bar_low = lows[j]
                bar_high = highs[j]
                bar_close = closes[j]

                if fvg.fvg_type == FVGType.BULLISH:
                    # Invalidated if candle closes below the bottom of the gap
                    if bar_close < fvg.bottom:
                        fvg.status = FVGStatus.INVALIDATED
                        fvg.mitigated_bar_index = j
                        fvg.mitigated_time = times[j]
                        break
                    # Fully mitigated if low goes all the way through bottom
                    elif bar_low <= fvg.bottom:
                        fvg.status = FVGStatus.FULLY_MITIGATED
                        fvg.mitigated_bar_index = j
                        fvg.mitigated_time = times[j]
                        break
                    # Partially mitigated if low enters the gap or touches CE
                    elif bar_low <= fvg.top and fvg.status == FVGStatus.UNMITIGATED:
                        fvg.status = FVGStatus.PARTIALLY_MITIGATED
                        fvg.mitigated_bar_index = j
                        fvg.mitigated_time = times[j]

                elif fvg.fvg_type == FVGType.BEARISH:
                    # Invalidated if candle closes above the top of the gap
                    if bar_close > fvg.top:
                        fvg.status = FVGStatus.INVALIDATED
                        fvg.mitigated_bar_index = j
                        fvg.mitigated_time = times[j]
                        break
                    # Fully mitigated if high goes all the way through top
                    elif bar_high >= fvg.top:
                        fvg.status = FVGStatus.FULLY_MITIGATED
                        fvg.mitigated_bar_index = j
                        fvg.mitigated_time = times[j]
                        break
                    # Partially mitigated if high enters the gap or touches CE
                    elif bar_high >= fvg.bottom and fvg.status == FVGStatus.UNMITIGATED:
                        fvg.status = FVGStatus.PARTIALLY_MITIGATED
                        fvg.mitigated_bar_index = j
                        fvg.mitigated_time = times[j]

        return fvgs
