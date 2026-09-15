//+------------------------------------------------------------------+
//|                                     UMEA_Synthetic_FXVol60.mq5   |
//|                             UmeaFX FX Vol 60 Synthetic Engine    |
//|                                  Copyright 2026, UmeaFX Project. |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, UmeaFX Project."
#property link      "https://www.umeafx.com"
#property version   "2.20"
#property description "UmeaFX FX Vol 60 | Mode 3: Body Retrace (Market Execution) | Mode 2: Daily Fade"

#include "Defines.mqh"
#include "TrendEngine.mqh"
#include "TradeManager.mqh"

//+------------------------------------------------------------------+
//| Inputs                                                           |
//+------------------------------------------------------------------+
input group "=== General Strategy Controls ==="
input ulong    InpMagicNumber          = 606060;   // Magic Number
input bool     InpUseMarketExecution   = true;     // Execution Mode: True = Market Execution On Hit, False = Limit Order
input bool     InpEnableBodyRetrace    = true;     // Enable Mode 3: Body Retracement (Mirror Candle)
input bool     InpEnableBoundaryFade   = true;     // Enable Mode 2: Daily Boundary Fade

input group "=== Mode 3: Body Retracement (Mirror Last Candle) ==="
input double   InpBodyEntryPct         = 12.0;     // Entry Depth into Previous Body (%) [User: 12%]
input double   InpMinBodyPts           = 100.0;    // Minimum Candle Body to Trade (Points) [Filters doji]
input double   InpBodySL               = 200.0;    // Body Retrace Stop Loss (Points)
input double   InpBodyTP               = 400.0;    // Body Retrace Take Profit (Points)

input group "=== Mode 2: Daily Boundary Fade (Ceiling / Floor) ==="
input double   InpFadeBoundary         = 1000.0;   // Boundary Distance from Daily Open (Points)
input double   InpFadeSL               = 500.0;    // Fade Stop Loss (Points)
input double   InpFadeTP               = 500.0;    // Fade Take Profit (Points)

input group "=== Breakeven Protection ==="
input bool     InpEnableBreakeven      = true;     // Enable Breakeven
input double   InpBETriggerPoints      = 150.0;    // Move SL to BE when Profit >= (Points)
input double   InpBELockPoints         = 20.0;     // Points to Lock at Breakeven

input group "=== Risk & Circuit Breaker ==="
input bool     InpUseFixedLot          = false;    // Use Fixed Lot Size
input double   InpFixedLot             = 0.10;     // Fixed Lot Size
input double   InpRiskPercent          = 1.0;      // Risk Per Trade (% of Balance)
input int      InpMaxDailyLosses       = 3;        // Max Daily Losses Before Pausing

//+------------------------------------------------------------------+
//| Globals                                                          |
//+------------------------------------------------------------------+
CTrendEngine   ExtTrendEngine;
CTradeManager  ExtTradeManager;
datetime       ExtLastBarH1       = 0;
bool           ExtExecutedThisBar = false;
bool           ExtSLOrTPHitThisBar = false;  // Blocks re-entry after SL or TP fires this H1 bar

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
   ExtExecutedThisBar = false;

   Print("UmeaFX FX Vol 60 v2.20 ready | Execution Mode: ", 
         (InpUseMarketExecution ? "MARKET ON HIT" : "LIMIT ORDERS"),
         " | Entry at ", InpBodyEntryPct, "% into body");
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
   double bid        = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double ask        = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double daily_open = ExtTrendEngine.GetDailyOpen();
   double dist_open  = ExtTrendEngine.GetDistanceToOpen(bid);
   ENUM_DAILY_ZONE zone = ExtTrendEngine.GetZone(bid);

   string zone_str = "ZONE 1: NORMAL (Mode 3 Active)";
   if(zone == ZONE_CEILING_EXTREME) zone_str = "ZONE 2: CEILING - Mode 2 Fade SHORT";
   else if(zone == ZONE_FLOOR_EXTREME) zone_str = "ZONE 2: FLOOR - Mode 2 Fade LONG";

   string setup_str = "";
   string dist_exec_str = "";

   if(ExtTrendEngine.IsBodyBullValid())
   {
      double target_p = ExtTrendEngine.GetBodyEntryBull();
      double dist_to_target = bid - target_p;
      
      setup_str = StringFormat("BULL CANDLE (Body: %.0f pts) -> Target BUY: %.2f", 
                               ExtTrendEngine.GetPrevBodyPts(), target_p);

      if(ExtExecutedThisBar)
      {
         dist_exec_str = "Status: [EXECUTED / POSITION ACTIVE THIS BAR]";
      }
      else if(dist_to_target <= 0)
      {
         dist_exec_str = StringFormat("Distance to Execution: AT OR BELOW TARGET (%+.2f pts)", dist_to_target);
      }
      else
      {
         dist_exec_str = StringFormat("Distance to Execution: %.2f pts away (Needs dip of %.2f pts)", 
                                      dist_to_target, dist_to_target);
      }
   }
   else if(ExtTrendEngine.IsBodyBearValid())
   {
      double target_p = ExtTrendEngine.GetBodyEntryBear();
      double dist_to_target = target_p - bid;
      
      setup_str = StringFormat("BEAR CANDLE (Body: %.0f pts) -> Target SELL: %.2f", 
                               ExtTrendEngine.GetPrevBodyPts(), target_p);

      if(ExtExecutedThisBar)
      {
         dist_exec_str = "Status: [EXECUTED / POSITION ACTIVE THIS BAR]";
      }
      else if(dist_to_target <= 0)
      {
         dist_exec_str = StringFormat("Distance to Execution: AT OR ABOVE TARGET (%+.2f pts)", dist_to_target);
      }
      else
      {
         dist_exec_str = StringFormat("Distance to Execution: %.2f pts away (Needs rally of %.2f pts)", 
                                      dist_to_target, dist_to_target);
      }
   }
   else
   {
      setup_str = StringFormat("Body too small (%.0f pts < %.0f min body filter)",
                               ExtTrendEngine.GetPrevBodyPts(), InpMinBodyPts);
      dist_exec_str = "Distance to Execution: N/A (Indecision candle)";
   }

   string exec_mode_str = InpUseMarketExecution ? "MARKET ON HIT" : "LIMIT ORDER";
   string cb  = ExtTradeManager.IsCircuitBreakerHit() ? "[PAUSED - MAX LOSSES HIT]" : "NORMAL";
   string be  = InpEnableBreakeven
                ? StringFormat("ON (At +%.0f pts -> Lock +%.0f pts)", InpBETriggerPoints, InpBELockPoints)
                : "OFF";

   string hud =
      "===================================================\n"
      "  UmeaFX FX Vol 60 Master Engine v2.20             \n"
      "  Mode 3: Body Retrace | Mode 2: Daily Fade        \n"
      "===================================================\n"
      "Execution Method: " + exec_mode_str + "\n" +
      "Daily Open:       " + DoubleToString(daily_open, 2) + "\n" +
      "Current Bid:      " + DoubleToString(bid, 2) + "\n" +
      "Dist from Open:   " + StringFormat("%+.2f pts", dist_open) + "\n" +
      "Market Zone:      " + zone_str + "\n" +
      "---------------------------------------------------\n" +
      "Current Setup:    " + setup_str + "\n" +
      "Execution Target: " + dist_exec_str + "\n" +
      "---------------------------------------------------\n" +
      StringFormat("Mode 3 Config:    Entry %.1f%% | SL %.0f pts | TP %.0f pts\n",
                   InpBodyEntryPct, InpBodySL, InpBodyTP) +
      StringFormat("Mode 2 Config:    Bdry %.0f pts | SL %.0f pts | TP %.0f pts\n",
                   InpFadeBoundary, InpFadeSL, InpFadeTP) +
      "---------------------------------------------------\n" +
      "Breakeven:        " + be + "\n" +
      "Circuit Breaker:  " + cb + "\n" +
      "Active Trades:    " + IntegerToString(ExtTradeManager.TotalActive()) + "\n" +
      "===================================================";

   Comment(hud);
}

//+------------------------------------------------------------------+
//| Main Tick Handler                                                |
//+------------------------------------------------------------------+
void OnTick()
{
   UpdateHUD();

   // 1. Real-time breakeven check on every tick
   ExtTradeManager.ManageBreakeven();
   ExtTradeManager.CheckDailyReset(TimeCurrent());

   // 2. Check for New 1H Bar
   datetime h1_time = iTime(_Symbol, PERIOD_H1, 0);
   bool is_new_bar = (h1_time != ExtLastBarH1);

   if(is_new_bar)
   {
      ExtLastBarH1       = h1_time;
      ExtExecutedThisBar  = false;
      ExtSLOrTPHitThisBar = false;   // New H1 candle — re-entry block lifted

      // Cancel any unfilled pending orders from previous bar
      ExtTradeManager.CancelPendingOrders();

      // Load recent H1 rates
      MqlRates rates[];
      ArraySetAsSeries(rates, true);
      if(CopyRates(_Symbol, PERIOD_H1, 0, 10, rates) >= 5)
      {
         double pct = InpBodyEntryPct / 100.0;
         ExtTrendEngine.Update(rates, 10, pct, InpMinBodyPts);
      }

      // If user is using Limit Orders (not market execution), place them at bar open
      if(!InpUseMarketExecution && !ExtTradeManager.IsCircuitBreakerHit() && ExtTradeManager.TotalActive() == 0)
      {
         double bar_open = iOpen(_Symbol, PERIOD_H1, 0);
         ENUM_DAILY_ZONE z = ExtTrendEngine.GetZone(bar_open);

         if(InpEnableBoundaryFade)
         {
            if(z == ZONE_CEILING_EXTREME)
            {
               double ep = bar_open + 50.0;
               ExtTradeManager.PlaceSellLimit(ep, ep + InpFadeSL, ep - InpFadeTP, "Mode2 Fade Ceiling");
               return;
            }
            if(z == ZONE_FLOOR_EXTREME)
            {
               double ep = bar_open - 50.0;
               ExtTradeManager.PlaceBuyLimit(ep, ep - InpFadeSL, ep + InpFadeTP, "Mode2 Fade Floor");
               return;
            }
         }

         if(InpEnableBodyRetrace && z == ZONE_EXPANSION_NORMAL)
         {
            if(ExtTrendEngine.IsBodyBullValid())
            {
               double ep = ExtTrendEngine.GetBodyEntryBull();
               ExtTradeManager.PlaceBuyLimit(ep, ep - InpBodySL, ep + InpBodyTP, "Mode3 Body Buy");
            }
            else if(ExtTrendEngine.IsBodyBearValid())
            {
               double ep = ExtTrendEngine.GetBodyEntryBear();
               ExtTradeManager.PlaceSellLimit(ep, ep + InpBodySL, ep - InpBodyTP, "Mode3 Body Sell");
            }
         }
      }
   }

   // 3. MARKET EXECUTION ON HIT (Monitors tick-by-tick)
   if(!InpUseMarketExecution)
      return;

   // Block if: circuit breaker, already in a trade, already executed this bar, or SL/TP fired this bar
   if(ExtTradeManager.IsCircuitBreakerHit())
      return;
   if(ExtTradeManager.TotalActive() > 0 || ExtExecutedThisBar || ExtSLOrTPHitThisBar)
      return;

   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   ENUM_DAILY_ZONE current_zone = ExtTrendEngine.GetZone(bid);

   // ============================================================
   // MODE 2: BOUNDARY FADE (Market Execution)
   // ============================================================
   if(InpEnableBoundaryFade)
   {
      if(current_zone == ZONE_CEILING_EXTREME)
      {
         double sl = bid + InpFadeSL;
         double tp = bid - InpFadeTP;
         if(ExtTradeManager.SellMarket(sl, tp, "Mode2 Fade Ceiling Market"))
         {
            ExtExecutedThisBar = true;
            Print("MODE 2: CEILING FADE MARKET SELL executed at Bid: ", bid, " SL: ", sl, " TP: ", tp);
            return;
         }
      }
      else if(current_zone == ZONE_FLOOR_EXTREME)
      {
         double sl = ask - InpFadeSL;
         double tp = ask + InpFadeTP;
         if(ExtTradeManager.BuyMarket(sl, tp, "Mode2 Fade Floor Market"))
         {
            ExtExecutedThisBar = true;
            Print("MODE 2: FLOOR FADE MARKET BUY executed at Ask: ", ask, " SL: ", sl, " TP: ", tp);
            return;
         }
      }
   }

   // ============================================================
   // MODE 3: BODY RETRACEMENT (Market Execution On Hit)
   // ============================================================
   if(InpEnableBodyRetrace && current_zone == ZONE_EXPANSION_NORMAL)
   {
      if(ExtTrendEngine.IsBodyBullValid())
      {
         double target_price = ExtTrendEngine.GetBodyEntryBull();
         // The moment price retraces down to or below the target entry price:
         if(bid <= target_price)
         {
            double sl = ask - InpBodySL;
            double tp = ask + InpBodyTP;
            if(ExtTradeManager.BuyMarket(sl, tp, "Mode3 Body Buy Market"))
            {
               ExtExecutedThisBar = true;
               Print("MODE 3: RETRACEMENT HIT -> MARKET BUY executed at Ask: ", ask, 
                     " (Target was: ", target_price, ") | SL: ", sl, " TP: ", tp);
            }
         }
      }
      else if(ExtTrendEngine.IsBodyBearValid())
      {
         double target_price = ExtTrendEngine.GetBodyEntryBear();
         // The moment price retraces up to or above the target entry price:
         if(bid >= target_price)
         {
            double sl = bid + InpBodySL;
            double tp = bid - InpBodyTP;
            if(ExtTradeManager.SellMarket(sl, tp, "Mode3 Body Sell Market"))
            {
               ExtExecutedThisBar = true;
               Print("MODE 3: RETRACEMENT HIT -> MARKET SELL executed at Bid: ", bid, 
                     " (Target was: ", target_price, ") | SL: ", sl, " TP: ", tp);
            }
         }
      }
   }
}

//+------------------------------------------------------------------+
//| Trade Transaction Handler — detects SL/TP closes                |
//+------------------------------------------------------------------+
void OnTradeTransaction(const MqlTradeTransaction &trans,
                        const MqlTradeRequest     &request,
                        const MqlTradeResult      &result)
{
   // We only care about deal-add events (a trade actually executed)
   if(trans.type != TRADE_TRANSACTION_DEAL_ADD)
      return;
   if(trans.symbol != _Symbol)
      return;

   // Select the deal from history to inspect it
   if(!HistoryDealSelect(trans.deal))
      return;

   long magic = HistoryDealGetInteger(trans.deal, DEAL_MAGIC);
   if(magic != (long)InpMagicNumber)
      return;

   ENUM_DEAL_ENTRY entry_type = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(trans.deal, DEAL_ENTRY);
   if(entry_type != DEAL_ENTRY_OUT)   // Only closing deals
      return;

   ENUM_DEAL_REASON reason = (ENUM_DEAL_REASON)HistoryDealGetInteger(trans.deal, DEAL_REASON);

   if(reason == DEAL_REASON_SL)
   {
      ExtSLOrTPHitThisBar = true;
      ExtTradeManager.RegisterLoss();   // Fix: circuit breaker now actually counts losses
      Print(">> SL triggered. Re-entry BLOCKED for remainder of this H1 candle. Daily losses: ",
            ExtTradeManager.IsCircuitBreakerHit() ? "CIRCUIT BREAKER HIT" : "within limit");
   }
   else if(reason == DEAL_REASON_TP)
   {
      ExtSLOrTPHitThisBar = true;
      Print(">> TP triggered. Re-entry BLOCKED for remainder of this H1 candle.");
   }
}
//+------------------------------------------------------------------+
