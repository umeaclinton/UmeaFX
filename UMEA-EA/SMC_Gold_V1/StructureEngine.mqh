//+------------------------------------------------------------------+
//|                                              StructureEngine.mqh |
//|                                  Copyright 2026, UmeaFX Project. |
//|                                       https://www.umeafx.com     |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, UmeaFX Project."
#property link      "https://www.umeafx.com"

#include "Defines.mqh"

class CStructureEngine
{
private:
   string            m_symbol;
   ENUM_TIMEFRAMES   m_timeframe;
   int               m_left_bars;
   int               m_right_bars;

   SwingPoint        m_swings[];
   int               m_swings_total;

   SwingPoint        m_active_high;
   SwingPoint        m_active_low;
   bool              m_has_active_high;
   bool              m_has_active_low;
   ENUM_MARKET_TREND m_current_trend;

public:
   CStructureEngine()
   {
      m_left_bars       = 2;
      m_right_bars      = 2;
      m_swings_total    = 0;
      m_has_active_high = false;
      m_has_active_low  = false;
      m_current_trend   = TREND_NEUTRAL;
   }

   void Init(string symbol, ENUM_TIMEFRAMES tf, int left_bars=2, int right_bars=2)
   {
      m_symbol       = symbol;
      m_timeframe    = tf;
      m_left_bars    = left_bars;
      m_right_bars   = right_bars;
      Reset();
   }

   void Reset()
   {
      ArrayResize(m_swings, 0);
      m_swings_total    = 0;
      m_has_active_high = false;
      m_has_active_low  = false;
      m_current_trend   = TREND_NEUTRAL;
   }

   ENUM_MARKET_TREND GetCurrentTrend() const { return m_current_trend; }

   // Check if a completed bar at bar_offset is a confirmed fractal swing
   // Note: in MQL5, rates[0] is current uncompleted bar, rates[1] is just completed bar.
   // An extreme at bar (1 + right_bars) is confirmed as of bar 1.
   bool CheckFractalSwing(const MqlRates &rates[], int total_bars, SwingPoint &out_swing)
   {
      int candidate_idx = 1 + m_right_bars;
      if(candidate_idx + m_left_bars >= total_bars)
         return false;

      double cand_high = rates[candidate_idx].high;
      double cand_low  = rates[candidate_idx].low;

      // 1. Check Swing High
      bool is_high = true;
      for(int i = 1; i <= m_left_bars; i++)
      {
         if(rates[candidate_idx + i].high >= cand_high)
         {
            is_high = false;
            break;
         }
      }
      if(is_high)
      {
         for(int i = 1; i <= m_right_bars; i++)
         {
            if(rates[candidate_idx - i].high >= cand_high)
            {
               is_high = false;
               break;
            }
         }
      }

      if(is_high)
      {
         out_swing.bar_index           = candidate_idx;
         out_swing.time                = rates[candidate_idx].time;
         out_swing.swing_type          = SWING_TYPE_HIGH;
         out_swing.price               = cand_high;
         out_swing.confirmed_bar_index = 1;
         out_swing.confirmed_time      = rates[1].time;
         
         // Classify HH vs LH
         if(m_has_active_high)
            out_swing.classification = (cand_high > m_active_high.price) ? SWING_CLASS_HH : SWING_CLASS_LH;
         else
            out_swing.classification = SWING_CLASS_NONE;

         m_active_high     = out_swing;
         m_has_active_high = true;

         if(m_current_trend == TREND_NEUTRAL && m_has_active_low)
            m_current_trend = (m_active_high.time > m_active_low.time) ? TREND_BULLISH : TREND_BEARISH;

         return true;
      }

      // 2. Check Swing Low
      bool is_low = true;
      for(int i = 1; i <= m_left_bars; i++)
      {
         if(rates[candidate_idx + i].low <= cand_low)
         {
            is_low = false;
            break;
         }
      }
      if(is_low)
      {
         for(int i = 1; i <= m_right_bars; i++)
         {
            if(rates[candidate_idx - i].low <= cand_low)
            {
               is_low = false;
               break;
            }
         }
      }

      if(is_low)
      {
         out_swing.bar_index           = candidate_idx;
         out_swing.time                = rates[candidate_idx].time;
         out_swing.swing_type          = SWING_TYPE_LOW;
         out_swing.price               = cand_low;
         out_swing.confirmed_bar_index = 1;
         out_swing.confirmed_time      = rates[1].time;

         // Classify HL vs LL
         if(m_has_active_low)
            out_swing.classification = (cand_low > m_active_low.price) ? SWING_CLASS_HL : SWING_CLASS_LL;
         else
            out_swing.classification = SWING_CLASS_NONE;

         m_active_low     = out_swing;
         m_has_active_low = true;

         if(m_current_trend == TREND_NEUTRAL && m_has_active_high)
            m_current_trend = (m_active_high.time > m_active_low.time) ? TREND_BULLISH : TREND_BEARISH;

         return true;
      }

      return false;
   }

   // Evaluate structure events on the newly closed bar (bar 1)
   bool EvaluateBar(const MqlRates &rates[], int total_bars, StructureEvent &out_event)
   {
      out_event.event_type = EVENT_NONE;
      if(total_bars < 10)
         return false;

      // First check if a swing was confirmed
      SwingPoint sp;
      CheckFractalSwing(rates, total_bars, sp);

      if(!m_has_active_high || !m_has_active_low)
         return false;

      double c_high  = rates[1].high;
      double c_low   = rates[1].low;
      double c_close = rates[1].close;
      datetime c_time= rates[1].time;

      // 1. Check breaks of the Active High
      if(c_high > m_active_high.price)
      {
         if(c_close > m_active_high.price)
         {
            // Body close above active high
            if(m_current_trend == TREND_BULLISH)
            {
               out_event.event_type   = EVENT_BOS_BULLISH;
            }
            else
            {
               out_event.event_type   = EVENT_CHOCH_BULLISH;
               m_current_trend        = TREND_BULLISH;
            }
            out_event.bar_index    = 1;
            out_event.time         = c_time;
            out_event.level_broken = m_active_high.price;
            out_event.close_price  = c_close;
            out_event.wick_extreme = c_high;
            out_event.trend_after  = m_current_trend;
            m_has_active_high      = false; // High consumed
            return true;
         }
         else
         {
            // Wick pierced above but closed inside -> Buy-side Liquidity Sweep
            out_event.event_type   = EVENT_SWEEP_BUYSIDE;
            out_event.bar_index    = 1;
            out_event.time         = c_time;
            out_event.level_broken = m_active_high.price;
            out_event.close_price  = c_close;
            out_event.wick_extreme = c_high;
            out_event.trend_after  = m_current_trend;
            return true;
         }
      }

      // 2. Check breaks of the Active Low
      if(c_low < m_active_low.price)
      {
         if(c_close < m_active_low.price)
         {
            // Body close below active low
            if(m_current_trend == TREND_BEARISH)
            {
               out_event.event_type   = EVENT_BOS_BEARISH;
            }
            else
            {
               out_event.event_type   = EVENT_CHOCH_BEARISH;
               m_current_trend        = TREND_BEARISH;
            }
            out_event.bar_index    = 1;
            out_event.time         = c_time;
            out_event.level_broken = m_active_low.price;
            out_event.close_price  = c_close;
            out_event.wick_extreme = c_low;
            out_event.trend_after  = m_current_trend;
            m_has_active_low       = false; // Low consumed
            return true;
         }
         else
         {
            // Wick pierced below but closed inside -> Sell-side Liquidity Sweep
            out_event.event_type   = EVENT_SWEEP_SELLSIDE;
            out_event.bar_index    = 1;
            out_event.time         = c_time;
            out_event.level_broken = m_active_low.price;
            out_event.close_price  = c_close;
            out_event.wick_extreme = c_low;
            out_event.trend_after  = m_current_trend;
            return true;
         }
      }

      return false;
   }
};
