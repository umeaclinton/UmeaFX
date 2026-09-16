//+------------------------------------------------------------------+
//|                                     UMEA_RangeBreak_Sniper.mq5   |
//|                         UMEA Range Break 100 Sniper Engine       |
//|                                  Copyright 2026, UmeaFX Project. |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, UmeaFX Project."
#property link      "https://www.umeafx.com"
#property version   "1.20"
#property description "UMEA Range Break 100 Sniper | Boundary Proximity First-Entry & Dual-Timer Retest Engine"

#include "SniperTrade.mqh"
#include "SpikeDetector.mqh"

enum ENUM_TRADE_TYPE
{
   TRADE_NONE = 0,
   TRADE_INITIAL_FADE,
   TRADE_RETEST
};

//+------------------------------------------------------------------+
//| Inputs                                                           |
//+------------------------------------------------------------------+
input group "=== Sniper Spike Detection Settings ==="
input double   InpSpikeThreshold       = 75.0;     // Minimum 1-Minute Candle Body to Qualify as Spike (Points)

input group "=== Scalp Exit & Timer Settings ==="
input double   InpTakeProfitPts        = 20.0;     // Sniper Take Profit (Points) [Default: 20 pts]
input double   InpEntryBufferPts       = 2.0;      // Proximity Distance to Ceiling/Floor for Trade #1 (Points)
input int      InpEntryWindowMins      = 12;       // Max Minutes After Spike Allowed to Enter Trade #1 (Default: 12 mins)
input bool     InpEnableRetestTrades   = true;     // Enable Trade #2 on Ceiling/Floor Retest
input int      InpRetestWindowMins     = 9;        // Max Minutes After Spike Allowed to Enter Trade #2 (Default: 9 mins)
input int      InpHardTimeoutMins      = 14;       // Hard Expiration to Force-Close Trade #2 (Default: 14 mins from spike)
input double   InpRetestBufferPts      = 2.0;      // Touch Buffer from Ceiling/Floor for Trade #2 (Points)

input group "=== Trade Management & Risk ==="
input ulong    InpMagicNumber          = 707070;   // Magic Number
input bool     InpUseFixedLot          = true;     // Use Fixed Lot Size
input double   InpFixedLot             = 0.05;     // Fixed Lot Size (Deriv min 0.01)
input double   InpRiskPercent          = 1.0;      // Risk Percent (If not using fixed lot)

input group "=== HUD Appearance ==="
input bool     InpShowHUD              = true;     // Show Dashboard Panel
input color    InpHUDPanelBg           = clrBlack; // Panel Background (Solid Pitch Black)
input color    InpHUDBorder            = C'80,80,80'; // Panel Border Color
input int      InpHUDXOffset           = 15;       // Panel X Distance from Left
input int      InpHUDYOffset           = 25;       // Panel Y Distance from Top

#define HUD_PREFIX "UMEA_RB_"

//+------------------------------------------------------------------+
//| Globals                                                          |
//+------------------------------------------------------------------+
CSniperTrade     ExtTrade;
CSpikeDetector   ExtDetector;

ENUM_TRADE_TYPE  ExtCurrentTradeType = TRADE_NONE;
int              ExtTotalSnipes      = 0;
datetime         ExtLastTradeTime    = 0;

//+------------------------------------------------------------------+
//| HUD Helpers                                                      |
//+------------------------------------------------------------------+
void SetHUDLabel(string name, string text, int x, int y, int font_size = 9)
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
   ObjectSetInteger(0, obj_name, OBJPROP_COLOR, clrWhite);
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
      ObjectSetInteger(0, obj_name, OBJPROP_BACK, false);
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

void UpdateHUD()
{
   if(!InpShowHUD)
   {
      RemoveHUD();
      return;
   }

   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double spread = (ask - bid);

   int px = InpHUDXOffset;
   int py = InpHUDYOffset;
   int pw = 650;
   int ph = 460;

   SetHUDPanel("BG", px, py, pw, ph, InpHUDPanelBg, InpHUDBorder);

   int y = py + 12;
   int x = px + 14;
   int line_h = 22;

   string status_str = "MONITORING (Waiting for M1 spike completion)";
   int active_pos = ExtTrade.TotalActive();
   if(active_pos > 0)
   {
      if(ExtCurrentTradeType == TRADE_INITIAL_FADE)
         status_str = "🎯 IN TRADE #1: Hunting +20 pt TP";
      else if(ExtCurrentTradeType == TRADE_RETEST)
         status_str = "🎯 IN TRADE #2: Boundary Retest (Hunting +20 pt TP)";
   }
   else if(ExtDetector.IsEntry1Armed())
   {
      if(ExtDetector.GetSpikeDirection() == 1)
      {
         double dist = ExtDetector.GetRangeCeiling() - bid;
         status_str = StringFormat("🔫 HUNTING ENTRY #1: Waiting for Bid >= %.1f (Currently: %.1f, %.1f pts away)",
                                   ExtDetector.GetRangeCeiling() - InpEntryBufferPts, bid, dist);
      }
      else if(ExtDetector.GetSpikeDirection() == -1)
      {
         double dist = ask - ExtDetector.GetRangeFloor();
         status_str = StringFormat("🔫 HUNTING ENTRY #1: Waiting for Ask <= %.1f (Currently: %.1f, %.1f pts away)",
                                   ExtDetector.GetRangeFloor() + InpEntryBufferPts, ask, dist);
      }
   }

   // 12-minute entry #1 status
   int entry1_sec = ExtDetector.GetRemainingEntry1Seconds();
   string entry1_str = "STANDBY (Waiting for Spike)";
   if(ExtDetector.GetLastSpikeTime() > 0)
   {
      if(ExtDetector.IsEntry1Taken())
      {
         entry1_str = "EXECUTED (Trade #1 Triggered)";
      }
      else if(entry1_sec > 0)
      {
         int mm = entry1_sec / 60;
         int ss = entry1_sec % 60;
         entry1_str = StringFormat("ARMED: %02d:%02d left to reach within %.1f pts", mm, ss, InpEntryBufferPts);
      }
      else
      {
         entry1_str = "EXPIRED (Price did not revisit boundary within 12m)";
      }
   }

   // 9-minute retest status
   int retest_sec = ExtDetector.GetRemainingRetestSeconds();
   string retest_str = "STANDBY";
   if(ExtDetector.GetLastSpikeTime() > 0)
   {
      if(!ExtDetector.IsEntry1Taken())
      {
         retest_str = "WAITING FOR TRADE #1 FIRST";
      }
      else if(retest_sec > 0)
      {
         int mm = retest_sec / 60;
         int ss = retest_sec % 60;
         if(!ExtDetector.IsRetestTaken())
            retest_str = StringFormat("ARMED: %02d:%02d left for Retest #2", mm, ss);
         else
            retest_str = StringFormat("TRADE #2 TAKEN (Window: %02d:%02d left)", mm, ss);
      }
      else
      {
         retest_str = "CLOSED / EXPIRED (Waiting for next spike)";
      }
   }

   // 14-minute timeout status
   int timeout_sec = ExtDetector.GetRemainingTimeoutSeconds();
   string timeout_str = "NONE";
   if(ExtDetector.GetLastSpikeTime() > 0)
   {
      if(timeout_sec > 0)
      {
         int mm = timeout_sec / 60;
         int ss = timeout_sec % 60;
         timeout_str = StringFormat("%02d:%02d until 14m hard force-exit", mm, ss);
      }
      else
      {
         timeout_str = "EXPIRED (Past 14 minutes)";
      }
   }

   SetHUDLabel("Title",    "UMEA Range Break 100 Sniper Engine v1.20", x, y, 10);
   y += line_h;
   SetHUDLabel("SubTitle", "Strategy: 2.0 pt Proximity First-Entry & Dual-Timer Boundary Retest", x, y, 8);
   y += line_h + 2;

   SetHUDLabel("Div1", "--------------------------------------------------------------------------------", x, y, 8);
   y += line_h - 4;

   SetHUDLabel("Status",       StringFormat("Status:           %s", status_str), x, y, 8);
   y += line_h;
   SetHUDLabel("Entry1Timer",  StringFormat("12m Entry Window: %s", entry1_str), x, y, 8);
   y += line_h;
   SetHUDLabel("RetestTimer",  StringFormat("9m Retest Window: %s", retest_str), x, y, 8);
   y += line_h;
   SetHUDLabel("TimeoutTimer", StringFormat("14m Hard Cutoff:  %s", timeout_str), x, y, 8);
   y += line_h;
   SetHUDLabel("MarketPrices", StringFormat("Bid: %.1f | Ask: %.1f | Live Spread: %.1f pts", bid, ask, spread), x, y, 8);
   y += line_h + 2;

   SetHUDLabel("Div2", "--------------------------------------------------------------------------------", x, y, 8);
   y += line_h - 4;

   SetHUDLabel("LastSpike",   StringFormat("Last Spike:       %s (Body: %.1f pts)", ExtDetector.GetLastSpikeType(), ExtDetector.GetLastSpikeSize()), x, y, 8);
   y += line_h;
   SetHUDLabel("Boundaries",  StringFormat("Active Boundary:  Ceiling: %.1f  |  Floor: %.1f", ExtDetector.GetRangeCeiling(), ExtDetector.GetRangeFloor()), x, y, 8);
   y += line_h;
   SetHUDLabel("Config",      StringFormat("Sniper Config:    Buffer: %.1f pts | 12m Entry | 9m Retest | TP: +%.0f pts", InpEntryBufferPts, InpTakeProfitPts), x, y, 8);
   y += line_h + 2;

   SetHUDLabel("Div3", "--------------------------------------------------------------------------------", x, y, 8);
   y += line_h - 4;

   SetHUDLabel("Stats",       StringFormat("Active Trades:    %d   |  Total Snipes Taken: %d", active_pos, ExtTotalSnipes), x, y, 8);

   ChartSetString(0, CHART_COMMENT, "");
   Comment("");
}

//+------------------------------------------------------------------+
//| Expert initialization                                            |
//+------------------------------------------------------------------+
int OnInit()
{
   ExtTrade.Init(_Symbol, InpMagicNumber, InpUseFixedLot, InpFixedLot, InpRiskPercent);
   ExtDetector.Init(_Symbol, InpSpikeThreshold, InpEntryWindowMins, InpRetestWindowMins, InpHardTimeoutMins);

   ExtCurrentTradeType = TRADE_NONE;
   ExtTotalSnipes      = 0;
   ExtLastTradeTime    = 0;

   Print("UMEA Range Break 100 Sniper Engine v1.20 initialized!");
   Print("Spike Trigger: ", InpSpikeThreshold, " pts | First Entry: Within ", InpEntryBufferPts, " pts of Boundary (12m Window)");
   Print("TP: +", InpTakeProfitPts, " pts | Retest Window: ", InpRetestWindowMins, 
         " mins | Hard Cutoff: ", InpHardTimeoutMins, " mins from spike");

   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   RemoveHUD();
}

//+------------------------------------------------------------------+
//| Main Tick Handler                                                |
//+------------------------------------------------------------------+
void OnTick()
{
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);

   UpdateHUD();

   // 1. Tick-by-tick real-time quick close monitor (closes the instant +20 pts TP reached)
   ExtTrade.CheckQuickClose(InpTakeProfitPts);

   int active_pos = ExtTrade.TotalActive();
   if(active_pos == 0)
   {
      ExtCurrentTradeType = TRADE_NONE;
   }

   // 2. HARD TIMEOUT ENFORCEMENT: Force-close Trade #2 if 14 minutes have elapsed from the spike!
   if(active_pos > 0 && ExtCurrentTradeType == TRADE_RETEST)
   {
      if(ExtDetector.IsHardTimeoutReached())
      {
         Print(">> 🛑 [14-MIN HARD TIMEOUT REACHED] Closing Trade #2 at market price!");
         ExtTrade.ForceCloseAll("14-min Hard Timeout reached from Spike");
         ExtCurrentTradeType = TRADE_NONE;
         return;
      }
   }

   // 3. Update tick-level pullback tracking (arms Trade #2 once price retreats from boundary after Trade #1)
   ExtDetector.UpdateTickPullback(bid, ask);

   // 4. CHECK FOR COMPLETED SPIKE ON NEW 1-MINUTE BAR OPEN
   // Detects completed spike candle, marks Ceiling/Floor, and ARMS Trade #1 for proximity hunting!
   ExtDetector.CheckNewBarSpike();

   // 5. FIRST ENTRY SNIPER (TRADE #1):
   // Wait and watch subsequent candles within the 12-minute window.
   // Triggers the instant price returns within InpEntryBufferPts (2.0 pts) of Ceiling/Floor!
   if(active_pos == 0 && ExtDetector.IsEntry1Armed())
   {
      int entry_signal = ExtDetector.CheckFirstEntry(bid, ask, InpEntryBufferPts);

      // Buy Spike Case: Price pushed back up into the ceiling zone -> Fire SELL!
      if(entry_signal == 1)
      {
         if(ExtTrade.SellAtPeak(InpTakeProfitPts, "RB100-CeilingSniperSell"))
         {
            ExtTotalSnipes++;
            ExtCurrentTradeType = TRADE_INITIAL_FADE;
            ExtLastTradeTime = TimeCurrent();
            PrintFormat(">> 🚀 [TRADE #1 EXECUTED] SELL fired within %.1f pts of Ceiling! Bid: %.1f (Ceiling: %.1f) | TP: +%.1f pts.",
                        InpEntryBufferPts, bid, ExtDetector.GetRangeCeiling(), InpTakeProfitPts);
         }
         return;
      }
      // Sell Spike Case: Price pushed back down into the floor zone -> Fire BUY!
      else if(entry_signal == -1)
      {
         if(ExtTrade.BuyAtBottom(InpTakeProfitPts, "RB100-FloorSniperBuy"))
         {
            ExtTotalSnipes++;
            ExtCurrentTradeType = TRADE_INITIAL_FADE;
            ExtLastTradeTime = TimeCurrent();
            PrintFormat(">> 🚀 [TRADE #1 EXECUTED] BUY fired within %.1f pts of Floor! Ask: %.1f (Floor: %.1f) | TP: +%.1f pts.",
                        InpEntryBufferPts, ask, ExtDetector.GetRangeFloor(), InpTakeProfitPts);
         }
         return;
      }
   }

   // 6. SECONDARY RE-TEST TRADE (TRADE #2): ONLY within 9 minutes of the spike after Trade #1!
   if(InpEnableRetestTrades && active_pos == 0 && ExtDetector.IsEntry1Taken() && ExtDetector.IsRetestWindowActive() && (TimeCurrent() - ExtLastTradeTime > 15))
   {
      int retest_signal = ExtDetector.CheckBoundaryRetest(bid, ask, InpRetestBufferPts);

      // Buy Spike Case: Market touches back the upper ceiling within window -> Launch Trade #2: SELL RETEST!
      if(retest_signal == 1)
      {
         if(ExtTrade.SellAtPeak(InpTakeProfitPts, "RB100-RetestSell"))
         {
            ExtTotalSnipes++;
            ExtCurrentTradeType = TRADE_RETEST;
            ExtLastTradeTime = TimeCurrent();
            PrintFormat(">> 🎯 [TRADE #2 EXECUTED] Price retested UPPER CEILING within window! SELL executed at Bid: %.1f (TP: +%.1f pts, Hard Exit at 14m).",
                        bid, InpTakeProfitPts);
         }
      }
      // Sell Spike Case: Market touches back the lower floor within window -> Launch Trade #2: BUY RETEST!
      else if(retest_signal == -1)
      {
         if(ExtTrade.BuyAtBottom(InpTakeProfitPts, "RB100-RetestBuy"))
         {
            ExtTotalSnipes++;
            ExtCurrentTradeType = TRADE_RETEST;
            ExtLastTradeTime = TimeCurrent();
            PrintFormat(">> 🎯 [TRADE #2 EXECUTED] Price retested LOWER FLOOR within window! BUY executed at Ask: %.1f (TP: +%.1f pts, Hard Exit at 14m).",
                        ask, InpTakeProfitPts);
         }
      }
   }
}
