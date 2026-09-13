import MetaTrader5 as mt5
import pandas as pd

mt5.initialize(path=r"C:\Program Files\FBS MetaTrader 5\terminal64.exe")

rates = mt5.copy_rates_from_pos("FX Vol 60", mt5.TIMEFRAME_H1, 0, 30000)
mt5.shutdown()

df = pd.DataFrame(rates)
df["time"] = pd.to_datetime(df["time"], unit="s")
df.to_parquet(r"c:\Users\USER\Documents\CodeBase Projects\UmeaFX\umea-engine\data\raw\FXVol60_H1_latest.parquet")
print(f"Fetched {len(df)} bars")
print(f"From: {df['time'].iloc[0]}")
print(f"To:   {df['time'].iloc[-1]}")
print(df.tail(6).to_string())
