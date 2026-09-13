//+------------------------------------------------------------------+
//|                                                  TrendEngine.mqh |
//|                             UmeaFX FX Vol 60 Synthetic Engine    |
//|                                  Copyright 2026, UmeaFX Project. |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, UmeaFX Project."
#property link      "https://www.umeafx.com"

#include "Defines.mqh"

class CTrendEngine
{
private:
   string            m_symbol;
   double            m_daily_open;
   datetime          m_current_day;
   double            m_boundary_pts;

   // Mode 3: Body entry — set fresh on every H1 bar close
   bool              m_body_valid_bull;   // Last candle was bullish & body big enough
   bool              m_body_valid_bear;   // Last candle was bearish & body big enough
   double            m_body_entry_bull;   // Buy limit price
   double            m_body_entry_bear;   // Sell limit price
   double            m_prev_body_pts;     // Last candle body size (for logging/HUD)

public:
   CTrendEngine()
   {
      m_daily_open      = 0.0;
      m_current_day     = 0;
      m_boundary_pts    = 1000.0;
      m_body_valid_bull = false;
      m_body_valid_bear = false;
      m_body_entry_bull = 0.0;
      m_body_entry_bear = 0.0;
      m_prev_body_pts   = 0.0;
   }

   bool Init(string symbol, double boundary_pts = 1000.0)
   {
      m_symbol       = symbol;
      m_boundary_pts = boundary_pts;
      return true;   // No indicator handles needed
   }

   // Called on every new 1H bar close
   void Update(const MqlRates &rates_h1[], int total_bars,
               double body_entry_pct, double min_body_pts)
   {
      if(total_bars < 3)
         return;

      // Reset body entry flags
      m_body_valid_bull = false;
      m_body_valid_bear = false;

      // 1. Track Daily Open (D1 bar)
      MqlRates daily_bar[];
      ArraySetAsSeries(daily_bar, true);
      if(CopyRates(m_symbol, PERIOD_D1, 0, 1, daily_bar) > 0)
      {
         if(daily_bar[0].time != m_current_day)
         {
            m_current_day = daily_bar[0].time;
            m_daily_open  = daily_bar[0].open;
            Print("=== NEW DAY: ", TimeToString(m_current_day, TIME_DATE),
                  " | Daily Open: ", m_daily_open, " ===");
         }
      }

      // 2. Mode 3: Read the last CLOSED candle (rates_h1[1])
      //    No trend filter — purely mirror the candle direction
      double last_open  = rates_h1[1].open;
      double last_close = rates_h1[1].close;
      double last_body  = MathAbs(last_close - last_open);
      m_prev_body_pts   = last_body;

      if(last_body < min_body_pts)
         return;   // Candle too small (doji / indecision) — skip this bar

      if(last_close > last_open)
      {
         // Bullish candle → Buy limit dipped into body from top
         // body_top = last_close; entry = body_top - body * pct
         m_body_entry_bull = last_close - last_body * body_entry_pct;
         m_body_valid_bull = true;
      }
      else
      {
         // Bearish candle → Sell limit pushed into body from bottom
         // body_bot = last_close; entry = body_bot + body * pct
         m_body_entry_bear = last_close + last_body * body_entry_pct;
         m_body_valid_bear = true;
      }
   }

   // ── Zone detection for Mode 2 ─────────────────────────────────────────────
   ENUM_DAILY_ZONE GetZone(double current_price)
   {
      if(m_daily_open <= 0)
         return ZONE_EXPANSION_NORMAL;

      double diff = current_price - m_daily_open;
      if(diff >= m_boundary_pts)
         return ZONE_CEILING_EXTREME;
      else if(diff <= -m_boundary_pts)
         return ZONE_FLOOR_EXTREME;
      return ZONE_EXPANSION_NORMAL;
   }

   // ── Getters ───────────────────────────────────────────────────────────────
   double GetDailyOpen()               const { return m_daily_open; }
   double GetDistanceToOpen(double p)  const { return (p - m_daily_open); }
   bool   IsBodyBullValid()            const { return m_body_valid_bull; }
   bool   IsBodyBearValid()            const { return m_body_valid_bear; }
   double GetBodyEntryBull()           const { return m_body_entry_bull; }
   double GetBodyEntryBear()           const { return m_body_entry_bear; }
   double GetPrevBodyPts()             const { return m_prev_body_pts; }
};
