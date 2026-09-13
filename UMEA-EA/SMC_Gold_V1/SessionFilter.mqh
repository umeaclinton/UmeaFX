//+------------------------------------------------------------------+
//|                                                SessionFilter.mqh |
//|                                  Copyright 2026, UmeaFX Project. |
//|                                       https://www.umeafx.com     |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, UmeaFX Project."
#property link      "https://www.umeafx.com"

class CSessionFilter
{
private:
   bool     m_enabled;
   int      m_gmt_offset;     // Broker Server GMT Offset in hours
   int      m_london_start;   // UTC hour
   int      m_london_end;
   int      m_ny_start;       // UTC hour
   int      m_ny_end;

public:
   CSessionFilter()
   {
      m_enabled      = true;
      m_gmt_offset   = 0;
      m_london_start = 7;
      m_london_end   = 11;
      m_ny_start     = 12;
      m_ny_end       = 17;
   }

   void Init(bool enabled, int gmt_offset, int london_start=7, int london_end=11, int ny_start=12, int ny_end=17)
   {
      m_enabled      = enabled;
      m_gmt_offset   = gmt_offset;
      m_london_start = london_start;
      m_london_end   = london_end;
      m_ny_start     = ny_start;
      m_ny_end       = ny_end;
   }

   bool IsInKillzone(datetime bar_time)
   {
      if(!m_enabled)
         return true;

      // Adjust bar_time to UTC
      datetime utc_time = bar_time - (m_gmt_offset * 3600);
      MqlDateTime dt;
      TimeToStruct(utc_time, dt);

      int hour = dt.hour;
      bool is_london = (hour >= m_london_start && hour <= m_london_end);
      bool is_ny     = (hour >= m_ny_start && hour <= m_ny_end);

      return (is_london || is_ny);
   }
};
