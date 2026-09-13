from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional, Dict
import pandas as pd
import numpy as np
from rich.console import Console
from rich.table import Table

console = Console()

class OrderType(str, Enum):
    BUY_LIMIT = "BUY_LIMIT"
    SELL_LIMIT = "SELL_LIMIT"
    BUY_MARKET = "BUY_MARKET"
    SELL_MARKET = "SELL_MARKET"

class TradeStatus(str, Enum):
    PENDING = "PENDING"
    OPEN = "OPEN"
    CLOSED = "CLOSED"
    CANCELLED = "CANCELLED"

class ExitReason(str, Enum):
    TP = "TAKE_PROFIT"
    SL = "STOP_LOSS"
    TIMEOUT = "TIMEOUT"

@dataclass
class Trade:
    id: int
    order_type: OrderType
    entry_price: float
    stop_loss: float
    take_profit: float
    risk_amount: float
    lot_size: float
    status: TradeStatus = TradeStatus.PENDING
    created_time: Optional[pd.Timestamp] = None
    created_bar_idx: int = 0
    open_time: Optional[pd.Timestamp] = None
    open_bar_idx: Optional[int] = None
    close_time: Optional[pd.Timestamp] = None
    close_bar_idx: Optional[int] = None
    close_price: Optional[float] = None
    exit_reason: Optional[ExitReason] = None
    pnl: float = 0.0
    r_multiple: float = 0.0

@dataclass
class BacktestResults:
    initial_balance: float
    final_equity: float
    total_trades: int
    winning_trades: int
    losing_trades: int
    win_rate: float
    profit_factor: float
    total_pnl: float
    max_drawdown_pct: float
    max_drawdown_amount: float
    average_r_multiple: float
    trades: List[Trade] = field(default_factory=list)

class EventDrivenBacktester:
    """
    Realistic bar-by-bar backtesting engine:
    - Fills limit orders only when price reaches the limit level.
    - Accurately triggers SL and TP on intrabar extremes.
    - Prevents lookahead bias.
    - Calculates dynamic lot sizes based on percentage risk per trade.
    """
    def __init__(
        self,
        initial_balance: float = 10000.0,
        risk_percent: float = 1.0,         # 1% risk per trade
        point_value: float = 1.0,           # Value of 1 point movement per 1.0 standard lot (Gold: 1 pip = 10 points = $10/lot, $1 move = 100 points)
        spread_points: float = 0.25,        # Typical XAUUSD spread ($0.25)
        max_pending_bars: int = 24          # Cancel pending order if not filled within N bars
    ):
        self.initial_balance = initial_balance
        self.current_balance = initial_balance
        self.risk_percent = risk_percent
        self.point_value = point_value
        self.spread_points = spread_points
        self.max_pending_bars = max_pending_bars

        self.pending_trades: List[Trade] = []
        self.open_trades: List[Trade] = []
        self.closed_trades: List[Trade] = []
        self.equity_curve: List[float] = [initial_balance]
        self.trade_counter = 0

    def calculate_lot_size(self, entry: float, sl: float) -> float:
        risk_dollars = self.current_balance * (self.risk_percent / 100.0)
        distance = abs(entry - sl)
        if distance <= 0:
            return 0.01
        # For Gold (XAUUSD): 1 standard lot = 100 oz. $1 move in price = $100 PnL per lot.
        # lot_size = risk_dollars / (distance * 100)
        lot_size = risk_dollars / (distance * 100.0)
        return round(max(0.01, min(lot_size, 50.0)), 2)

    def place_order(
        self,
        order_type: OrderType,
        entry_price: float,
        stop_loss: float,
        take_profit: float,
        bar_idx: int,
        timestamp: pd.Timestamp
    ) -> Optional[Trade]:
        lot_size = self.calculate_lot_size(entry_price, stop_loss)
        risk_dollars = self.current_balance * (self.risk_percent / 100.0)

        self.trade_counter += 1
        trade = Trade(
            id=self.trade_counter,
            order_type=order_type,
            entry_price=entry_price,
            stop_loss=stop_loss,
            take_profit=take_profit,
            risk_amount=risk_dollars,
            lot_size=lot_size,
            created_time=timestamp,
            created_bar_idx=bar_idx,
            status=TradeStatus.PENDING
        )
        self.pending_trades.append(trade)
        return trade

    def update_bar(self, bar_idx: int, timestamp: pd.Timestamp, bar_open: float, bar_high: float, bar_low: float, bar_close: float):
        # 1. Process Pending Limit Orders
        still_pending = []
        for trade in self.pending_trades:
            # Check for timeout
            if (bar_idx - trade.created_bar_idx) > self.max_pending_bars:
                trade.status = TradeStatus.CANCELLED
                continue

            filled = False
            if trade.order_type == OrderType.BUY_LIMIT:
                # Buy Limit fills if price dips down to or below entry price
                if bar_low <= trade.entry_price:
                    trade.status = TradeStatus.OPEN
                    trade.open_time = timestamp
                    trade.open_bar_idx = bar_idx
                    self.open_trades.append(trade)
                    filled = True
            elif trade.order_type == OrderType.SELL_LIMIT:
                # Sell Limit fills if price rallies up to or above entry price
                if bar_high >= trade.entry_price:
                    trade.status = TradeStatus.OPEN
                    trade.open_time = timestamp
                    trade.open_bar_idx = bar_idx
                    self.open_trades.append(trade)
                    filled = True

            if not filled:
                still_pending.append(trade)

        self.pending_trades = still_pending

        # 2. Process Open Trades (Check SL and TP)
        still_open = []
        for trade in self.open_trades:
            closed = False
            if trade.order_type == OrderType.BUY_LIMIT or trade.order_type == OrderType.BUY_MARKET:
                # Check Stop Loss first (conservative risk modeling)
                if bar_low <= trade.stop_loss:
                    trade.close_price = trade.stop_loss
                    trade.exit_reason = ExitReason.SL
                    closed = True
                # Check Take Profit
                elif bar_high >= trade.take_profit:
                    trade.close_price = trade.take_profit
                    trade.exit_reason = ExitReason.TP
                    closed = True

                if closed:
                    # Gold PnL: (close - entry) * 100 * lot_size
                    pnl = (trade.close_price - trade.entry_price) * 100.0 * trade.lot_size
                    trade.pnl = pnl
                    trade.r_multiple = pnl / trade.risk_amount if trade.risk_amount > 0 else 0
                    trade.close_time = timestamp
                    trade.close_bar_idx = bar_idx
                    trade.status = TradeStatus.CLOSED
                    self.current_balance += pnl
                    self.closed_trades.append(trade)

            elif trade.order_type == OrderType.SELL_LIMIT or trade.order_type == OrderType.SELL_MARKET:
                # Check Stop Loss first
                if bar_high >= trade.stop_loss:
                    trade.close_price = trade.stop_loss
                    trade.exit_reason = ExitReason.SL
                    closed = True
                # Check Take Profit
                elif bar_low <= trade.take_profit:
                    trade.close_price = trade.take_profit
                    trade.exit_reason = ExitReason.TP
                    closed = True

                if closed:
                    pnl = (trade.entry_price - trade.close_price) * 100.0 * trade.lot_size
                    trade.pnl = pnl
                    trade.r_multiple = pnl / trade.risk_amount if trade.risk_amount > 0 else 0
                    trade.close_time = timestamp
                    trade.close_bar_idx = bar_idx
                    trade.status = TradeStatus.CLOSED
                    self.current_balance += pnl
                    self.closed_trades.append(trade)

            if not closed:
                still_open.append(trade)

        self.open_trades = still_open
        self.equity_curve.append(self.current_balance)

    def get_results(self) -> BacktestResults:
        total = len(self.closed_trades)
        wins = [t for t in self.closed_trades if t.pnl > 0]
        losses = [t for t in self.closed_trades if t.pnl <= 0]
        
        win_count = len(wins)
        loss_count = len(losses)
        win_rate = (win_count / total * 100.0) if total > 0 else 0.0

        gross_profit = sum(t.pnl for t in wins)
        gross_loss = abs(sum(t.pnl for t in losses))
        profit_factor = (gross_profit / gross_loss) if gross_loss > 0 else (99.0 if gross_profit > 0 else 0.0)

        total_pnl = sum(t.pnl for t in self.closed_trades)
        avg_r = (sum(t.r_multiple for t in self.closed_trades) / total) if total > 0 else 0.0

        # Calculate Max Drawdown
        equity_series = pd.Series(self.equity_curve)
        peak = equity_series.cummax()
        drawdown = (equity_series - peak) / peak * 100.0
        max_dd_pct = abs(drawdown.min()) if not drawdown.empty else 0.0
        max_dd_amount = abs((equity_series - peak).min()) if not drawdown.empty else 0.0

        return BacktestResults(
            initial_balance=self.initial_balance,
            final_equity=self.current_balance,
            total_trades=total,
            winning_trades=win_count,
            losing_trades=loss_count,
            win_rate=win_rate,
            profit_factor=profit_factor,
            total_pnl=total_pnl,
            max_drawdown_pct=max_dd_pct,
            max_drawdown_amount=max_dd_amount,
            average_r_multiple=avg_r,
            trades=self.closed_trades
        )
