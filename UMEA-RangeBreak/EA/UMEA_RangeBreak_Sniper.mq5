//+------------------------------------------------------------------+
//|                                     UMEA_RangeBreak_Sniper.mq5   |
//|                         UMEA Range Break 100 Sniper Engine       |
//|                                  Copyright 2026, UmeaFX Project. |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, UmeaFX Project."
#property link      "https://www.umeafx.com"
#property version   "1.00"
#property description "UMEA Range Break 100 Sniper | Spike Exhaustion Fade & Boundary Ping-Pong"

#include "SniperTrade.mqh"
#include "SpikeDetector.mqh"

//+------------------------------------------------------------------+
//| Inputs                                                           |
//+------------------------------------------------------------------+
input group "=== Sniper Spike Detection Settings ==="
input double   InpSpikeThreshold       = 75.0;     // Spike Trigger Distance (Points from M1 Open)
input double   InpExhaustionPts        = 2.0;      // Pullback Points to Confirm Peak Halt (1-3 pts)

input group "=== Scalp Exit Settings ==="
input double   InpTakeProfitPts        = 12.0;     // Sniper Take Profit (Points) [Tested 89%+ Win Rate]
input bool     InpEnableRetestTrades   = false;    // Enable Secondary Ping-Pong Trades on Boundary Retest
input double   InpRetestBufferPts      = 3.0;      // Distance from Boundary for Retest (Points)

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
CSniperTrade    ExtTrade;
CSpikeDetector  ExtDetector;

int      ExtTotalSnipes = 0;
int      ExtWinsToday   = 0;
datetime ExtLastTradeTime = 0;

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
   double m1_open = iOpen(_Symbol, PERIOD_M1, 0);

   int px = InpHUDXOffset;
   int py = InpHUDYOffset;
   int pw = 620;
   int ph = 380;

   SetHUDPanel("BG", px, py, pw, ph, InpHUDPanelBg, InpHUDBorder);

   int y = py + 12;
   int x = px + 14;
   int line_h = 22;

   string status_str = "MONITORING (Waiting for spike impulse)";
   ENUM_SPIKE_STATE st = ExtDetector.GetState();
   if(st == STATE_SPIKE_BUY_ACTIVE)
      status_str = "⚡ BUY SPIKE IN PROGRESS (Tracking peak)...";
   else if(st == STATE_SPIKE_SELL_ACTIVE)
      status_str = "⚡ SELL SPIKE IN PROGRESS (Tracking bottom)...";
   else if(ExtTrade.TotalActive() > 0)
      status_str = "🎯 SNIPER IN TRADE (Hunting 10-15 pt Retracement)";

   SetHUDLabel("Title",    "UMEA Range Break 100 Sniper Engine v1.00", x, y, 10);
   y += line_h;
   SetHUDLabel("SubTitle", "Strategy: Spike Peak Exhaustion Fade (No-SL Scalp)", x, y, 8);
   y += line_h + 2;

   SetHUDLabel("Div1", "--------------------------------------------------------------------------------", x, y, 8);
   y += line_h - 4;

   SetHUDLabel("Status",     StringFormat("Status:           %s", status_str), x, y, 8);
   y += line_h;
   SetHUDLabel("MarketPrices", StringFormat("Current Bid:      %.1f   |  Ask: %.1f", bid, ask), x, y, 8);
   y += line_h;
   SetHUDLabel("M1Open",      StringFormat("Current M1 Open:  %.1f   |  M1 Range: %.1f pts", m1_open, MathAbs(bid - m1_open)), x, y, 8);
   y += line_h + 2;

   SetHUDLabel("Div2", "--------------------------------------------------------------------------------", x, y, 8);
   y += line_h - 4;

   SetHUDLabel("LastSpike",   StringFormat("Last Spike:       %s (Size: %.1f pts)", ExtDetector.GetLastSpikeType(), ExtDetector.GetLastSpikeSize()), x, y, 8);
   y += line_h;
   SetHUDLabel("Boundaries",  StringFormat("Active Range:     Ceiling: %.1f  |  Floor: %.1f", ExtDetector.GetRangeCeiling(), ExtDetector.GetRangeFloor()), x, y, 8);
   y += line_h;
   SetHUDLabel("Config",      StringFormat("Sniper Settings:  Trigger >= %.0f pts | TP: +%.0f pts (No SL)", InpSpikeThreshold, InpTakeProfitPts), x, y, 8);
   y += line_h + 2;

   SetHUDLabel("Div3", "--------------------------------------------------------------------------------", x, y, 8);
   y += line_h - 4;

   SetHUDLabel("Stats",       StringFormat("Active Trades:    %d   |  Snipes Today: %d", ExtTrade.TotalActive(), ExtTotalSnipes), x, y, 8);

   ChartSetString(0, CHART_COMMENT, "");
   Comment("");
}

//+------------------------------------------------------------------+
//| Expert initialization                                            |
//+------------------------------------------------------------------+
int OnInit()
{
   ExtTrade.Init(_Symbol, InpMagicNumber, InpUseFixedLot, InpFixedLot, InpRiskPercent);
   ExtDetector.Init(_Symbol, InpSpikeThreshold, InpExhaustionPts);

   Print("UMEA Range Break 100 Sniper Engine v1.00 initialized!");
   Print("Spike Trigger: ", InpSpikeThreshold, " pts | Exhaustion: ", InpExhaustionPts, 
         " pts | Scalp TP: ", InpTakeProfitPts, " pts | No-SL Mode Active");

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

   // 1. Tick-by-tick real-time quick close monitor
   ExtTrade.CheckQuickClose(InpTakeProfitPts);

   // 2. If already in a scalp trade, do not open another trade simultaneously
   if(ExtTrade.TotalActive() > 0)
      return;

   // 3. Update real-time spike detector
   int spike_signal = ExtDetector.UpdateTick(bid, ask);

   // Signal 1: Buy Spike halted at peak -> FIRE INSTANT SELL FADE
   if(spike_signal == 1)
   {
      if(ExtTrade.SellAtPeak(InpTakeProfitPts, "RB100-SniperSell"))
      {
         ExtTotalSnipes++;
         ExtLastTradeTime = TimeCurrent();
         Print(">> 🚀 [SNIPER SHOT] SELL executed at peak! Target TP: +", InpTakeProfitPts, " pts retracement.");
      }
      return;
   }
   // Signal -1: Sell Spike halted at bottom -> FIRE INSTANT BUY FADE
   else if(spike_signal == -1)
   {
      if(ExtTrade.BuyAtBottom(InpTakeProfitPts, "RB100-SniperBuy"))
      {
         ExtTotalSnipes++;
         ExtLastTradeTime = TimeCurrent();
         Print(">> 🚀 [SNIPER SHOT] BUY executed at bottom! Target TP: +", InpTakeProfitPts, " pts bounce.");
      }
      return;
   }

   // 4. Secondary Re-test Ping-Pong Trades (if enabled)
   if(InpEnableRetestTrades && (TimeCurrent() - ExtLastTradeTime > 60))
   {
      int retest_signal = ExtDetector.CheckBoundaryRetest(bid, ask, InpRetestBufferPts);
      if(retest_signal == 1)
      {
         if(ExtTrade.SellAtPeak(InpTakeProfitPts, "RB100-RetestSell"))
         {
            ExtTotalSnipes++;
            ExtLastTradeTime = TimeCurrent();
            Print(">> 🎯 [BOUNDARY RETEST] Ceiling touched -> FADE SELL executed!");
         }
      }
      else if(retest_signal == -1)
      {
         if(ExtTrade.BuyAtBottom(InpTakeProfitPts, "RB100-RetestBuy"))
         {
            ExtTotalSnipes++;
            ExtLastTradeTime = TimeCurrent();
            Print(">> 🎯 [BOUNDARY RETEST] Floor touched -> FADE BUY executed!");
         }
      }
   }
}
