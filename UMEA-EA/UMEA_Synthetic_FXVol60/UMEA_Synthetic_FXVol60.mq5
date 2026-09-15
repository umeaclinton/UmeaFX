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

input group "=== HUD Panel Appearance ==="
input bool     InpShowHUD              = true;               // Show Dashboard Panel
input color    InpHUDPanelBg           = clrBlack;           // Panel Background Color (Solid Pitch Black)
input color    InpHUDBorder            = C'80,80,80';        // Panel Border Color (Subtle Gray Outline)
input int      InpHUDXOffset           = 15;                 // Panel X Distance from Left
input int      InpHUDYOffset           = 25;                 // Panel Y Distance from Top

#define HUD_PREFIX "UMEA_HUD_"

//+------------------------------------------------------------------+
//| HUD Object Helper Functions                                      |
//+------------------------------------------------------------------+
void SetHUDLabel(string name, string text, int x, int y, color clr = clrWhite, int font_size = 9)
{
   string obj_name = HUD_PREFIX + name;
   if(ObjectFind(0, obj_name) < 0)
   {
      ObjectCreate(0, obj_name, OBJ_LABEL, 0, 0, 0);
      ObjectSetInteger(0, obj_name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(0, obj_name, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(0, obj_name, OBJPROP_SELECTED, false);
      ObjectSetInteger(0, obj_name, OBJPROP_HIDDEN, true);
   }
   ObjectSetInteger(0, obj_name, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(0, obj_name, OBJPROP_YDISTANCE, y);
   ObjectSetString(0, obj_name, OBJPROP_TEXT, text);
   ObjectSetString(0, obj_name, OBJPROP_FONT, "Consolas");
   ObjectSetInteger(0, obj_name, OBJPROP_FONTSIZE, font_size);
   ObjectSetInteger(0, obj_name, OBJPROP_COLOR, clrWhite); // Always pure white text
}

void SetHUDPanel(string name, int x, int y, int w, int h, color bg_color, color border_color)
{
   string obj_name = HUD_PREFIX + name;
   if(ObjectFind(0, obj_name) < 0)
   {
      ObjectCreate(0, obj_name, OBJ_RECTANGLE_LABEL, 0, 0, 0);
      ObjectSetInteger(0, obj_name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(0, obj_name, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(0, obj_name, OBJPROP_SELECTED, false);
      ObjectSetInteger(0, obj_name, OBJPROP_HIDDEN, true);
      ObjectSetInteger(0, obj_name, OBJPROP_BACK, false); // In front of chart candles
   }
   ObjectSetInteger(0, obj_name, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(0, obj_name, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(0, obj_name, OBJPROP_XSIZE, w);
   ObjectSetInteger(0, obj_name, OBJPROP_YSIZE, h);
   ObjectSetInteger(0, obj_name, OBJPROP_BGCOLOR, bg_color);
   ObjectSetInteger(0, obj_name, OBJPROP_BORDER_COLOR, border_color);
   ObjectSetInteger(0, obj_name, OBJPROP_BORDER_TYPE, BORDER_FLAT);
}

void RemoveHUD()
{
   ObjectsDeleteAll(0, HUD_PREFIX);
   ChartSetString(0, CHART_COMMENT, "");
   Comment("");
}

//+------------------------------------------------------------------+
//| Globals                                                          |
//+------------------------------------------------------------------+
CTrendEngine   ExtTrendEngine;
CTradeManager  ExtTradeManager;
datetime       ExtLastBarH1        = 0;
bool           ExtExecutedThisBar  = false;
datetime       ExtLockedH1Bar      = 0;  // Holds the exact H1 bar open time that is LOCKED

//+------------------------------------------------------------------+
//| Check if Current H1 Candle is Locked                             |
//| (Trade closed on SL, BE, or TP in this current H1 candle)         |
//+------------------------------------------------------------------+
bool IsCurrentH1Locked(int &out_seconds_left)
{
   datetime current_h1 = iTime(_Symbol, PERIOD_H1, 0);
   if(current_h1 <= 0)
   {
      out_seconds_left = 0;
      return false;
   }

   datetime now = TimeCurrent();
   datetime h1_end = current_h1 + 3600;
   out_seconds_left = (int)(h1_end - now);
   if(out_seconds_left < 0)
      out_seconds_left = 0;

   // 1. Check in-memory lock
   if(ExtLockedH1Bar == current_h1)
      return true;

   // 2. Fail-safe: Check MT5 account history for this exact H1 bar
   if(HistorySelect(current_h1, now))
   {
      int total_deals = HistoryDealsTotal();
      for(int i = total_deals - 1; i >= 0; i--)
      {
         ulong deal_ticket = HistoryDealGetTicket(i);
         if(deal_ticket > 0)
         {
            long magic = HistoryDealGetInteger(deal_ticket, DEAL_MAGIC);
            string sym = HistoryDealGetString(deal_ticket, DEAL_SYMBOL);
            ENUM_DEAL_ENTRY entry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(deal_ticket, DEAL_ENTRY);

            if(magic == (long)InpMagicNumber && sym == _Symbol && entry == DEAL_ENTRY_OUT)
            {
               ExtLockedH1Bar = current_h1;  // Lock established from history
               return true;
            }
         }
      }
   }

   return false;
}

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
   ExtLastBarH1       = 0;
   ExtExecutedThisBar = false;
   ExtLockedH1Bar     = 0;

   // Check immediately on startup if current H1 already had a closed trade
   int sec_init = 0;
   if(IsCurrentH1Locked(sec_init))
   {
      PrintFormat(">> ⚠️ EA started while current H1 candle is LOCKED! Countdown remaining: %02d:%02d",
                  sec_init / 60, sec_init % 60);
   }

   Print("UmeaFX FX Vol 60 v2.20 ready | Execution Mode: ", 
         (InpUseMarketExecution ? "MARKET ON HIT" : "LIMIT ORDERS"),
         " | Entry at ", InpBodyEntryPct, "% into body");
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   RemoveHUD();
}

//+------------------------------------------------------------------+
//| HUD Render Function with Solid Background Panel                 |
//+------------------------------------------------------------------+
void UpdateHUD(bool is_locked, int seconds_left)
{
   if(!InpShowHUD)
   {
      RemoveHUD();
      return;
   }

   double bid        = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double ask        = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double daily_open = ExtTrendEngine.GetDailyOpen();
   double dist_open  = ExtTrendEngine.GetDistanceToOpen(bid);
   ENUM_DAILY_ZONE zone = ExtTrendEngine.GetZone(bid);

   string zone_str = "ZONE 1: NORMAL (Mode 3 Active)";
   color  zone_clr = C'34,197,94'; // Emerald green
   if(zone == ZONE_CEILING_EXTREME)
   {
      zone_str = "ZONE 2: CEILING (Mode 2 Fade SHORT)";
      zone_clr = C'239,68,68'; // Red
   }
   else if(zone == ZONE_FLOOR_EXTREME)
   {
      zone_str = "ZONE 2: FLOOR (Mode 2 Fade LONG)";
      zone_clr = C'59,130,246'; // Blue
   }

   string setup_str = "";
   string dist_exec_str = "";
   color  setup_clr = C'226,232,240'; // Soft white

   if(is_locked)
   {
      int mm = seconds_left / 60;
      int ss = seconds_left % 60;
      setup_str     = "🔒 LOCKED: Trade closed this hour (SL/BE/TP).";
      dist_exec_str = StringFormat("⏳ NEXT CANDLE COUNTDOWN: %02d:%02d (DO NOT TRADE)", mm, ss);
      setup_clr     = C'248,113,113'; // Vibrant light red
   }
   else if(ExtTrendEngine.IsBodyBullValid())
   {
      double target_p = ExtTrendEngine.GetBodyEntryBull();
      double dist_to_target = bid - target_p;
      
      setup_str = StringFormat("BULL CANDLE (Body: %.0f pts) -> Target BUY: %.2f", 
                               ExtTrendEngine.GetPrevBodyPts(), target_p);

      if(ExtExecutedThisBar)
      {
         dist_exec_str = "Status: [EXECUTED / POSITION ACTIVE THIS BAR]";
         setup_clr     = C'250,204,21'; // Yellow
      }
      else if(dist_to_target <= 0)
      {
         dist_exec_str = StringFormat("Distance to Execution: AT OR BELOW TARGET (%+.2f pts)", dist_to_target);
         setup_clr     = C'74,222,128'; // Lime green
      }
      else
      {
         dist_exec_str = StringFormat("Distance to Execution: %.2f pts away (Needs dip of %.2f pts)", 
                                      dist_to_target, dist_to_target);
         setup_clr     = C'56,189,248'; // Sky blue
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
         setup_clr     = C'250,204,21'; // Yellow
      }
      else if(dist_to_target <= 0)
      {
         dist_exec_str = StringFormat("Distance to Execution: AT OR ABOVE TARGET (%+.2f pts)", dist_to_target);
         setup_clr     = C'248,113,113'; // Light red
      }
      else
      {
         dist_exec_str = StringFormat("Distance to Execution: %.2f pts away (Needs rally of %.2f pts)", 
                                      dist_to_target, dist_to_target);
         setup_clr     = C'251,146,60'; // Light orange
      }
   }
   else
   {
      setup_str     = StringFormat("Body too small (%.0f pts < %.0f min body filter)",
                                   ExtTrendEngine.GetPrevBodyPts(), InpMinBodyPts);
      dist_exec_str = "Distance to Execution: N/A (Indecision candle)";
      setup_clr     = C'148,163,184'; // Muted slate
   }

   string exec_mode_str = InpUseMarketExecution ? "MARKET ON HIT" : "LIMIT ORDER";
   string cb  = ExtTradeManager.IsCircuitBreakerHit() ? "PAUSED (MAX LOSSES)" : "NORMAL (ACTIVE)";
   color  cb_clr = ExtTradeManager.IsCircuitBreakerHit() ? C'239,68,68' : C'34,197,94';
   string be  = InpEnableBreakeven
                ? StringFormat("ON (+%.0f pts -> Lock +%.0f pts)", InpBETriggerPoints, InpBELockPoints)
                : "OFF";

   int px = InpHUDXOffset;
   int py = InpHUDYOffset;
   int pw = 620;
   int ph = is_locked ? 490 : 460;

   // 1. Solid Background Panel (Pitch Black with clean outline)
   SetHUDPanel("BG", px, py, pw, ph, InpHUDPanelBg, InpHUDBorder);

   // 2. Panel Content (Row by Row, generous 22px spacing)
   int y = py + 12;
   int x = px + 14;
   int line_h = 22;

   // Title & Subtitle
   SetHUDLabel("Title",    "UMEA FX Vol 60 Master Engine v2.20", x, y, clrWhite, 10);
   y += line_h;
   SetHUDLabel("SubTitle", "Mode 3: Body Retrace  |  Mode 2: Daily Fade", x, y, clrWhite, 8);
   y += line_h + 2;

   // Lock Banner if active
   if(is_locked)
   {
      int mm = seconds_left / 60;
      int ss = seconds_left % 60;
      string lock_txt = StringFormat(">>> 🔒 HOUR LOCKED | RESUMING IN: %02d:%02d <<<", mm, ss);
      SetHUDLabel("LockBanner", lock_txt, x, y, clrWhite, 9);
      y += line_h;
   }
   else
   {
      // Clean up banner if unlocked
      ObjectDelete(0, HUD_PREFIX + "LockBanner");
   }

   // Divider
   SetHUDLabel("Div1", "--------------------------------------------------------------------------------", x, y, clrWhite, 8);
   y += line_h - 4;

   // Core Market Info
   SetHUDLabel("ExecMethod", StringFormat("Execution Method:   %s", exec_mode_str), x, y, clrWhite, 8);
   y += line_h;
   SetHUDLabel("DailyOpen",   StringFormat("Daily Open:         %.2f    |  Current Bid: %.2f", daily_open, bid), x, y, clrWhite, 8);
   y += line_h;
   SetHUDLabel("DistOpen",    StringFormat("Dist from Open:     %+.2f pts", dist_open), x, y, clrWhite, 8);
   y += line_h;
   SetHUDLabel("MarketZone",  StringFormat("Market Zone:        %s", zone_str), x, y, clrWhite, 8);
   y += line_h + 2;

   // Divider
   SetHUDLabel("Div2", "--------------------------------------------------------------------------------", x, y, clrWhite, 8);
   y += line_h - 4;

   // Setup & Distance
   SetHUDLabel("Setup",    StringFormat("Setup:              %s", setup_str), x, y, clrWhite, 8);
   y += line_h;
   SetHUDLabel("Target",   StringFormat("Target:             %s", dist_exec_str), x, y, clrWhite, 8);
   y += line_h + 2;

   // Divider
   SetHUDLabel("Div3", "--------------------------------------------------------------------------------", x, y, clrWhite, 8);
   y += line_h - 4;

   // Configuration & Status
   SetHUDLabel("Mode3Cfg", StringFormat("Mode 3 Config:      Entry %.1f%% | SL %.0f pts | TP %.0f pts", InpBodyEntryPct, InpBodySL, InpBodyTP), x, y, clrWhite, 8);
   y += line_h;
   SetHUDLabel("Mode2Cfg", StringFormat("Mode 2 Config:      Bdry %.0f pts | SL %.0f pts | TP %.0f pts", InpFadeBoundary, InpFadeSL, InpFadeTP), x, y, clrWhite, 8);
   y += line_h;
   SetHUDLabel("BEStatus", StringFormat("Breakeven:          %s", be), x, y, clrWhite, 8);
   y += line_h;
   SetHUDLabel("CBStatus", StringFormat("Circuit Breaker:    %s", cb), x, y, clrWhite, 8);
   y += line_h;
   SetHUDLabel("Trades",   StringFormat("Active Trades:      %d", ExtTradeManager.TotalActive()), x, y, clrWhite, 8);

   // Force clear MT5 chart comment so nothing bleeds through
   ChartSetString(0, CHART_COMMENT, "");
   Comment("");
}

//+------------------------------------------------------------------+
//| Main Tick Handler                                                |
//+------------------------------------------------------------------+
void OnTick()
{
   // 1. Check if Current H1 Candle is locked (SL, BE, or TP closed this hour)
   int seconds_left = 0;
   bool is_locked = IsCurrentH1Locked(seconds_left);

   // Update HUD on every single tick
   UpdateHUD(is_locked, seconds_left);

   // Real-time breakeven check on every tick (for already open positions)
   ExtTradeManager.ManageBreakeven();
   ExtTradeManager.CheckDailyReset(TimeCurrent());

   // 2. Check for New 1H Bar
   datetime h1_time = iTime(_Symbol, PERIOD_H1, 0);
   bool is_new_bar = (h1_time != ExtLastBarH1);

   if(is_new_bar)
   {
      ExtLastBarH1       = h1_time;
      ExtExecutedThisBar = false;

      // Re-evaluate lock on new bar
      is_locked = IsCurrentH1Locked(seconds_left);

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
      if(!is_locked && !InpUseMarketExecution && !ExtTradeManager.IsCircuitBreakerHit() && ExtTradeManager.TotalActive() == 0)
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

   // 🛑 ABSOLUTE RE-ENTRY GUARD: If current H1 candle is locked, CANCEL PENDINGS & RETURN IMMEDIATELY!
   if(is_locked)
   {
      ExtTradeManager.CancelPendingOrders();
      return;
   }

   // 3. MARKET EXECUTION ON HIT (Monitors tick-by-tick)
   if(!InpUseMarketExecution)
      return;

   // Circuit breaker or trade already active / executed this bar -> Skip
   if(ExtTradeManager.IsCircuitBreakerHit())
      return;
   if(ExtTradeManager.TotalActive() > 0 || ExtExecutedThisBar)
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
//| Trade Transaction Handler — detects SL/BE/TP position closes    |
//+------------------------------------------------------------------+
void OnTradeTransaction(const MqlTradeTransaction &trans,
                        const MqlTradeRequest     &request,
                        const MqlTradeResult      &result)
{
   // We only care about deal-add events (a trade deal actually executed)
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
   if(entry_type != DEAL_ENTRY_OUT)   // Only closing deals (SL, BE, TP, manual, etc.)
      return;

   // ANY closing deal in this H1 candle triggers the lock!
   datetime current_h1 = iTime(_Symbol, PERIOD_H1, 0);
   ExtLockedH1Bar = current_h1;

   // Cancel any pending limit orders immediately
   ExtTradeManager.CancelPendingOrders();

   double profit = HistoryDealGetDouble(trans.deal, DEAL_PROFIT);
   if(profit < 0.0)
   {
      ExtTradeManager.RegisterLoss();
   }

   int seconds_left = (int)(current_h1 + 3600 - TimeCurrent());
   if(seconds_left < 0) seconds_left = 0;
   int mm = seconds_left / 60;
   int ss = seconds_left % 60;

   ENUM_DEAL_REASON reason = (ENUM_DEAL_REASON)HistoryDealGetInteger(trans.deal, DEAL_REASON);
   string reason_str = "CLOSED";
   if(reason == DEAL_REASON_SL) reason_str = "STOP LOSS";
   else if(reason == DEAL_REASON_TP) reason_str = "TAKE PROFIT";
   else if(profit > 0) reason_str = "BREAKEVEN/PROFIT";
   else reason_str = "LOSS";

   PrintFormat(">> 🛑 [H1 LOCK ENGAGED] Position closed via %s (Profit: %.2f). Next candle countdown: %02d:%02d",
               reason_str, profit, mm, ss);
}
//+------------------------------------------------------------------+

