//+------------------------------------------------------------------+
//|                                                SpikeDetector.mqh |
//|                         UMEA Range Break 100 Spike Detector      |
//|                                  Copyright 2026, UmeaFX Project. |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, UmeaFX Project."
#property link      "https://www.umeafx.com"

class CSpikeDetector
{
private:
   string            m_symbol;
   double            m_spike_threshold;
   int               m_entry_window_sec;   // 12 minutes (720s) first entry eligibility window
   int               m_retest_window_sec;  // 9 minutes (540s) secondary retest eligibility window
   int               m_hard_timeout_sec;   // 14 minutes (840s) hard exit cutoff

   datetime          m_last_m1_bar_time;
   datetime          m_last_spike_time;
   double            m_last_spike_size;
   string            m_last_spike_type;
   int               m_spike_direction;    // 1 = Buy Spike, -1 = Sell Spike, 0 = None

   // Range Boundaries from completed spike bar
   double            m_range_ceiling;
   double            m_range_floor;

   // Trade Flags
   bool              m_entry_1_armed;      // True when spike occurs and waiting for 2.0 pt touch
   bool              m_entry_1_taken;      // True once Trade #1 has been triggered
   bool              m_retest_taken;       // Only 1 retest trade per spike cycle
   bool              m_pullback_confirmed; // Confirms price pulled back away from ceiling/floor before retest

public:
   CSpikeDetector()
   {
      m_symbol            = _Symbol;
      m_spike_threshold   = 75.0;
      m_entry_window_sec  = 12 * 60;  // 12 minutes
      m_retest_window_sec = 9 * 60;   // 9 minutes
      m_hard_timeout_sec  = 14 * 60;  // 14 minutes
      Reset();
   }

   void Init(string symbol, double spike_threshold = 75.0, int entry_window_mins = 12, int retest_window_mins = 9, int hard_timeout_mins = 14)
   {
      m_symbol            = symbol;
      m_spike_threshold   = spike_threshold;
      m_entry_window_sec  = entry_window_mins * 60;
      m_retest_window_sec = retest_window_mins * 60;
      m_hard_timeout_sec  = hard_timeout_mins * 60;
      Reset();
   }

   void Reset()
   {
      m_last_m1_bar_time   = 0;
      m_last_spike_time    = 0;
      m_last_spike_size    = 0.0;
      m_last_spike_type    = "NONE";
      m_spike_direction    = 0;
      m_range_ceiling      = 0.0;
      m_range_floor        = 0.0;
      m_entry_1_armed      = false;
      m_entry_1_taken      = false;
      m_retest_taken       = false;
      m_pullback_confirmed = false;
   }

   // ── Check if 12-Minute Entry #1 Window is still active ──────────
   int GetRemainingEntry1Seconds()
   {
      if(m_last_spike_time <= 0)
         return 0;
      datetime now = TimeCurrent();
      datetime expiry = m_last_spike_time + m_entry_window_sec;
      int sec_left = (int)(expiry - now);
      return (sec_left > 0 ? sec_left : 0);
   }

   bool IsEntry1WindowActive()
   {
      return (GetRemainingEntry1Seconds() > 0);
   }

   // ── Check if 9-Minute Retest Window is still active ─────────────
   int GetRemainingRetestSeconds()
   {
      if(m_last_spike_time <= 0)
         return 0;
      datetime now = TimeCurrent();
      datetime expiry = m_last_spike_time + m_retest_window_sec;
      int sec_left = (int)(expiry - now);
      return (sec_left > 0 ? sec_left : 0);
   }

   bool IsRetestWindowActive()
   {
      return (GetRemainingRetestSeconds() > 0);
   }

   // ── Check if 14-Minute Hard Timeout from spike has been reached ──
   int GetRemainingTimeoutSeconds()
   {
      if(m_last_spike_time <= 0)
         return 0;
      datetime now = TimeCurrent();
      datetime expiry = m_last_spike_time + m_hard_timeout_sec;
      int sec_left = (int)(expiry - now);
      return (sec_left > 0 ? sec_left : 0);
   }

   bool IsHardTimeoutReached()
   {
      if(m_last_spike_time <= 0)
         return false;
      return ((TimeCurrent() - m_last_spike_time) >= m_hard_timeout_sec);
   }

   // ── 1. Check for Completed Spike on New 1-Minute Bar ────────────
   // Detects if the previous completed 1-minute bar was a spike.
   // Does NOT immediately enter. Instead, marks Ceiling/Floor and ARMS Trade #1.
   bool CheckNewBarSpike()
   {
      datetime current_m1 = iTime(m_symbol, PERIOD_M1, 0);
      if(current_m1 <= 0)
         return false;

      // First run: just initialize bar time
      if(m_last_m1_bar_time == 0)
      {
         m_last_m1_bar_time = current_m1;
         return false;
      }

      // Check if a brand new 1-minute candle just opened!
      if(current_m1 != m_last_m1_bar_time)
      {
         m_last_m1_bar_time = current_m1;

         // Inspect the completed spike candle (bar index 1)
         double open_1  = iOpen(m_symbol, PERIOD_M1, 1);
         double close_1 = iClose(m_symbol, PERIOD_M1, 1);
         double high_1  = iHigh(m_symbol, PERIOD_M1, 1);
         double low_1   = iLow(m_symbol, PERIOD_M1, 1);
         double body_1  = close_1 - open_1;

         // Check for Bullish Spike (Buy spike)
         if(body_1 >= m_spike_threshold)
         {
            m_range_ceiling      = high_1;
            m_range_floor        = 0.0;
            m_last_spike_time    = TimeCurrent(); // 12m & 14m Master clock starts!
            m_last_spike_size    = body_1;
            m_last_spike_type    = "BUY SPIKE (UP)";
            m_spike_direction    = 1;
            m_entry_1_armed      = true;
            m_entry_1_taken      = false;
            m_retest_taken       = false;
            m_pullback_confirmed = false;

            PrintFormat(">> 🎯 [SPIKE CONFIRMED] Buy Spike finished! Body: +%.1f pts | Ceiling High: %.1f",
                        body_1, high_1);
            PrintFormat(">> 🔫 [TRADE #1 ARMED] Monitoring next candles! Hunting SELL entry within 2.0 pts of Ceiling: %.1f (12m Window Active)",
                        high_1);
            return true;
         }
         // Check for Bearish Spike (Sell spike)
         else if(body_1 <= -m_spike_threshold)
         {
            m_range_floor        = low_1;
            m_range_ceiling      = 0.0;
            m_last_spike_time    = TimeCurrent(); // 12m & 14m Master clock starts!
            m_last_spike_size    = MathAbs(body_1);
            m_last_spike_type    = "SELL SPIKE (DOWN)";
            m_spike_direction    = -1;
            m_entry_1_armed      = true;
            m_entry_1_taken      = false;
            m_retest_taken       = false;
            m_pullback_confirmed = false;

            PrintFormat(">> 🎯 [SPIKE CONFIRMED] Sell Spike finished! Body: -%.1f pts | Floor Low: %.1f",
                        MathAbs(body_1), low_1);
            PrintFormat(">> 🔫 [TRADE #1 ARMED] Monitoring next candles! Hunting BUY entry within 2.0 pts of Floor: %.1f (12m Window Active)",
                        low_1);
            return true;
         }
      }

      return false;
   }

   // ── 2. Tick-by-Tick Sniper Check for Trade #1 Entry ──────────────
   // Triggers when price returns within buffer_pts of Ceiling (SELL) or Floor (BUY)
   // within the 12-minute window!
   int CheckFirstEntry(double bid, double ask, double buffer_pts)
   {
      if(!m_entry_1_armed || m_entry_1_taken)
         return 0;

      // Check if 12-minute window has expired
      if(!IsEntry1WindowActive())
      {
         m_entry_1_armed = false;
         Print(">> 🛑 [12-MIN ENTRY #1 EXPIRED] Price did not return within 2.0 pts of boundary. Cycle cancelled (No trade).");
         return 0;
      }

      // BUY SPIKE CASE: Price must reach within buffer_pts of the Upper Ceiling
      if(m_spike_direction == 1 && m_range_ceiling > 0)
      {
         if(bid >= (m_range_ceiling - buffer_pts) && bid <= (m_range_ceiling + 5.0))
         {
            m_entry_1_taken = true;
            m_entry_1_armed = false;
            PrintFormat(">> 🚀 [TRADE #1 TRIGGERED] Price returned to Ceiling zone! Bid: %.1f (Ceiling: %.1f, Buffer: %.1f pts). Firing SELL!",
                        bid, m_range_ceiling, buffer_pts);
            return 1; // SELL
         }
      }
      // SELL SPIKE CASE: Price must reach within buffer_pts of the Lower Floor
      else if(m_spike_direction == -1 && m_range_floor > 0)
      {
         if(ask <= (m_range_floor + buffer_pts) && ask >= (m_range_floor - 5.0))
         {
            m_entry_1_taken = true;
            m_entry_1_armed = false;
            PrintFormat(">> 🚀 [TRADE #1 TRIGGERED] Price returned to Floor zone! Ask: %.1f (Floor: %.1f, Buffer: %.1f pts). Firing BUY!",
                        ask, m_range_floor, buffer_pts);
            return -1; // BUY
         }
      }

      return 0;
   }

   // ── 3. Track Pullback on ticks to arm Trade #2 ───────────────────
   void UpdateTickPullback(double bid, double ask)
   {
      // Only track pullback after Trade #1 has been taken
      if(!m_entry_1_taken || !IsRetestWindowActive() || m_retest_taken)
         return;

      // For Buy Spike, price must pull back at least 8 pts down from ceiling before arming retest
      if(m_range_ceiling > 0 && (m_range_ceiling - bid) >= 8.0)
      {
         m_pullback_confirmed = true;
      }
      // For Sell Spike, price must bounce at least 8 pts up from floor before arming retest
      if(m_range_floor > 0 && (ask - m_range_floor) >= 8.0)
      {
         m_pullback_confirmed = true;
      }
   }

   // ── 4. Check for Ceiling/Floor Retest (Trade #2) ─────────────────
   // Triggers if within retest window of the spike, and price retested boundary after pulling back
   int CheckBoundaryRetest(double bid, double ask, double buffer_pts)
   {
      // Must have taken Trade #1 first
      if(!m_entry_1_taken)
         return 0;

      // Retest window rule: MUST be within retest window from the spike!
      if(!IsRetestWindowActive())
         return 0;

      // Only 1 retest trade allowed per spike cycle
      if(m_retest_taken)
         return 0;

      // Must have pulled back first
      if(!m_pullback_confirmed)
         return 0;

      // Buy Spike Case: Market touches back the upper ceiling!
      if(m_range_ceiling > 0)
      {
         if(bid >= (m_range_ceiling - buffer_pts) && bid <= (m_range_ceiling + 3.0))
         {
            m_retest_taken = true;
            PrintFormat(">> 🎯 [SNIPER RETEST #2] Price retested UPPER CEILING at %.1f (Ceiling: %.1f) within window! Launching Trade #2: SELL RETEST!",
                        bid, m_range_ceiling);
            return 1; // SELL
         }
      }

      // Sell Spike Case: Market touches back the lower floor!
      if(m_range_floor > 0)
      {
         if(ask <= (m_range_floor + buffer_pts) && ask >= (m_range_floor - 3.0))
         {
            m_retest_taken = true;
            PrintFormat(">> 🎯 [SNIPER RETEST #2] Price retested LOWER FLOOR at %.1f (Floor: %.1f) within window! Launching Trade #2: BUY RETEST!",
                        ask, m_range_floor);
            return -1; // BUY
         }
      }

      return 0;
   }

   // Manual controls
   void SetRetestTaken(bool taken)   { m_retest_taken = taken; }
   void SetEntry1Taken(bool taken)   { m_entry_1_taken = taken; }

   // Getters for Dashboard
   double   GetRangeCeiling()        { return m_range_ceiling; }
   double   GetRangeFloor()          { return m_range_floor; }
   double   GetLastSpikeSize()       { return m_last_spike_size; }
   string   GetLastSpikeType()       { return m_last_spike_type; }
   int      GetSpikeDirection()      { return m_spike_direction; }
   datetime GetLastSpikeTime()       { return m_last_spike_time; }
   bool     IsEntry1Armed()          { return m_entry_1_armed; }
   bool     IsEntry1Taken()          { return m_entry_1_taken; }
   bool     IsRetestTaken()          { return m_retest_taken; }
   bool     IsPullbackConfirmed()    { return m_pullback_confirmed; }
};
