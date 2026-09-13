"""
Mode 3 Vectorized Optimization - Body Retracement Entry
Fast numpy-based grid search.
"""

import pandas as pd
import numpy as np

df = pd.read_parquet(r"c:\Users\USER\Documents\CodeBase Projects\UmeaFX\umea-engine\data\raw\FXVol60_H1_latest.parquet")
df = df.iloc[:-1].reset_index(drop=True)

# ── Pre-compute arrays (fast) ─────────────────────────────────────────────────
o  = df["open"].values
h  = df["high"].values
l  = df["low"].values
c  = df["close"].values
N  = len(df)

# Shift by 1: prev candle properties, curr candle H/L
p_o     = o[:-2];  p_h = h[:-2];  p_l = l[:-2];  p_c = c[:-2]
cur_h   = h[1:-1]; cur_l = l[1:-1]
nxt_h   = h[2:];   nxt_l = l[2:]
nxt_c   = c[2:]

p_bull   = p_c > p_o
p_body   = np.abs(p_c - p_o)
p_btop   = np.maximum(p_o, p_c)
p_bbot   = np.minimum(p_o, p_c)

print(f"Bars: {N}  |  Pairs to test: {len(p_bull)}")

ENTRY_PCTS = [0.20, 0.30, 0.40]
MIN_BODIES = [80, 100, 120]
TPS        = [200, 300, 400, 500, 600]
SLS        = [200, 250, 300, 350, 400]   # fixed SL distance from entry

results = []

for min_body in MIN_BODIES:
    mask_body = p_body >= min_body

    for entry_pct in ENTRY_PCTS:
        # ── BULL setups ───────────────────────────────────────────────────────
        # Entry = body_top - body * entry_pct  (buy limit)
        bull_mask  = mask_body & p_bull
        bull_entry = p_btop[bull_mask] - p_body[bull_mask] * entry_pct
        bull_curH  = cur_h[bull_mask]
        bull_curL  = cur_l[bull_mask]
        bull_nxtH  = nxt_h[bull_mask]
        bull_nxtL  = nxt_l[bull_mask]
        bull_nxtC  = nxt_c[bull_mask]

        triggered_bull = bull_curL <= bull_entry   # limit filled on curr candle

        # ── BEAR setups ───────────────────────────────────────────────────────
        # Entry = body_bot + body * entry_pct  (sell limit)
        bear_mask  = mask_body & ~p_bull
        bear_entry = p_bbot[bear_mask] + p_body[bear_mask] * entry_pct
        bear_curH  = cur_h[bear_mask]
        bear_curL  = cur_l[bear_mask]
        bear_nxtH  = nxt_h[bear_mask]
        bear_nxtL  = nxt_l[bear_mask]
        bear_nxtC  = nxt_c[bear_mask]

        triggered_bear = bear_curH >= bear_entry

        for sl_pts in SLS:
            for tp_pts in TPS:

                # ── BULL trades ───────────────────────────────────────────────
                e   = bull_entry[triggered_bull]
                cH  = bull_curH[triggered_bull]
                cL  = bull_curL[triggered_bull]
                nH  = bull_nxtH[triggered_bull]
                nL  = bull_nxtL[triggered_bull]
                nC  = bull_nxtC[triggered_bull]

                tp_price = e + tp_pts
                sl_price = e - sl_pts

                # Curr candle: did it hit TP or SL?
                cur_tp = cH >= tp_price
                cur_sl = cL <= sl_price
                # If both on same candle → SL (conservative)
                cur_both = cur_tp & cur_sl
                bull_win_cur  = cur_tp & ~cur_both
                bull_loss_cur = cur_sl | cur_both

                # Remaining: neither hit on curr candle
                rem = ~cur_tp & ~cur_sl
                nxt_tp = nH[rem] >= tp_price[rem]
                nxt_sl = nL[rem] <= sl_price[rem]
                nxt_both = nxt_tp & nxt_sl
                bull_win_nxt  = nxt_tp & ~nxt_both
                bull_loss_nxt = nxt_sl | nxt_both
                # Still open after 2 candles: close at nxt_c
                still_open = rem.copy()
                still_open[rem] = ~nxt_tp & ~nxt_sl
                close_pnl = nC[rem][~nxt_tp & ~nxt_sl] - e[rem][~nxt_tp & ~nxt_sl]

                bull_wins   = bull_win_cur.sum() + bull_win_nxt.sum() + (close_pnl > 0).sum()
                bull_losses = bull_loss_cur.sum() + bull_loss_nxt.sum() + (close_pnl <= 0).sum()
                bull_trades = bull_wins + bull_losses

                bull_net = (bull_wins * tp_pts
                            - (bull_loss_cur.sum() + bull_loss_nxt.sum() + (close_pnl <= 0).sum()) * sl_pts
                            + close_pnl[close_pnl > 0].sum()
                            - np.abs(close_pnl[close_pnl <= 0]).sum())

                # ── BEAR trades ───────────────────────────────────────────────
                e   = bear_entry[triggered_bear]
                cH  = bear_curH[triggered_bear]
                cL  = bear_curL[triggered_bear]
                nH  = bear_nxtH[triggered_bear]
                nL  = bear_nxtL[triggered_bear]
                nC  = bear_nxtC[triggered_bear]

                tp_price = e - tp_pts
                sl_price = e + sl_pts

                cur_tp   = cL <= tp_price
                cur_sl   = cH >= sl_price
                cur_both = cur_tp & cur_sl
                bear_win_cur  = cur_tp & ~cur_both
                bear_loss_cur = cur_sl | cur_both

                rem = ~cur_tp & ~cur_sl
                nxt_tp   = nL[rem] <= tp_price[rem]
                nxt_sl   = nH[rem] >= sl_price[rem]
                nxt_both = nxt_tp & nxt_sl
                bear_win_nxt  = nxt_tp & ~nxt_both
                bear_loss_nxt = nxt_sl | nxt_both
                close_pnl_b = e[rem][~nxt_tp & ~nxt_sl] - nC[rem][~nxt_tp & ~nxt_sl]

                bear_wins   = bear_win_cur.sum() + bear_win_nxt.sum() + (close_pnl_b > 0).sum()
                bear_losses = bear_loss_cur.sum() + bear_loss_nxt.sum() + (close_pnl_b <= 0).sum()
                bear_trades = bear_wins + bear_losses

                bear_net = (bear_wins * tp_pts
                            - (bear_loss_cur.sum() + bear_loss_nxt.sum() + (close_pnl_b <= 0).sum()) * sl_pts
                            + close_pnl_b[close_pnl_b > 0].sum()
                            - np.abs(close_pnl_b[close_pnl_b <= 0]).sum())

                total_trades = bull_trades + bear_trades
                total_wins   = bull_wins + bear_wins
                total_losses = bull_losses + bear_losses
                net_pts      = bull_net + bear_net

                if total_trades < 500:
                    continue

                wr = total_wins / total_trades * 100
                gross_w = total_wins * tp_pts
                gross_l = total_losses * sl_pts
                pf = gross_w / max(gross_l, 1)

                results.append({
                    "min_body": min_body,
                    "entry_pct": int(entry_pct * 100),
                    "tp_pts": tp_pts,
                    "sl_pts": sl_pts,
                    "trades": total_trades,
                    "wins": total_wins,
                    "wr": round(wr, 1),
                    "net_pts": round(net_pts),
                    "pf": round(pf, 2),
                })

rdf = pd.DataFrame(results)
print(f"\nTotal configs evaluated: {len(rdf)}")

print("\n" + "="*80)
print("TOP 15 by NET POINTS")
print("="*80)
print(rdf.nlargest(15, "net_pts").to_string(index=False))

print("\n" + "="*80)
print("TOP 15 by PROFIT FACTOR")
print("="*80)
print(rdf.nlargest(15, "pf").to_string(index=False))

print("\n" + "="*80)
print("BEST BALANCED: WR >= 65%, PF >= 1.3, sorted by Net Pts")
print("="*80)
bal = rdf[(rdf["wr"] >= 65) & (rdf["pf"] >= 1.3)].nlargest(15, "net_pts")
print(bal.to_string(index=False))

print("\nDone.")
