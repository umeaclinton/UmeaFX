//+------------------------------------------------------------------+
//|                                                     UMEA_SMC.mq5 |
//|                                  Copyright 2026, UmeaFX Project. |
//|                                       https://www.umeafx.com     |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, UmeaFX Project."
#property link      "https://www.umeafx.com"
#property version   "1.00"
#property description "UmeaFX Algorithmic SMC/ICT Expert Advisor"

#include "Defines.mqh"
#include "SessionFilter.mqh"
#include "StructureEngine.mqh"
#include "FVGDetector.mqh"
#include "TradeManager.mqh"

//+------------------------------------------------------------------+
//| Inputs                                                           |
//+------------------------------------------------------------------+
input group "=== Risk & Trade Settings ==="
input ulong             InpMagicNumber       = 123456;      // Magic Number
input double            InpRiskPercent       = 1.0;         // Risk per Trade (%)
input double            InpRiskToReward      = 2.5;         // Risk-to-Reward Ratio (R)
input int               InpMaxPendingBars    = 16;          // Max Pending Bars Timeout
input int               InpMaxActiveTrades   = 1;           // Max Active Trades

input group "=== Strategy Parameters ==="
input double            InpMinFVGPoints      = 1.0;         // Minimum FVG Size ($)
input int               InpLeftBars          = 2;           // Swing Left Bars
input int               InpRightBars         = 2;           // Swing Right Bars
input double            InpSLBufferPoints    = 0.50;        // SL Buffer beyond Sweep Extreme ($)

input group "=== Filter Settings ==="
input bool              InpUseHTFFilter      = true;        // Use H1 Trend Alignment Filter
input bool              InpUseSessionFilter  = true;        // Use Session Killzones (London/NY)
input int               InpBrokerGMTOffset   = 0;           // Broker GMT Offset (Hours)

//+------------------------------------------------------------------+
//| Global Variables & Engine Instances                              |
//+------------------------------------------------------------------+
CStructureEngine  ExtStructureM15;
CStructureEngine  ExtStructureH1;
CFVGDetector      ExtFVGDetector;
CSessionFilter    ExtSessionFilter;
CTradeManager     ExtTradeManager;

datetime          ExtLastBarTimeM15 = 0;
datetime          ExtLastBarTimeH1  = 0;

// State tracking
StructureEvent    ExtRecentSweep;
bool              ExtHasRecentSweep = false;
double            ExtSweepExtreme   = 0.0;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   ExtStructureM15.Init(_Symbol, PERIOD_M15, InpLeftBars, InpRightBars);
   ExtStructureH1.Init(_Symbol, PERIOD_H1, InpLeftBars, InpRightBars);
   ExtFVGDetector.Init(InpMinFVGPoints);
   ExtSessionFilter.Init(InpUseSessionFilter, InpBrokerGMTOffset);
   ExtTradeManager.Init(_Symbol, InpMagicNumber, InpRiskPercent, InpMaxPendingBars);

   ExtLastBarTimeM15 = 0;
   ExtLastBarTimeH1  = 0;
   ExtHasRecentSweep = false;

   Print("UmeaFX SMC EA successfully initialized for symbol: ", _Symbol);
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   Comment("");
   Print("UmeaFX SMC EA removed. Reason: ", reason);
}

//+------------------------------------------------------------------+
//| Update On-Chart HUD Comment                                      |
//+------------------------------------------------------------------+
void UpdateChartHUD()
{
   string h1_trend_str = "NEUTRAL";
   ENUM_MARKET_TREND h1_trend = ExtStructureH1.GetCurrentTrend();
   if(h1_trend == TREND_BULLISH) h1_trend_str = "BULLISH";
   else if(h1_trend == TREND_BEARISH) h1_trend_str = "BEARISH";

   bool in_killzone = ExtSessionFilter.IsInKillzone(TimeCurrent());
   string session_str = in_killzone ? "ACTIVE (London/NY Killzone)" : "INACTIVE (Asian/Off-Hours)";

   string hud = "========================================\n"
              + "        UmeaFX SMC Expert Advisor       \n"
              + "========================================\n"
              + "Symbol: " + _Symbol + "\n"
              + "H1 Higher-Timeframe Trend: " + h1_trend_str + "\n"
              + "Current Session: " + session_str + "\n"
              + "Recent Sweep Active: " + (ExtHasRecentSweep ? "YES" : "NO") + "\n"
              + "Active Orders/Positions: " + IntegerToString(ExtTradeManager.TotalActiveOrders()) + "\n"
              + "Risk Per Trade: " + DoubleToString(InpRiskPercent, 1) + "%\n"
              + "Target Risk:Reward: " + DoubleToString(InpRiskToReward, 1) + "R\n"
              + "========================================";

   Comment(hud);
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
   UpdateChartHUD();

   // 1. Process H1 Bar Completion (for Higher Timeframe Trend)
   datetime current_h1_time = iTime(_Symbol, PERIOD_H1, 0);
   if(current_h1_time != ExtLastBarTimeH1)
   {
      ExtLastBarTimeH1 = current_h1_time;
      MqlRates rates_h1[];
      ArraySetAsSeries(rates_h1, true);
      int copied_h1 = CopyRates(_Symbol, PERIOD_H1, 0, 50, rates_h1);
      if(copied_h1 > 10)
      {
         StructureEvent h1_event;
         ExtStructureH1.EvaluateBar(rates_h1, copied_h1, h1_event);
      }
   }

   // 2. Check for New M15 Bar Completion (Strategy operates strictly on closed bars)
   datetime current_m15_time = iTime(_Symbol, PERIOD_M15, 0);
   if(current_m15_time == ExtLastBarTimeM15)
      return; // Still the same bar, wait for bar completion

   ExtLastBarTimeM15 = current_m15_time;

   // Cancel stale limit orders older than max pending bars
   ExtTradeManager.CancelStaleOrders(current_m15_time, PeriodSeconds(PERIOD_M15));

   // Copy recent M15 rates (rates[0] is newly opened, rates[1] is just completed bar)
   MqlRates rates_m15[];
   ArraySetAsSeries(rates_m15, true);
   int copied_m15 = CopyRates(_Symbol, PERIOD_M15, 0, 60, rates_m15);
   if(copied_m15 < 15)
      return;

   // Evaluate M15 Structure
   StructureEvent m15_event;
   bool has_event = ExtStructureM15.EvaluateBar(rates_m15, copied_m15, m15_event);

   if(has_event)
   {
      // Step A: Register Liquidity Sweeps
      if(m15_event.event_type == EVENT_SWEEP_SELLSIDE)
      {
         ExtRecentSweep    = m15_event;
         ExtHasRecentSweep = true;
         ExtSweepExtreme   = m15_event.wick_extreme;
         Print("M15 Sell-Side Liquidity Sweep detected at: ", m15_event.level_broken, " Extreme: ", ExtSweepExtreme);
      }
      else if(m15_event.event_type == EVENT_SWEEP_BUYSIDE)
      {
         ExtRecentSweep    = m15_event;
         ExtHasRecentSweep = true;
         ExtSweepExtreme   = m15_event.wick_extreme;
         Print("M15 Buy-Side Liquidity Sweep detected at: ", m15_event.level_broken, " Extreme: ", ExtSweepExtreme);
      }

      // Step B: Bullish CHoCH (Reversal after Sell-Side Sweep)
      else if(m15_event.event_type == EVENT_CHOCH_BULLISH)
      {
         bool session_ok = ExtSessionFilter.IsInKillzone(rates_m15[1].time);
         bool htf_ok     = !InpUseHTFFilter || (ExtStructureH1.GetCurrentTrend() != TREND_BEARISH);

         if(ExtHasRecentSweep && ExtRecentSweep.event_type == EVENT_SWEEP_SELLSIDE && session_ok && htf_ok)
         {
            // Check for newly created Bullish FVG
            FVGZone fvg;
            if(ExtFVGDetector.DetectLatest(rates_m15, copied_m15, fvg) && fvg.fvg_type == FVG_TYPE_BULLISH)
            {
               double entry_price = fvg.ce; // 50% Consequent Encroachment
               double stop_loss   = ExtSweepExtreme - InpSLBufferPoints;
               double risk_dist   = entry_price - stop_loss;

               if(risk_dist > InpSLBufferPoints && ExtTradeManager.TotalActiveOrders() < InpMaxActiveTrades)
               {
                  double take_profit = entry_price + (risk_dist * InpRiskToReward);
                  if(ExtTradeManager.PlaceBuyLimit(entry_price, stop_loss, take_profit))
                  {
                     Print("Placed BUY LIMIT at FVG CE: ", entry_price, " SL: ", stop_loss, " TP: ", take_profit);
                     ExtHasRecentSweep = false; // Reset after placing setup
                  }
               }
            }
         }
      }

      // Step C: Bearish CHoCH (Reversal after Buy-Side Sweep)
      else if(m15_event.event_type == EVENT_CHOCH_BEARISH)
      {
         bool session_ok = ExtSessionFilter.IsInKillzone(rates_m15[1].time);
         bool htf_ok     = !InpUseHTFFilter || (ExtStructureH1.GetCurrentTrend() != TREND_BULLISH);

         if(ExtHasRecentSweep && ExtRecentSweep.event_type == EVENT_SWEEP_BUYSIDE && session_ok && htf_ok)
         {
            FVGZone fvg;
            if(ExtFVGDetector.DetectLatest(rates_m15, copied_m15, fvg) && fvg.fvg_type == FVG_TYPE_BEARISH)
            {
               double entry_price = fvg.ce; // 50% Consequent Encroachment
               double stop_loss   = ExtSweepExtreme + InpSLBufferPoints;
               double risk_dist   = stop_loss - entry_price;

               if(risk_dist > InpSLBufferPoints && ExtTradeManager.TotalActiveOrders() < InpMaxActiveTrades)
               {
                  double take_profit = entry_price - (risk_dist * InpRiskToReward);
                  if(ExtTradeManager.PlaceSellLimit(entry_price, stop_loss, take_profit))
                  {
                     Print("Placed SELL LIMIT at FVG CE: ", entry_price, " SL: ", stop_loss, " TP: ", take_profit);
                     ExtHasRecentSweep = false;
                  }
               }
            }
         }
      }
   }
}
//+------------------------------------------------------------------+
