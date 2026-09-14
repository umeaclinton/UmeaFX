"""
UmeaFX Client Order Execution Worker
Runs in an isolated process targeting the dedicated Client Worker MT5 terminal.
This ensures the Master MT5 terminal is never logged out or interrupted.
"""

import json
import logging
import sys
from pathlib import Path
from typing import Optional

import MetaTrader5 as mt5

logging.basicConfig(level=logging.INFO, format="%(asctime)s [Worker] %(message)s")
logger = logging.getLogger("UmeaWorker")

CLIENT_TERMINAL_PATH = r"C:\Users\USER\MT5-Client-Worker\terminal64.exe"


def init_client_terminal() -> bool:
    if not mt5.initialize(path=CLIENT_TERMINAL_PATH, portable=True, timeout=15000):
        logger.error(f"Failed to connect to Client Worker MT5: {mt5.last_error()}")
        return False
    return True


def execute_open(
    login: int,
    password: str,
    server: str,
    symbol: str,
    order_type: int,  # 0 = BUY, 1 = SELL
    volume: float,
    sl: float,
    tp: float,
    master_ticket: int,
) -> dict:
    if not init_client_terminal():
        return {"success": False, "error": "Failed to initialize client terminal"}

    try:
        if not mt5.login(login=login, password=password, server=server):
            err = mt5.last_error()
            logger.error(f"Login failed for client {login}: {err}")
            return {"success": False, "error": f"Login failed: {err}"}

        sym_info = mt5.symbol_info(symbol)
        if not sym_info:
            logger.error(f"Symbol {symbol} not found on client {login}")
            return {"success": False, "error": f"Symbol {symbol} not found"}

        digits = sym_info.digits
        tick = mt5.symbol_info_tick(symbol)
        if not tick:
            return {"success": False, "error": f"Could not get tick for {symbol}"}

        if order_type == mt5.ORDER_TYPE_BUY:
            price = tick.ask
            action = mt5.TRADE_ACTION_DEAL
            trade_type = mt5.ORDER_TYPE_BUY
        else:
            price = tick.bid
            action = mt5.TRADE_ACTION_DEAL
            trade_type = mt5.ORDER_TYPE_SELL

        sl_val = round(sl, digits) if sl > 0 else 0.0
        tp_val = round(tp, digits) if tp > 0 else 0.0

        # Determine filling mode
        filling_mode = sym_info.filling_mode
        if filling_mode & 1:
            filling_type = mt5.ORDER_FILLING_FOK
        elif filling_mode & 2:
            filling_type = mt5.ORDER_FILLING_IOC
        else:
            filling_type = mt5.ORDER_FILLING_RETURN

        request = {
            "action": action,
            "symbol": symbol,
            "volume": volume,
            "type": trade_type,
            "price": price,
            "sl": sl_val,
            "tp": tp_val,
            "deviation": 30,
            "magic": 606060,
            "comment": f"UMEA-Copy-{master_ticket}",
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

        if res.retcode != mt5.TRADE_RETCODE_DONE:
            logger.error(f"Client {login} order failed: code={res.retcode}, comment={res.comment}")
            return {"success": False, "error": f"Order failed: {res.comment} (code {res.retcode})"}

        logger.info(f"✅ Executed on client {login}: Ticket #{res.order}, Volume: {volume}")
        return {"success": True, "order": res.order, "volume": volume, "price": price}

    finally:
        mt5.shutdown()


def execute_modify(
    login: int,
    password: str,
    server: str,
    symbol: str,
    client_ticket: int,
    sl: float,
    tp: float,
) -> dict:
    if not init_client_terminal():
        return {"success": False, "error": "Failed to initialize client terminal"}

    try:
        if not mt5.login(login=login, password=password, server=server):
            return {"success": False, "error": "Login failed"}

        sym_info = mt5.symbol_info(symbol)
        digits = sym_info.digits if sym_info else 2
        sl_val = round(sl, digits)
        tp_val = round(tp, digits)

        request = {
            "action": mt5.TRADE_ACTION_SLTP,
            "position": client_ticket,
            "symbol": symbol,
            "sl": sl_val,
            "tp": tp_val,
        }
        res = mt5.order_send(request)
        return {"success": res.retcode == mt5.TRADE_RETCODE_DONE}
    finally:
        mt5.shutdown()


def execute_close(
    login: int,
    password: str,
    server: str,
    symbol: str,
    client_ticket: int,
) -> dict:
    if not init_client_terminal():
        return {"success": False, "error": "Failed to initialize client terminal"}

    try:
        if not mt5.login(login=login, password=password, server=server):
            return {"success": False, "error": "Login failed"}

        pos = mt5.positions_get(ticket=client_ticket)
        if not pos or len(pos) == 0:
            return {"success": True, "note": "Position already closed"}

        p = pos[0]
        tick = mt5.symbol_info_tick(symbol)
        price = tick.bid if p.type == mt5.ORDER_TYPE_BUY else tick.ask
        close_type = mt5.ORDER_TYPE_SELL if p.type == mt5.ORDER_TYPE_BUY else mt5.ORDER_TYPE_BUY

        sym_info = mt5.symbol_info(symbol)
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
            "symbol": symbol,
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
        return {"success": res.retcode == mt5.TRADE_RETCODE_DONE}
    finally:
        mt5.shutdown()


if __name__ == "__main__":
    raw_input = sys.stdin.read()
    if raw_input:
        payload = json.loads(raw_input)
        action = payload.get("action")
        if action == "open":
            res = execute_open(
                login=payload["login"],
                password=payload["password"],
                server=payload["server"],
                symbol=payload["symbol"],
                order_type=payload["order_type"],
                volume=payload["volume"],
                sl=payload.get("sl", 0.0),
                tp=payload.get("tp", 0.0),
                master_ticket=payload["master_ticket"],
            )
        elif action == "modify":
            res = execute_modify(
                login=payload["login"],
                password=payload["password"],
                server=payload["server"],
                symbol=payload["symbol"],
                client_ticket=payload["client_ticket"],
                sl=payload["sl"],
                tp=payload["tp"],
            )
        elif action == "close":
            res = execute_close(
                login=payload["login"],
                password=payload["password"],
                server=payload["server"],
                symbol=payload["symbol"],
                client_ticket=payload["client_ticket"],
            )
        else:
            res = {"success": False, "error": f"Unknown action: {action}"}

        print("__RESULT__" + json.dumps(res))
