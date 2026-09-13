//+------------------------------------------------------------------+
//|                                                  FVGDetector.mqh |
//|                                  Copyright 2026, UmeaFX Project. |
//|                                       https://www.umeafx.com     |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, UmeaFX Project."
#property link      "https://www.umeafx.com"

#include "Defines.mqh"

class CFVGDetector
{
private:
   double   m_min_gap_points;

public:
   CFVGDetector()
   {
      m_min_gap_points = 1.0;
   }

   void Init(double min_gap_points=1.0)
   {
      m_min_gap_points = min_gap_points;
   }

   // Rates array indexed in reverse: 0 = current, 1 = completed candle 3, 2 = displacement candle 2, 3 = candle 1
   bool DetectLatest(const MqlRates &rates[], int total_bars, FVGZone &out_fvg)
   {
      out_fvg.fvg_type = FVG_TYPE_NONE;
      if(total_bars < 4)
         return false;

      double c1_high = rates[3].high;
      double c1_low  = rates[3].low;
      double c3_high = rates[1].high;
      double c3_low  = rates[1].low;

      // Bullish FVG
      if(c3_low > c1_high)
      {
         double gap = c3_low - c1_high;
         if(gap >= m_min_gap_points)
         {
            out_fvg.bar_index = 2;
            out_fvg.time      = rates[2].time;
            out_fvg.fvg_type  = FVG_TYPE_BULLISH;
            out_fvg.top       = c3_low;
            out_fvg.bottom    = c1_high;
            out_fvg.size      = gap;
            out_fvg.ce        = (out_fvg.top + out_fvg.bottom) / 2.0;
            out_fvg.status    = FVG_UNMITIGATED;
            return true;
         }
      }

      // Bearish FVG
      if(c3_high < c1_low)
      {
         double gap = c1_low - c3_high;
         if(gap >= m_min_gap_points)
         {
            out_fvg.bar_index = 2;
            out_fvg.time      = rates[2].time;
            out_fvg.fvg_type  = FVG_TYPE_BEARISH;
            out_fvg.top       = c1_low;
            out_fvg.bottom    = c3_high;
            out_fvg.size      = gap;
            out_fvg.ce        = (out_fvg.top + out_fvg.bottom) / 2.0;
            out_fvg.status    = FVG_UNMITIGATED;
            return true;
         }
      }

      return false;
   }
};
