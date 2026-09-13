"""
Body Retracement Study - FX Vol 60 H1
======================================
Question: After a solid directional candle closes (bullish or bearish),
how far does the NEXT candle retrace INTO THE BODY of the previous candle
(between its open and close — ignoring wicks) before continuing?

Metrics:
- Body retracement depth % (0% = no touch of body, 100% = full body retraced)
- Does the next candle continue in trend direction (breach previous high/low)?
- Distribution of retracement depths when continuation happens
- Best entry depth (% into body) that maximizes win rate
"""

import pandas as pd
import numpy as np

# Load data
df = pd.read_parquet(r"c:\Users\USER\Documents\CodeBase Projects\UmeaFX\umea-engine\data\raw\FXVol60_H1_latest.parquet")
df = df.iloc[:-1]  # drop incomplete current candle
print(f"Total closed bars: {len(df)}")

# ─── Classify each candle ───────────────────────────────────────────────────
df["body_size"] = abs(df["close"] - df["open"])
df["is_bullish"] = df["close"] > df["open"]
df["body_top"] = df[["open", "close"]].max(axis=1)
df["body_bot"] = df[["open", "close"]].min(axis=1)

# Minimum body filter — ignore doji / tiny candles
MIN_BODY = 50  # points

records = []

for i in range(1, len(df) - 1):
    prev = df.iloc[i - 1]
    curr = df.iloc[i]

    body = prev["body_size"]
    if body < MIN_BODY:
        continue

    if prev["is_bullish"]:
        # BULLISH previous candle
        # Body = prev["open"] (bottom) to prev["close"] (top)
        body_top = prev["close"]
        body_bot = prev["open"]
        # How deep does curr LOW dip into the body?
        if curr["low"] < body_top:
            dip_into_body = body_top - curr["low"]
            dip_into_body = min(dip_into_body, body)  # cap at 100%
            retrace_pct = (dip_into_body / body) * 100
        else:
            retrace_pct = 0.0  # never touched body

        # Did it continue bullish? (next candle high > prev candle high)
        continued = curr["high"] > prev["high"]
        actual_dip_pts = body_top - curr["low"] if curr["low"] < body_top else 0

        records.append({
            "direction": "BULL",
            "body_pts": body,
            "retrace_pct": retrace_pct,
            "actual_dip_pts": actual_dip_pts,
            "continued": continued,
        })

    else:
        # BEARISH previous candle
        # Body = prev["close"] (bottom) to prev["open"] (top)
        body_top = prev["open"]
        body_bot = prev["close"]
        # How high does curr HIGH push into the body?
        if curr["high"] > body_bot:
            push_into_body = curr["high"] - body_bot
            push_into_body = min(push_into_body, body)
            retrace_pct = (push_into_body / body) * 100
        else:
            retrace_pct = 0.0

        # Did it continue bearish? (next low < prev low)
        continued = curr["low"] < prev["low"]
        actual_dip_pts = curr["high"] - body_bot if curr["high"] > body_bot else 0

        records.append({
            "direction": "BEAR",
            "body_pts": body,
            "retrace_pct": retrace_pct,
            "actual_dip_pts": actual_dip_pts,
            "continued": continued,
        })

rdf = pd.DataFrame(records)
print(f"\nTotal qualifying candle pairs: {len(rdf)}")
print(f"  Bullish setups: {(rdf['direction']=='BULL').sum()}")
print(f"  Bearish setups: {(rdf['direction']=='BEAR').sum()}")

# ─── Distribution of Retracement % ─────────────────────────────────────────
print("\n" + "="*60)
print("OVERALL RETRACEMENT DEPTH DISTRIBUTION")
print("="*60)
bins = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
labels = ["0-10%", "10-20%", "20-30%", "30-40%", "40-50%",
          "50-60%", "60-70%", "70-80%", "80-90%", "90-100%"]
rdf["retrace_bucket"] = pd.cut(rdf["retrace_pct"], bins=bins, labels=labels, include_lowest=True)
bucket_counts = rdf["retrace_bucket"].value_counts().sort_index()
for lbl, cnt in bucket_counts.items():
    pct = cnt / len(rdf) * 100
    bar = "#" * int(pct / 1)
    print(f"  {lbl:10s}: {cnt:5d} ({pct:5.1f}%) {bar}")

print(f"\n  Median retracement: {rdf['retrace_pct'].median():.1f}%")
print(f"  Mean retracement:   {rdf['retrace_pct'].mean():.1f}%")
print(f"  Median dip (pts):   {rdf['actual_dip_pts'].median():.0f}")
print(f"  Mean dip (pts):     {rdf['actual_dip_pts'].mean():.0f}")

# ─── Win Rate by Retracement Bucket ─────────────────────────────────────────
print("\n" + "="*60)
print("WIN RATE (CONTINUATION) BY RETRACEMENT DEPTH BUCKET")
print("="*60)
print(f"{'Bucket':12s} {'Total':>7s} {'Win':>7s} {'Win%':>7s}")
print("-" * 40)
for lbl in labels:
    subset = rdf[rdf["retrace_bucket"] == lbl]
    if len(subset) == 0:
        continue
    wins = subset["continued"].sum()
    wr = wins / len(subset) * 100
    print(f"{lbl:12s} {len(subset):7d} {wins:7d} {wr:7.1f}%")

# ─── Best Entry: Enter at X% into body, target = continuation ───────────────
print("\n" + "="*60)
print("ENTRY DEPTH ANALYSIS: If you enter at exactly X% into body")
print("(dip triggers your limit), how many times does it continue?")
print("="*60)

entry_depths = [10, 20, 30, 40, 50, 60, 70, 80]
print(f"{'Entry at':12s} {'Triggers':>10s} {'Win':>7s} {'Win%':>7s} {'Avg body(pts)':>15s}")
print("-" * 55)
for depth in entry_depths:
    # Only cases where next candle retraced AT LEAST this deep
    triggered = rdf[rdf["retrace_pct"] >= depth]
    if len(triggered) == 0:
        continue
    wins = triggered["continued"].sum()
    wr = wins / len(triggered) * 100
    avg_body = triggered["body_pts"].mean()
    print(f"{depth}% into body  {len(triggered):10d} {wins:7d} {wr:7.1f}% {avg_body:15.0f}")

# ─── Actual Dip Points at each entry level ──────────────────────────────────
print("\n" + "="*60)
print("ACTUAL DIP IN POINTS: When retrace >= X%, how deep was the dip?")
print("="*60)
print(f"{'Entry at':12s} {'Med dip pts':>12s} {'Avg dip pts':>12s} {'75th pct':>10s} {'90th pct':>10s}")
print("-" * 60)
for depth in entry_depths:
    triggered = rdf[rdf["retrace_pct"] >= depth]
    if len(triggered) == 0:
        continue
    med = triggered["actual_dip_pts"].median()
    avg = triggered["actual_dip_pts"].mean()
    p75 = triggered["actual_dip_pts"].quantile(0.75)
    p90 = triggered["actual_dip_pts"].quantile(0.90)
    print(f"{depth}% into body  {med:12.0f} {avg:12.0f} {p75:10.0f} {p90:10.0f}")

# ─── BULL vs BEAR split ──────────────────────────────────────────────────────
print("\n" + "="*60)
print("BULL vs BEAR SPLIT AT KEY ENTRY LEVELS")
print("="*60)
for direction in ["BULL", "BEAR"]:
    sub = rdf[rdf["direction"] == direction]
    print(f"\n  {direction} setups ({len(sub)} total):")
    print(f"  {'Entry at':12s} {'Triggers':>10s} {'Win%':>8s} {'Med dip pts':>12s}")
    for depth in [20, 30, 40, 50, 60]:
        triggered = sub[sub["retrace_pct"] >= depth]
        if len(triggered) == 0:
            continue
        wr = triggered["continued"].mean() * 100
        med = triggered["actual_dip_pts"].median()
        print(f"  {depth}% into body  {len(triggered):10d} {wr:8.1f}% {med:12.0f}")

# ─── Look at current live candles ───────────────────────────────────────────
print("\n" + "="*60)
print("LAST 6 CLOSED CANDLES (for reference)")
print("="*60)
recent = pd.read_parquet(r"c:\Users\USER\Documents\CodeBase Projects\UmeaFX\umea-engine\data\raw\FXVol60_H1_latest.parquet")
recent = recent.tail(7).iloc[:-1]  # last 6 closed
for _, row in recent.iterrows():
    direction = "BULL" if row["close"] > row["open"] else "BEAR"
    body = abs(row["close"] - row["open"])
    total_range = row["high"] - row["low"]
    print(f"  {row['time']} | {direction} | O:{row['open']:.2f} H:{row['high']:.2f} L:{row['low']:.2f} C:{row['close']:.2f} | Body:{body:.0f}pts | Range:{total_range:.0f}pts")

print("\nDone.")
