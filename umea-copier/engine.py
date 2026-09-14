"""
UmeaFX High-Speed Local Multi-Account Trade Copier Engine
"""

import json
import logging
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import MetaTrader5 as mt5
from config import ClientAccount, MasterConfig, load_clients

logger = logging.getLogger("UmeaCopier")

MAPPINGS_FILE = Path(__file__).parent / "config" / "ticket_mappings.json"


@dataclass
class PositionSnapshot:
    ticket: int
    symbol: str
    order_type: int  # 0 = BUY, 1 = SELL
    volume: float
    price_open: float
    sl: float
    tp: float
    profit: float
    magic: int
    comment: str


class CopierEngine:
    def __init__(
        self,
        terminal_path: str = r"C:\Program Files\FBS MetaTrader 5\terminal64.exe",
        symbol: str = "FX Vol 60",
        poll_interval_sec: float = 0.1,
    ):
        self.terminal_path = terminal_path
        self.symbol = symbol
        self.poll_interval = poll_interval_sec
        self.master_config = MasterConfig(symbol=symbol)
        self.clients: List[ClientAccount] = []
        # Mapping: str(master_ticket) -> {client_id: client_ticket}
        self.mappings: Dict[str, Dict[str, int]] = {}
        self.is_running = False
        # Master credentials — stored on first sync so we can always restore
        self.master_login: Optional[int] = None
        self.master_password: Optional[str] = None
        self.master_server: Optional[str] = None
        # Cache for last known SL/TP per master ticket to avoid redundant login cycles
        self.last_sltp: Dict[str, Tuple[float, float]] = {}
        # Cooldown for failed open attempts (ticket_client -> timestamp)
        self.failed_open_attempts: Dict[str, float] = {}
        self._load_mappings()

    def _load_mappings(self):
        if MAPPINGS_FILE.exists():
            try:
                with open(MAPPINGS_FILE, "r", encoding="utf-8") as f:
                    self.mappings = json.load(f)
            except Exception as e:
                logger.error(f"Error loading mappings: {e}")
                self.mappings = {}

    def _save_mappings(self):
        MAPPINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(MAPPINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(self.mappings, f, indent=2)

    def _restore_master(self) -> bool:
        """Re-login to master account after a client operation.
        This is CRITICAL — a single MT5 terminal instance can only be logged
        into ONE account at a time. Every client login call switches the active
        account, so we must immediately switch back to master before doing anything
        else (especially reading master positions).
        """
        if not self.master_login or not self.master_password or not self.master_server:
            return False  # Credentials not captured yet (first cycle edge case)
        ok = mt5.login(
            login=self.master_login,
            password=self.master_password,
            server=self.master_server,
        )
        if not ok:
            logger.error(f"[CRITICAL] Failed to restore Master session ({self.master_login}): {mt5.last_error()}")
        return ok

    def reload_clients(self):
        from config import fetch_cloud_clients
        self.clients = [c for c in fetch_cloud_clients() if c.is_active]
        logger.info(f"Loaded {len(self.clients)} active client account(s) (Cloud/Local).")

    def init_terminal(self) -> bool:
        if not mt5.initialize(path=self.terminal_path):
            logger.error(f"MT5 Initialization failed: {mt5.last_error()}")
            return False
        return True

    def get_account_info(self) -> Optional[dict]:
        acc = mt5.account_info()
        if not acc:
            return None
        return {
            "login": acc.login,
            "server": acc.server,
            "balance": acc.balance,
            "equity": acc.equity,
            "profit": acc.profit,
        }

    def get_master_positions(self) -> List[PositionSnapshot]:
        positions = mt5.positions_get(symbol=self.symbol)
        if positions is None:
            return []
        
        snaps = []
        for p in positions:
            # Match symbol and (optionally) magic
            snaps.append(
                PositionSnapshot(
                    ticket=p.ticket,
                    symbol=p.symbol,
                    order_type=p.type,
                    volume=p.volume,
                    price_open=p.price_open,
                    sl=p.sl,
                    tp=p.tp,
                    profit=p.profit,
                    magic=p.magic,
                    comment=p.comment,
                )
            )
        return snaps

    def calculate_client_volume(self, client: ClientAccount, master_vol: float, master_sl: float, master_open: float) -> float:
        min_lot = mt5.symbol_info(self.symbol).volume_min or 0.01
        max_lot = client.max_lot or 5.0
        lot_step = mt5.symbol_info(self.symbol).volume_step or 0.01

        if client.risk_mode == "fixed":
            vol = client.risk_value
        elif client.risk_mode == "multiplier":
            vol = master_vol * client.risk_value
        elif client.risk_mode == "risk_percent":
            acc = mt5.account_info()
            balance = acc.balance if acc else 500.0
            risk_usd = balance * (client.risk_value / 100.0)
            sl_dist = abs(master_open - master_sl) if master_sl > 0 else 200.0
            tick_value = mt5.symbol_info(self.symbol).trade_tick_value or 0.01
            tick_size = mt5.symbol_info(self.symbol).trade_tick_size or 0.01
            money_per_lot = (sl_dist / tick_size) * tick_value
            vol = risk_usd / max(money_per_lot, 1.0)
        else:
            vol = master_vol

        vol = round(vol / lot_step) * lot_step
        vol = max(min_lot, min(max_lot, vol))
        return round(vol, 2)

    def execute_client_open(self, client: ClientAccount, master_pos: PositionSnapshot) -> Optional[int]:
        """Login to client account, copy open trade, then IMMEDIATELY restore master session."""
        if not mt5.login(login=client.login, password=client.password, server=client.server):
            logger.error(f"Failed to login to Client {client.name} ({client.login}): {mt5.last_error()}")
            self._restore_master()
            return None

        try:
            sym_info = mt5.symbol_info(self.symbol)
            if not sym_info:
                logger.error(f"Symbol {self.symbol} not found on Client {client.login}")
                return None

            volume = self.calculate_client_volume(client, master_pos.volume, master_pos.sl, master_pos.price_open)
            digits = sym_info.digits

            if master_pos.order_type == mt5.ORDER_TYPE_BUY:
                price = mt5.symbol_info_tick(self.symbol).ask
                action = mt5.TRADE_ACTION_DEAL
                order_type = mt5.ORDER_TYPE_BUY
            else:
                price = mt5.symbol_info_tick(self.symbol).bid
                action = mt5.TRADE_ACTION_DEAL
                order_type = mt5.ORDER_TYPE_SELL

            sl = round(master_pos.sl, digits) if master_pos.sl > 0 else 0.0
            tp = round(master_pos.tp, digits) if master_pos.tp > 0 else 0.0

            # Determine the appropriate filling type for this symbol/broker
            filling_mode = sym_info.filling_mode
            if filling_mode & 1:  # SYMBOL_FILLING_FOK
                filling_type = mt5.ORDER_FILLING_FOK
            elif filling_mode & 2:  # SYMBOL_FILLING_IOC
                filling_type = mt5.ORDER_FILLING_IOC
            else:
                filling_type = mt5.ORDER_FILLING_RETURN

            request = {
                "action": action,
                "symbol": self.symbol,
                "volume": volume,
                "type": order_type,
                "price": price,
                "sl": sl,
                "tp": tp,
                "deviation": 30,
                "magic": 606060,
                "comment": f"UMEA-Copy-{master_pos.ticket}",
                "type_time": mt5.ORDER_TIME_GTC,
                "type_filling": filling_type,
            }

            res = mt5.order_send(request)

            # 1. Fallback for 10016 (Invalid Stops): Open position first without stops, then set SL/TP
            if res.retcode == 10016:
                logger.warning(f"Client {client.login} reported Invalid Stops (10016). Retrying open without stops and attaching SL/TP...")
                request["sl"] = 0.0
                request["tp"] = 0.0
                res = mt5.order_send(request)

            # 2. Fallback for 10030 (Unsupported filling mode)
            if res.retcode == 10030:
                for fallback in [mt5.ORDER_FILLING_RETURN, mt5.ORDER_FILLING_FOK, mt5.ORDER_FILLING_IOC]:
                    if fallback != filling_type:
                        request["type_filling"] = fallback
                        res = mt5.order_send(request)
                        if res.retcode == mt5.TRADE_RETCODE_DONE:
                            break

            if res.retcode != mt5.TRADE_RETCODE_DONE:
                logger.error(f"Client {client.login} Open Order Failed: code={res.retcode}, comment={res.comment}")
                return None

            client_ticket = res.order
            logger.info(f"✅ Copied trade to {client.name} ({client.login}) | Ticket: {client_ticket} | Vol: {volume} | Price: {price}")

            # If stops were removed for execution, attach them now
            if (sl > 0 or tp > 0) and request["sl"] == 0.0 and request["tp"] == 0.0:
                sltp_req = {
                    "action": mt5.TRADE_ACTION_SLTP,
                    "position": client_ticket,
                    "symbol": self.symbol,
                    "sl": sl,
                    "tp": tp,
                }
                sltp_res = mt5.order_send(sltp_req)
                if sltp_res.retcode == mt5.TRADE_RETCODE_DONE:
                    logger.info(f"🔒 Attached SL/TP to Client {client.login} ticket #{client_ticket} (SL: {sl}, TP: {tp})")
                else:
                    logger.warning(f"⚠️ Could not attach exact SL/TP to #{client_ticket}: {sltp_res.comment}")

            return client_ticket

        finally:
            # ALWAYS restore master account, no matter what happens above
            self._restore_master()

    def execute_client_modify(self, client: ClientAccount, client_ticket: int, new_sl: float, new_tp: float) -> bool:
        """Login to client account, sync SL/TP, then IMMEDIATELY restore master session."""
        if not mt5.login(login=client.login, password=client.password, server=client.server):
            logger.error(f"[MODIFY] Failed to login to Client {client.name} ({client.login}): {mt5.last_error()}")
            self._restore_master()
            return False

        try:
            # ── 1. Ensure symbol is visible in Market Watch ──────────────────
            if not mt5.symbol_select(self.symbol, True):
                logger.warning(f"[MODIFY] Could not select symbol {self.symbol} on client {client.login}")

            sym_info = mt5.symbol_info(self.symbol)
            digits  = sym_info.digits if sym_info else 3
            point   = sym_info.point  if sym_info else 0.001
            stops_level = sym_info.trade_stops_level if sym_info else 0

            # ── 2. Verify position still exists on client ────────────────────
            pos = mt5.positions_get(ticket=client_ticket)
            if not pos or len(pos) == 0:
                logger.warning(
                    f"[MODIFY] Client {client.name} ({client.login}) position #{client_ticket} "
                    f"not found — already closed or wrong ticket."
                )
                return False

            sl = round(new_sl, digits) if new_sl else 0.0
            tp = round(new_tp, digits) if new_tp else 0.0

            request = {
                "action":   mt5.TRADE_ACTION_SLTP,
                "position": client_ticket,
                "symbol":   self.symbol,
                "sl":       sl,
                "tp":       tp,
            }
            res = mt5.order_send(request)

            if res.retcode == mt5.TRADE_RETCODE_DONE:
                logger.info(
                    f"✅ [MODIFY] {client.name} ({client.login}) #{client_ticket} "
                    f"→ SL={sl}, TP={tp}"
                )
                return True

            # ── 3. Log the exact failure before giving up ────────────────────
            logger.error(
                f"❌ [MODIFY] {client.name} ({client.login}) #{client_ticket} FAILED "
                f"retcode={res.retcode} | comment={res.comment} | SL={sl} TP={tp}"
            )

            # ── 4. Retry: stops-level violation — pull SL back by min distance ─
            if res.retcode == 10016 and sym_info and stops_level > 0:
                tick = mt5.symbol_info_tick(self.symbol)
                p    = pos[0]
                if tick:
                    min_dist = (stops_level + 2) * point
                    if p.type == 0:   # BUY  — SL must be below bid
                        adjusted_sl = round(min(sl, tick.bid - min_dist), digits)
                    else:             # SELL — SL must be above ask
                        adjusted_sl = round(max(sl, tick.ask + min_dist), digits)

                    request["sl"] = adjusted_sl
                    res2 = mt5.order_send(request)
                    if res2.retcode == mt5.TRADE_RETCODE_DONE:
                        logger.info(
                            f"✅ [MODIFY RETRY] {client.name} #{client_ticket} "
                            f"→ Adjusted SL={adjusted_sl} (stop-level fix applied)"
                        )
                        return True
                    logger.error(
                        f"❌ [MODIFY RETRY] Adjusted SL={adjusted_sl} also failed: "
                        f"retcode={res2.retcode} {res2.comment}"
                    )

            return False

        except Exception as e:
            logger.error(f"[MODIFY] Exception for client {client.login}: {e}", exc_info=True)
            return False

        finally:
            self._restore_master()

        # ────────────────────────────────────────────────────────────────────

    def execute_client_close(self, client: ClientAccount, client_ticket: int) -> bool:
        """Login to client account, close position, then IMMEDIATELY restore master session."""
        if not mt5.login(login=client.login, password=client.password, server=client.server):
            self._restore_master()
            return False

        try:
            pos = mt5.positions_get(ticket=client_ticket)
            if not pos or len(pos) == 0:
                # Position already closed (hit TP or SL)
                return True

            p = pos[0]
            tick = mt5.symbol_info_tick(self.symbol)
            price = tick.bid if p.type == mt5.ORDER_TYPE_BUY else tick.ask
            close_type = mt5.ORDER_TYPE_SELL if p.type == mt5.ORDER_TYPE_BUY else mt5.ORDER_TYPE_BUY

            sym_info = mt5.symbol_info(self.symbol)
            filling_mode = sym_info.filling_mode if sym_info else 0
            if filling_mode & 1:
                filling_type = mt5.ORDER_FILLING_FOK
            elif filling_mode & 2:
                filling_type = mt5.ORDER_FILLING_IOC
            else:
                filling_type = mt5.ORDER_FILLING_RETURN

            request = {
                "action": mt5.TRADE_ACTION_DEAL,
                "position": client_ticket,
                "symbol": self.symbol,
                "volume": p.volume,
                "type": close_type,
                "price": price,
                "deviation": 30,
                "magic": 606060,
                "comment": f"UMEA-Close-{client_ticket}",
                "type_time": mt5.ORDER_TIME_GTC,
                "type_filling": filling_type,
            }
            res = mt5.order_send(request)
            if res.retcode != mt5.TRADE_RETCODE_DONE and res.retcode == 10030:
                for fallback in [mt5.ORDER_FILLING_RETURN, mt5.ORDER_FILLING_FOK, mt5.ORDER_FILLING_IOC]:
                    if fallback != filling_type:
                        request["type_filling"] = fallback
                        res = mt5.order_send(request)
                        if res.retcode == mt5.TRADE_RETCODE_DONE:
                            break
            return res.retcode == mt5.TRADE_RETCODE_DONE
        finally:
            self._restore_master()

    def sync_cycle(self, master_login: int, master_pwd: Optional[str], master_server: str):
        """Single high-speed check and synchronization cycle."""
        # Save master credentials for automatic session restoration
        self.master_login = master_login
        if master_pwd:
            self.master_password = master_pwd
        self.master_server = master_server

        # Ensure we are logged in as master before reading positions
        acc = mt5.account_info()
        if not acc or acc.login != master_login:
            if self.master_password:
                mt5.login(login=master_login, password=self.master_password, server=master_server)

        # 1. Read Master Positions
        master_positions = self.get_master_positions()
        current_master_tickets = {str(p.ticket): p for p in master_positions}

        # 2. Check for NEW Master Positions to Copy
        now = time.time()
        for m_ticket_str, m_pos in current_master_tickets.items():
            if m_ticket_str not in self.mappings:
                self.mappings[m_ticket_str] = {}

            # Cache initial SL/TP if not tracked yet
            if m_ticket_str not in self.last_sltp:
                self.last_sltp[m_ticket_str] = (round(m_pos.sl, 2), round(m_pos.tp, 2))

            for client in self.clients:
                if client.login == master_login:
                    continue  # Skip master account itself

                if client.client_id not in self.mappings[m_ticket_str]:
                    # Check failure cooldown (don't retry failed open more than once every 30s)
                    fail_key = f"{m_ticket_str}_{client.client_id}"
                    if fail_key in self.failed_open_attempts:
                        if now - self.failed_open_attempts[fail_key] < 30.0:
                            continue  # Under cooldown, do not spam logins

                    logger.info(f"🔔 New master position detected: #{m_ticket_str} ({'BUY' if m_pos.order_type==0 else 'SELL'}). Copying to {client.name}...")
                    c_ticket = self.execute_client_open(client, m_pos)
                    if c_ticket:
                        self.mappings[m_ticket_str][client.client_id] = c_ticket
                        self._save_mappings()
                        self.last_sltp[m_ticket_str] = (round(m_pos.sl, 2), round(m_pos.tp, 2))
                        self.failed_open_attempts.pop(fail_key, None)
                    else:
                        # Record failure cooldown so we don't spam 10 times a second
                        self.failed_open_attempts[fail_key] = now
                        logger.warning(f"⚠️ Copy failed for client {client.name}. Will retry in 30s.")

        # 3. Check for SL/TP Modifications (Breakeven updates)
        # CRITICAL: Only log into client if SL or TP has ACTUALLY changed on master!
        sym_digits = 5  # safe default; will be overridden below
        try:
            _si = mt5.symbol_info(self.symbol)
            if _si:
                sym_digits = _si.digits
        except Exception:
            pass

        for m_ticket_str, m_pos in current_master_tickets.items():
            client_dict = self.mappings.get(m_ticket_str, {})
            # Use actual symbol precision for comparison — avoids missing fractional SL moves
            current_sltp = (round(m_pos.sl, sym_digits), round(m_pos.tp, sym_digits))
            last_known   = self.last_sltp.get(m_ticket_str)

            if last_known is not None and current_sltp != last_known:
                logger.info(
                    f"🔄 Master #{m_ticket_str} SL/TP changed: {last_known} → {current_sltp}. "
                    f"Syncing {len(client_dict)} client(s)..."
                )
                for client in self.clients:
                    c_ticket = client_dict.get(client.client_id)
                    if c_ticket:
                        ok = self.execute_client_modify(client, c_ticket, m_pos.sl, m_pos.tp)
                        if not ok:
                            logger.warning(
                                f"⚠️ SL/TP sync failed for {client.name} (#{c_ticket}) — "
                                f"check [MODIFY] logs above for retcode."
                            )
                # Update cached SL/TP after sync regardless of individual failures
                self.last_sltp[m_ticket_str] = current_sltp

        # 4. Check for CLOSED Master Positions
        closed_master_tickets = [t for t in self.mappings.keys() if t not in current_master_tickets]
        for c_m_ticket in closed_master_tickets:
            client_dict = self.mappings[c_m_ticket]
            for client in self.clients:
                c_ticket = client_dict.get(client.client_id)
                if c_ticket:
                    logger.info(f"🔒 Master position #{c_m_ticket} closed. Closing Client {client.name} ticket #{c_ticket}...")
                    self.execute_client_close(client, c_ticket)
            del self.mappings[c_m_ticket]
            self.last_sltp.pop(c_m_ticket, None)
            self._save_mappings()

        # Re-login back to master if needed
        self._restore_master()

