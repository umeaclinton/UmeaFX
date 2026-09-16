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
   int               m_retest_window_sec;  // 9 minutes (540s) eligibility window
   int               m_hard_timeout_sec;   // 14 minutes (840s) hard exit cutoff

   datetime          m_last_m1_bar_time;
   datetime          m_last_spike_time;
   double            m_last_spike_size;
   string            m_last_spike_type;

   // Range Boundaries from completed spike bar
   double            m_range_ceiling;
   double            m_range_floor;

   bool              m_retest_taken;       // Only 1 retest trade per spike cycle
   bool              m_pullback_confirmed; // Confirms price pulled back away from ceiling/floor before retest

public:
   CSpikeDetector()
   {
      m_symbol            = _Symbol;
      m_spike_threshold   = 75.0;
      m_retest_window_sec = 9 * 60;   // 9 minutes
      m_hard_timeout_sec  = 14 * 60;  // 14 minutes
      Reset();
   }

   void Init(string symbol, double spike_threshold = 75.0, int retest_window_mins = 9, int hard_timeout_mins = 14)
   {
      m_symbol            = symbol;
      m_spike_threshold   = spike_threshold;
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
      m_range_ceiling      = 0.0;
      m_range_floor        = 0.0;
      m_retest_taken       = false;
      m_pullback_confirmed = false;
   }

   // ── Check if 9-Minute Eligibility Window is still active ────────
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
   // Returns 1 for BUY Spike (Enter SELL on new bar open), -1 for SELL Spike (Enter BUY on new bar open)
   int CheckNewBarSpike()
   {
      datetime current_m1 = iTime(m_symbol, PERIOD_M1, 0);
      if(current_m1 <= 0)
         return 0;

      // First run: just initialize bar time
      if(m_last_m1_bar_time == 0)
      {
         m_last_m1_bar_time = current_m1;
         return 0;
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
            m_last_spike_time    = TimeCurrent(); // Master clock starts!
            m_last_spike_size    = body_1;
            m_last_spike_type    = "BUY SPIKE (UP)";
            m_retest_taken       = false;
            m_pullback_confirmed = false;

            PrintFormat(">> 🎯 [SPIKE COMPLETED & COOLED DOWN] Buy Spike finished! Body: +%.1f pts | High/Ceiling: %.1f",
                        body_1, high_1);
            Print(">> 🚀 Launching Trade #1: SELL at Open of New Calm M1 Bar! (9m Retest Window & 14m Hard Timeout Started)");
            return 1; // FADE SELL
         }
         // Check for Bearish Spike (Sell spike)
         else if(body_1 <= -m_spike_threshold)
         {
            m_range_floor        = low_1;
            m_range_ceiling      = 0.0;
            m_last_spike_time    = TimeCurrent(); // Master clock starts!
            m_last_spike_size    = MathAbs(body_1);
            m_last_spike_type    = "SELL SPIKE (DOWN)";
            m_retest_taken       = false;
            m_pullback_confirmed = false;

            PrintFormat(">> 🎯 [SPIKE COMPLETED & COOLED DOWN] Sell Spike finished! Body: -%.1f pts | Low/Floor: %.1f",
                        MathAbs(body_1), low_1);
            Print(">> 🚀 Launching Trade #1: BUY at Open of New Calm M1 Bar! (9m Retest Window & 14m Hard Timeout Started)");
            return -1; // FADE BUY
         }
      }

      return 0;
   }

   // ── 2. Track Pullback on ticks to arm Trade #2 ───────────────────
   void UpdateTickPullback(double bid, double ask)
   {
      if(!IsRetestWindowActive() || m_retest_taken)
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

   // ── 3. Check for Ceiling/Floor Retest (Trade #2) ─────────────────
   // ONLY triggers if within 9 minutes of the spike, and price touched boundary
   int CheckBoundaryRetest(double bid, double ask, double buffer_pts)
   {
      // 9-minute window rule: MUST be within 9 minutes from the spike!
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
            PrintFormat(">> 🎯 [SNIPER RETEST #2] Price touched UPPER CEILING at %.1f (Ceiling: %.1f) within 9m window! Launching Trade #2: SELL RETEST!",
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
            PrintFormat(">> 🎯 [SNIPER RETEST #2] Price touched LOWER FLOOR at %.1f (Floor: %.1f) within 9m window! Launching Trade #2: BUY RETEST!",
                        ask, m_range_floor);
            return -1; // BUY
         }
      }

      return 0;
   }

   // Mark retest as taken manually if needed
   void SetRetestTaken(bool taken) { m_retest_taken = taken; }

   // Getters for Dashboard
   double   GetRangeCeiling()        { return m_range_ceiling; }
   double   GetRangeFloor()          { return m_range_floor; }
   double   GetLastSpikeSize()       { return m_last_spike_size; }
   string   GetLastSpikeType()       { return m_last_spike_type; }
   datetime GetLastSpikeTime()       { return m_last_spike_time; }
   bool     IsRetestTaken()          { return m_retest_taken; }
   bool     IsPullbackConfirmed()    { return m_pullback_confirmed; }
};
