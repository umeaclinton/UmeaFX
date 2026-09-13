from dataclasses import dataclass
from enum import Enum
from typing import List, Optional
import pandas as pd
from .swings import SwingPoint, SwingType, SwingDetector

class MarketTrend(str, Enum):
    BULLISH = "BULLISH"
    BEARISH = "BEARISH"
    NEUTRAL = "NEUTRAL"

class StructureEventType(str, Enum):
    BOS_BULLISH = "BOS_BULLISH"
    BOS_BEARISH = "BOS_BEARISH"
    CHOCH_BULLISH = "CHOCH_BULLISH"
    CHOCH_BEARISH = "CHOCH_BEARISH"
    SWEEP_BUYSIDE = "SWEEP_BUYSIDE"
    SWEEP_SELLSIDE = "SWEEP_SELLSIDE"

@dataclass
class StructureEvent:
    bar_index: int
    time: pd.Timestamp
    event_type: StructureEventType
    level_broken: float
    broken_swing_point: SwingPoint
    close_price: float
    wick_extreme: float
    trend_after: MarketTrend

class StructureAnalyzer:
    """
    Analyzes Market Structure step-by-step strictly bar-by-bar:
    - Distinguishes BOS (body close beyond level) from Liquidity Sweep (wick pierce with body close inside).
    - Detects CHoCH / MSS when the key opposing swing point is broken by body close.
    - Operates with ZERO future lookahead.
    """
    def __init__(self, left_bars: int = 2, right_bars: int = 2):
        self.detector = SwingDetector(left_bars=left_bars, right_bars=right_bars)

    def analyze(self, df: pd.DataFrame) -> List[StructureEvent]:
        swings = self.detector.detect(df)
        events: List[StructureEvent] = []

        # Index swings by their confirmation bar
        swings_by_conf_idx = {}
        for s in swings:
            swings_by_conf_idx.setdefault(s.confirmed_index, []).append(s)

        current_trend = MarketTrend.NEUTRAL
        active_high: Optional[SwingPoint] = None
        active_low: Optional[SwingPoint] = None

        highs = df['high'].values
        lows = df['low'].values
        closes = df['close'].values
        times = df.index
        n = len(df)

        for i in range(n):
            # 1. Check if any new swing points were confirmed on this bar
            if i in swings_by_conf_idx:
                for sp in swings_by_conf_idx[i]:
                    if sp.swing_type == SwingType.HIGH:
                        active_high = sp
                    elif sp.swing_type == SwingType.LOW:
                        active_low = sp
                
                # Establish initial trend once we have both a swing high and low
                if current_trend == MarketTrend.NEUTRAL and active_high and active_low:
                    current_trend = MarketTrend.BULLISH if active_high.index > active_low.index else MarketTrend.BEARISH

            if active_high is None or active_low is None:
                continue

            current_close = closes[i]
            current_high = highs[i]
            current_low = lows[i]
            current_time = times[i]

            # 2. Check breaks of the Active High
            if current_high > active_high.price:
                # Body close beyond active high
                if current_close > active_high.price:
                    if current_trend == MarketTrend.BULLISH:
                        event_type = StructureEventType.BOS_BULLISH
                    else:
                        event_type = StructureEventType.CHOCH_BULLISH
                        current_trend = MarketTrend.BULLISH

                    events.append(StructureEvent(
                        bar_index=i,
                        time=current_time,
                        event_type=event_type,
                        level_broken=active_high.price,
                        broken_swing_point=active_high,
                        close_price=current_close,
                        wick_extreme=current_high,
                        trend_after=current_trend
                    ))
                    # High is consumed; clear it until a new swing high confirms
                    active_high = None
                else:
                    # Wick pierced above but closed back inside -> Liquidity Sweep
                    events.append(StructureEvent(
                        bar_index=i,
                        time=current_time,
                        event_type=StructureEventType.SWEEP_BUYSIDE,
                        level_broken=active_high.price,
                        broken_swing_point=active_high,
                        close_price=current_close,
                        wick_extreme=current_high,
                        trend_after=current_trend
                    ))

            # 3. Check breaks of the Active Low
            if active_low is not None and current_low < active_low.price:
                # Body close below active low
                if current_close < active_low.price:
                    if current_trend == MarketTrend.BEARISH:
                        event_type = StructureEventType.BOS_BEARISH
                    else:
                        event_type = StructureEventType.CHOCH_BEARISH
                        current_trend = MarketTrend.BEARISH

                    events.append(StructureEvent(
                        bar_index=i,
                        time=current_time,
                        event_type=event_type,
                        level_broken=active_low.price,
                        broken_swing_point=active_low,
                        close_price=current_close,
                        wick_extreme=current_low,
                        trend_after=current_trend
                    ))
                    # Low is consumed; clear it until a new swing low confirms
                    active_low = None
                else:
                    # Wick pierced below but closed back inside -> Liquidity Sweep
                    events.append(StructureEvent(
                        bar_index=i,
                        time=current_time,
                        event_type=StructureEventType.SWEEP_SELLSIDE,
                        level_broken=active_low.price,
                        broken_swing_point=active_low,
                        close_price=current_close,
                        wick_extreme=current_low,
                        trend_after=current_trend
                    ))

        return events
