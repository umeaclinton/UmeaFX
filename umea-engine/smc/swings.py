from dataclasses import dataclass
from enum import Enum
from typing import List, Optional
import numpy as np
import pandas as pd

class SwingType(str, Enum):
    HIGH = "HIGH"
    LOW = "LOW"

class SwingClassification(str, Enum):
    HH = "HH"  # Higher High
    LH = "LH"  # Lower High
    HL = "HL"  # Higher Low
    LL = "LL"  # Lower Low
    INITIAL = "INITIAL"

@dataclass
class SwingPoint:
    index: int                  # Bar index where swing occurred
    time: pd.Timestamp          # Timestamp of the swing candle
    swing_type: SwingType       # HIGH or LOW
    price: float                # Extreme price (High for HIGH, Low for LOW)
    classification: SwingClassification
    confirmed_index: int        # Bar index when the swing was confirmed (index + right_bars)
    confirmed_time: pd.Timestamp # Timestamp when confirmed (strictly no lookahead)

class SwingDetector:
    """
    Identifies fractal Swing Highs and Lows strictly without lookahead bias.
    A swing candle at index `i` is confirmed at index `i + right_bars`
    only if it is the strict extreme compared to `left_bars` before and `right_bars` after.
    """
    def __init__(self, left_bars: int = 2, right_bars: int = 2):
        self.left_bars = left_bars
        self.right_bars = right_bars

    def detect(self, df: pd.DataFrame) -> List[SwingPoint]:
        highs = df['high'].values
        lows = df['low'].values
        times = df.index
        n = len(df)
        
        swings: List[SwingPoint] = []
        last_high: Optional[SwingPoint] = None
        last_low: Optional[SwingPoint] = None

        # Loop through data respecting confirmation lag (i + right_bars)
        for i in range(self.left_bars, n - self.right_bars):
            # Check Swing High
            is_high = True
            current_high = highs[i]
            for offset in range(1, self.left_bars + 1):
                if highs[i - offset] >= current_high:
                    is_high = False
                    break
            if is_high:
                for offset in range(1, self.right_bars + 1):
                    if highs[i + offset] >= current_high:
                        is_high = False
                        break

            if is_high:
                classification = SwingClassification.INITIAL
                if last_high is not None:
                    classification = SwingClassification.HH if current_high > last_high.price else SwingClassification.LH

                confirmed_idx = i + self.right_bars
                sp = SwingPoint(
                    index=i,
                    time=times[i],
                    swing_type=SwingType.HIGH,
                    price=current_high,
                    classification=classification,
                    confirmed_index=confirmed_idx,
                    confirmed_time=times[confirmed_idx]
                )
                swings.append(sp)
                last_high = sp

            # Check Swing Low
            is_low = True
            current_low = lows[i]
            for offset in range(1, self.left_bars + 1):
                if lows[i - offset] <= current_low:
                    is_low = False
                    break
            if is_low:
                for offset in range(1, self.right_bars + 1):
                    if lows[i + offset] <= current_low:
                        is_low = False
                        break

            if is_low:
                classification = SwingClassification.INITIAL
                if last_low is not None:
                    classification = SwingClassification.HL if current_low > last_low.price else SwingClassification.LL

                confirmed_idx = i + self.right_bars
                sp = SwingPoint(
                    index=i,
                    time=times[i],
                    swing_type=SwingType.LOW,
                    price=current_low,
                    classification=classification,
                    confirmed_index=confirmed_idx,
                    confirmed_time=times[confirmed_idx]
                )
                swings.append(sp)
                last_low = sp

        # Sort chronologically by confirmation index/time
        swings.sort(key=lambda s: s.confirmed_index)
        return swings
