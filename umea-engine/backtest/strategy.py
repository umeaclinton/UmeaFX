from dataclasses import dataclass
from typing import List, Optional, Dict
import pandas as pd
from rich.console import Console
from rich.table import Table

from smc.swings import SwingDetector, SwingPoint, SwingType
from smc.structure import StructureAnalyzer, StructureEventType, StructureEvent, MarketTrend
from smc.fvg import FVGDetector, FVGType, FVGStatus, FVG
from .engine import EventDrivenBacktester, OrderType, BacktestResults

console = Console()

class AdvancedSMCStrategy:
    """
    Advanced Multi-Timeframe SMC/ICT Strategy:
    1. Higher Timeframe (H1) Market Structure Bias (Trend Filter).
    2. Session Timing Filter: London Killzone (07:00-11:00 UTC) & NY Killzone (12:00-17:00 UTC).
    3. Setup Timeframe (M15):
       - Step A: Price sweeps prior liquidity (Buy-side or Sell-side).
       - Step B: Market Structure Shift (CHoCH) with body close in alignment with H1 bias.
       - Step C: Displacement forms an FVG (Fair Value Gap).
       - Step D: Limit Order at 50% Consequent Encroachment (CE).
       - Step E: Stop Loss placed beyond sweep wick; Target = 2.0R to 3.0R.
    """
    def __init__(
        self,
        risk_to_reward: float = 2.5,
        min_fvg_points: float = 1.0,
        risk_percent: float = 1.0,
        initial_balance: float = 10000.0,
        max_pending_bars: int = 16,
        use_session_filter: bool = True,
        use_htf_filter: bool = True
    ):
        self.risk_to_reward = risk_to_reward
        self.min_fvg_points = min_fvg_points
        self.risk_percent = risk_percent
        self.initial_balance = initial_balance
        self.max_pending_bars = max_pending_bars
        self.use_session_filter = use_session_filter
        self.use_htf_filter = use_htf_filter

    def is_in_killzone(self, dt: pd.Timestamp) -> bool:
        """London Open (07:00-11:00 UTC) or New York Open / Overlap (12:00-17:00 UTC)"""
        hour = dt.hour
        is_london = 7 <= hour <= 11
        is_ny = 12 <= hour <= 17
        return is_london or is_ny

    def run(self, df_m15: pd.DataFrame, df_h1: Optional[pd.DataFrame] = None) -> BacktestResults:
        backtester = EventDrivenBacktester(
            initial_balance=self.initial_balance,
            risk_percent=self.risk_percent,
            max_pending_bars=self.max_pending_bars
        )

        # 1. Detect H1 Structure Bias if provided
        h1_trends_by_time: Dict[pd.Timestamp, MarketTrend] = {}
        if df_h1 is not None and self.use_htf_filter:
            h1_analyzer = StructureAnalyzer(left_bars=2, right_bars=2)
            h1_events = h1_analyzer.analyze(df_h1)
            # Map trend over time
            current_h1_trend = MarketTrend.NEUTRAL
            event_idx = 0
            for t in df_h1.index:
                while event_idx < len(h1_events) and h1_events[event_idx].time <= t:
                    current_h1_trend = h1_events[event_idx].trend_after
                    event_idx += 1
                h1_trends_by_time[t] = current_h1_trend

        # 2. M15 Structure & Indicators
        m15_analyzer = StructureAnalyzer(left_bars=2, right_bars=2)
        m15_events = m15_analyzer.analyze(df_m15)
        fvg_detector = FVGDetector(min_gap_points=self.min_fvg_points)
        fvgs = fvg_detector.detect(df_m15)

        events_by_bar = {}
        for ev in m15_events:
            events_by_bar.setdefault(ev.bar_index, []).append(ev)

        fvgs_by_bar = {}
        for f in fvgs:
            fvgs_by_bar.setdefault(f.index + 1, []).append(f)

        # State tracking
        recent_sweep: Optional[StructureEvent] = None
        sweep_extreme_price: float = 0.0

        n = len(df_m15)
        opens = df_m15['open'].values
        highs = df_m15['high'].values
        lows = df_m15['low'].values
        closes = df_m15['close'].values
        times = df_m15.index

        for i in range(n):
            current_time = times[i]
            o, h, l, c = opens[i], highs[i], lows[i], closes[i]

            # Update backtester (check pending fills, stop loss, take profit)
            backtester.update_bar(i, current_time, o, h, l, c)

            # Determine H1 Trend for current candle
            h1_trend = MarketTrend.NEUTRAL
            if self.use_htf_filter and df_h1 is not None:
                # Find the most recent H1 candle before or equal to current_time
                h1_cutoff = current_time.floor('1h')
                h1_trend = h1_trends_by_time.get(h1_cutoff, MarketTrend.NEUTRAL)

            # Check structure events on this bar
            if i in events_by_bar:
                for ev in events_by_bar[i]:
                    if ev.event_type == StructureEventType.SWEEP_SELLSIDE:
                        recent_sweep = ev
                        sweep_extreme_price = ev.wick_extreme
                    elif ev.event_type == StructureEventType.SWEEP_BUYSIDE:
                        recent_sweep = ev
                        sweep_extreme_price = ev.wick_extreme

                    elif ev.event_type == StructureEventType.CHOCH_BULLISH:
                        # Only enter if:
                        # A) We had a valid Sell-Side Sweep (bear trap)
                        # B) Session Filter allows it (London/NY Killzone)
                        # C) H1 Trend is Bullish (or Neutral)
                        session_ok = not self.use_session_filter or self.is_in_killzone(current_time)
                        htf_ok = not self.use_htf_filter or (h1_trend != MarketTrend.BEARISH)

                        if recent_sweep and recent_sweep.event_type == StructureEventType.SWEEP_SELLSIDE and session_ok and htf_ok:
                            # Look for active Bullish FVG
                            cand_fvg = None
                            for lookback in range(i, max(0, i - 6), -1):
                                if lookback in fvgs_by_bar:
                                    for f in fvgs_by_bar[lookback]:
                                        if f.fvg_type == FVGType.BULLISH:
                                            cand_fvg = f
                                            break
                                if cand_fvg:
                                    break

                            if cand_fvg:
                                entry = cand_fvg.ce
                                sl = sweep_extreme_price - 0.50
                                risk_dist = entry - sl
                                if risk_dist > 0.50:
                                    tp = entry + (risk_dist * self.risk_to_reward)
                                    if len(backtester.pending_trades) + len(backtester.open_trades) < 2:
                                        backtester.place_order(
                                            order_type=OrderType.BUY_LIMIT,
                                            entry_price=entry,
                                            stop_loss=sl,
                                            take_profit=tp,
                                            bar_idx=i,
                                            timestamp=current_time
                                        )
                            recent_sweep = None

                    elif ev.event_type == StructureEventType.CHOCH_BEARISH:
                        session_ok = not self.use_session_filter or self.is_in_killzone(current_time)
                        htf_ok = not self.use_htf_filter or (h1_trend != MarketTrend.BULLISH)

                        if recent_sweep and recent_sweep.event_type == StructureEventType.SWEEP_BUYSIDE and session_ok and htf_ok:
                            cand_fvg = None
                            for lookback in range(i, max(0, i - 6), -1):
                                if lookback in fvgs_by_bar:
                                    for f in fvgs_by_bar[lookback]:
                                        if f.fvg_type == FVGType.BEARISH:
                                            cand_fvg = f
                                            break
                                if cand_fvg:
                                    break

                            if cand_fvg:
                                entry = cand_fvg.ce
                                sl = sweep_extreme_price + 0.50
                                risk_dist = sl - entry
                                if risk_dist > 0.50:
                                    tp = entry - (risk_dist * self.risk_to_reward)
                                    if len(backtester.pending_trades) + len(backtester.open_trades) < 2:
                                        backtester.place_order(
                                            order_type=OrderType.SELL_LIMIT,
                                            entry_price=entry,
                                            stop_loss=sl,
                                            take_profit=tp,
                                            bar_idx=i,
                                            timestamp=current_time
                                        )
                            recent_sweep = None

        return backtester.get_results()
