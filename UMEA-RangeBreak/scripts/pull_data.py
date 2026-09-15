"""
UMEA-RangeBreak Data Pull Script
Connects to Deriv MT5 and extracts maximum historical M5 data for 'Range Break 100 Index'
"""

import sys
import os
import MetaTrader5 as mt5
import pandas as pd
from datetime import datetime, timezone

SYMBOL = "Range Break 100 Index"
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
os.makedirs(DATA_DIR, exist_ok=True)

def main():
    if not mt5.initialize():
        print(f"Failed to initialize MT5: {mt5.last_error()}", file=sys.stderr)
        return False

    acc = mt5.account_info()
    print(f"Logged into: {acc.login} | Server: {acc.server} | Balance: ${acc.balance:,.2f}")

    # Ensure symbol is selected
    if not mt5.symbol_select(SYMBOL, True):
        print(f"Failed to select symbol {SYMBOL}: {mt5.last_error()}", file=sys.stderr)
        mt5.shutdown()
        return False

    sym_info = mt5.symbol_info(SYMBOL)
    if not sym_info:
        print(f"Symbol info not available for {SYMBOL}", file=sys.stderr)
        mt5.shutdown()
        return False

    print("==================================================")
    print(f"SYMBOL SPECIFICATIONS: {SYMBOL}")
    print("==================================================")
    print(f"Digits:             {sym_info.digits}")
    print(f"Point:              {sym_info.point}")
    print(f"Contract Size:      {sym_info.trade_contract_size}")
    print(f"Min Volume:         {sym_info.volume_min}")
    print(f"Max Volume:         {sym_info.volume_max}")
    print(f"Volume Step:        {sym_info.volume_step}")
    print(f"Trade Stops Level:  {sym_info.trade_stops_level}")
    print("==================================================")

    # Pull maximum M5 bars available from Deriv using chunking
    utc_to = datetime.now(timezone.utc)
    print("Pulling historical data from Deriv MT5...")
    
    all_chunks = []
    current_end = utc_to
    chunk_size = 50000

    while True:
        rates = mt5.copy_rates_from(SYMBOL, mt5.TIMEFRAME_M5, current_end, chunk_size)
        if rates is None or len(rates) == 0:
            break
        
        df_chunk = pd.DataFrame(rates)
        df_chunk['time'] = pd.to_datetime(df_chunk['time'], unit='s')
        all_chunks.append(df_chunk)
        print(f"  Retrieved chunk of {len(df_chunk):,} bars (From {df_chunk['time'].min()} to {df_chunk['time'].max()})")
        
        # Next chunk goes before the oldest time in this chunk
        oldest_time = rates[0]['time']
        current_end = datetime.fromtimestamp(oldest_time, tz=timezone.utc)
        
        # If we got fewer bars than chunk size, we've hit the absolute beginning of history
        if len(rates) < chunk_size:
            break

    if not all_chunks:
        print(f"No rates returned for {SYMBOL}: {mt5.last_error()}", file=sys.stderr)
        mt5.shutdown()
        return False

    df = pd.concat(all_chunks).drop_duplicates(subset=['time']).sort_values('time').reset_index(drop=True)
    df.set_index('time', inplace=True)

    print("==================================================")
    print(f"TOTAL M5 BARS EXTRACTED: {len(df):,}")
    print(f"Date Range: {df.index.min()} to {df.index.max()}")
    print(f"Total History Span: {(df.index.max() - df.index.min()).days} days")
    print("==================================================")

    # Save to CSV
    csv_path = os.path.join(DATA_DIR, "range_break_100_m5.csv")
    df.to_csv(csv_path)
    file_size_mb = os.path.getsize(csv_path) / 1024 / 1024
    print(f"[DONE] Saved CSV to: {csv_path} ({file_size_mb:.2f} MB)")

    mt5.shutdown()
    return True

if __name__ == "__main__":
    main()
