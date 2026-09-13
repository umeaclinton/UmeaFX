//+------------------------------------------------------------------+
//|                                       UMEA_FXVol60_Master.mq5    |
//|                             UmeaFX FX Vol 60 Synthetic Engine    |
//|                                  Copyright 2026, UmeaFX Project. |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, UmeaFX Project."
#property link      "https://www.umeafx.com"
#property version   "2.10"
#property description "UmeaFX FX Vol 60 | Mode 3: Mirror last candle body | Mode 2: Daily Fade"

#include "Defines.mqh"
#include "TrendEngine.mqh"
#include "TradeManager.mqh"

//+------------------------------------------------------------------+
//| Inputs                                                           |
//+------------------------------------------------------------------+
input group "=== General Strategy Controls ==="
input ulong    InpMagicNumber        = 606060;   // Magic Number
input bool     InpEnableBodyRetrace  = true;     // Enable Mode 3: Body Retracement (Mirror Candle)
input bool     InpEnableBoundaryFade = true;     // Enable Mode 2: Daily Boundary Fade

input group "=== Mode 3: Body Retracement (Mirror Last Candle) ==="
input double   InpBodyEntryPct       = 12.0;     // Entry Depth into Previous Body (%) [User: 12%]
input double   InpMinBodyPts         = 100.0;    // Minimum Candle Body to Trade (Points) [Filters doji]
input double   InpBodySL             = 200.0;    // Body Retrace Stop Loss (Points)
input double   InpBodyTP             = 400.0;    // Body Retrace Take Profit (Points)

input group "=== Mode 2: Daily Boundary Fade (Ceiling / Floor) ==="
input double   InpFadeBoundary       = 1000.0;   // Boundary Distance from Daily Open (Points)
input double   InpFadeSL             = 500.0;    // Fade Stop Loss (Points)
input double   InpFadeTP             = 500.0;    // Fade Take Profit (Points)

input group "=== Breakeven Protection ==="
input bool     InpEnableBreakeven    = true;     // Enable Breakeven
input double   InpBETriggerPoints    = 150.0;    // Move SL to BE when Profit >= (Points)
input double   InpBELockPoints       = 20.0;     // Points to Lock at Breakeven

input group "=== Risk & Circuit Breaker ==="
input bool     InpUseFixedLot        = false;    // Use Fixed Lot Size
input double   InpFixedLot           = 0.10;     // Fixed Lot Size
input double   InpRiskPercent        = 1.0;      // Risk Per Trade (% of Balance)
input int      InpMaxDailyLosses     = 3;        // Max Daily Losses Before Pausing

//+------------------------------------------------------------------+
//| Globals                                                          |
//+------------------------------------------------------------------+
CTrendEngine   ExtTrendEngine;
CTradeManager  ExtTradeManager;
datetime       ExtLastBarH1 = 0;

//+------------------------------------------------------------------+
//| Expert initialization                                            |
//+------------------------------------------------------------------+
int OnInit()
{
   if(!ExtTrendEngine.Init(_Symbol, InpFadeBoundary))
   {
      Print("TrendEngine init failed!");
      return INIT_FAILED;
   }
   ExtTradeManager.Init(_Symbol, InpMagicNumber, InpUseFixedLot, InpFixedLot,
                        InpRiskPercent, InpMaxDailyLosses,
                        InpEnableBreakeven, InpBETriggerPoints, InpBELockPoints);
   ExtLastBarH1 = 0;
   Print("UmeaFX FX Vol 60 v2.10 ready | Mode 3: Mirror candle, entry at ",
         InpBodyEntryPct, "% into body");
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   Comment("");
}

//+------------------------------------------------------------------+
//| HUD                                                              |
//+------------------------------------------------------------------+
void UpdateHUD()
{
   double price      = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double daily_open = ExtTrendEngine.GetDailyOpen();
   double dist       = ExtTrendEngine.GetDistanceToOpen(price);
   ENUM_DAILY_ZONE zone = ExtTrendEngine.GetZone(price);

   string zone_str = "ZONE 1: NORMAL (Mode 3 Active)";
   if(zone == ZONE_CEILING_EXTREME) zone_str = "ZONE 2: CEILING - Mode 2 Fade SHORT";
   else if(zone == ZONE_FLOOR_EXTREME) zone_str = "ZONE 2: FLOOR - Mode 2 Fade LONG";

   string last_candle = "";
   if(ExtTrendEngine.IsBodyBullValid())
      last_candle = StringFormat("BULL | Buy Limit at: %.2f", ExtTrendEngine.GetBodyEntryBull());
   else if(ExtTrendEngine.IsBodyBearValid())
      last_candle = StringFormat("BEAR | Sell Limit at: %.2f", ExtTrendEngine.GetBodyEntryBear());
   else
      last_candle = StringFormat("Body too small (%.0f pts < %.0f min)",
                                 ExtTrendEngine.GetPrevBodyPts(), InpMinBodyPts);

   string cb  = ExtTradeManager.IsCircuitBreakerHit() ? "[PAUSED - MAX LOSSES HIT]" : "OK";
   string be  = InpEnableBreakeven
                ? StringFormat("ON  trigger +%.0f pts, lock +%.0f pts", InpBETriggerPoints, InpBELockPoints)
                : "OFF";

   string hud =
      "===================================================\n"
      "  UmeaFX FX Vol 60  v2.10\n"
      "  Mode 3: Mirror Candle Body | Mode 2: Daily Fade\n"
      "===================================================\n"
      "Daily Open:     " + DoubleToString(daily_open, 2) + "\n" +
      "Current Price:  " + DoubleToString(price, 2) + "\n" +
      "Dist from Open: " + StringFormat("%+.0f pts", dist) + "\n" +
      "Zone:           " + zone_str + "\n" +
      "---------------------------------------------------\n"
      "Last Candle:    " + last_candle + "\n" +
      StringFormat("Mode 3:  Entry %.0f%% | SL %.0f pts | TP %.0f pts\n",
                   InpBodyEntryPct, InpBodySL, InpBodyTP) +
      StringFormat("Mode 2:  Bdry %.0f pts | SL %.0f pts | TP %.0f pts\n",
                   InpFadeBoundary, InpFadeSL, InpFadeTP) +
      "---------------------------------------------------\n"
      "Breakeven:      " + be + "\n" +
      "Circuit Breaker:" + cb + "\n" +
      "Active Trades:  " + IntegerToString(ExtTradeManager.TotalActive()) + "\n" +
      "===================================================";

   Comment(hud);
}

//+------------------------------------------------------------------+
//| Main Tick                                                        |
//+------------------------------------------------------------------+
void OnTick()
{
   UpdateHUD();

   // Real-time breakeven on every tick
   ExtTradeManager.ManageBreakeven();
   ExtTradeManager.CheckDailyReset(TimeCurrent());

   // Only act on a NEW 1H bar close
   datetime h1_time = iTime(_Symbol, PERIOD_H1, 0);
   if(h1_time == ExtLastBarH1)
      return;
   ExtLastBarH1 = h1_time;

   // 1. Cancel unfilled pending orders from the previous bar
   ExtTradeManager.CancelPendingOrders();

   // 2. Load recent H1 rates
   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   if(CopyRates(_Symbol, PERIOD_H1, 0, 10, rates) < 5)
      return;

   // 3. Update engine: daily open + compute body entry from last candle
   double pct = InpBodyEntryPct / 100.0;
   ExtTrendEngine.Update(rates, 10, pct, InpMinBodyPts);

   // 4. Circuit breaker check
   if(ExtTradeManager.IsCircuitBreakerHit())
   {
      Print("Circuit Breaker active. No new orders.");
      return;
   }

   // 5. Already in a trade? Skip — one trade at a time
   if(ExtTradeManager.TotalActive() > 0)
      return;

   ENUM_DAILY_ZONE zone = ExtTrendEngine.GetZone(rates[0].open);

   // ============================================================
   // MODE 2: BOUNDARY FADE — fires when price overextended
   // ============================================================
   if(InpEnableBoundaryFade)
   {
      if(zone == ZONE_CEILING_EXTREME)
      {
         double ep = rates[0].open + 50.0;
         ExtTradeManager.PlaceSellLimit(ep, ep + InpFadeSL, ep - InpFadeTP, "Mode2 Fade Ceiling");
         Print("MODE 2: Ceiling fade SELL at ", ep);
         return;
      }
      if(zone == ZONE_FLOOR_EXTREME)
      {
         double ep = rates[0].open - 50.0;
         ExtTradeManager.PlaceBuyLimit(ep, ep - InpFadeSL, ep + InpFadeTP, "Mode2 Fade Floor");
         Print("MODE 2: Floor fade BUY at ", ep);
         return;
      }
   }

   // ============================================================
   // MODE 3: BODY RETRACEMENT — fires every H1 bar in Zone 1
   // Simply mirrors the last closed candle. No trend filter.
   // ============================================================
   if(InpEnableBodyRetrace && zone == ZONE_EXPANSION_NORMAL)
   {
      if(ExtTrendEngine.IsBodyBullValid())
      {
         // Last candle was BULLISH → expect next to dip into body then push UP
         double ep = ExtTrendEngine.GetBodyEntryBull();
         double sl = ep - InpBodySL;
         double tp = ep + InpBodyTP;
         if(ExtTradeManager.PlaceBuyLimit(ep, sl, tp, "Mode3 Body Buy"))
            Print("MODE 3: BUY limit at ", ep,
                  " (", InpBodyEntryPct, "% into ",
                  DoubleToString(ExtTrendEngine.GetPrevBodyPts(), 0), " pt bull body)");
      }
      else if(ExtTrendEngine.IsBodyBearValid())
      {
         // Last candle was BEARISH → expect next to push into body then drop DOWN
         double ep = ExtTrendEngine.GetBodyEntryBear();
         double sl = ep + InpBodySL;
         double tp = ep - InpBodyTP;
         if(ExtTradeManager.PlaceSellLimit(ep, sl, tp, "Mode3 Body Sell"))
            Print("MODE 3: SELL limit at ", ep,
                  " (", InpBodyEntryPct, "% into ",
                  DoubleToString(ExtTrendEngine.GetPrevBodyPts(), 0), " pt bear body)");
      }
      else
      {
         Print("Mode 3: Last candle body too small (",
               DoubleToString(ExtTrendEngine.GetPrevBodyPts(), 0),
               " pts). Skipping bar.");
      }
   }
}
//+------------------------------------------------------------------+
