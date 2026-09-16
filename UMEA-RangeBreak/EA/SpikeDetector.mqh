//+------------------------------------------------------------------+
//|                                                SpikeDetector.mqh |
//|                         UMEA Range Break 100 Spike Detector      |
//|                                  Copyright 2026, UmeaFX Project. |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, UmeaFX Project."
#property link      "https://www.umeafx.com"

enum ENUM_SPIKE_STATE
{
   STATE_MONITORING = 0,
   STATE_SPIKE_BUY_ACTIVE,
   STATE_SPIKE_SELL_ACTIVE,
   STATE_RANGE_ESTABLISHED
};

class CSpikeDetector
{
private:
   string            m_symbol;
   double            m_spike_threshold;
   double            m_exhaustion_pts;
   int               m_window_seconds;     // Configurable countdown window (default 14 mins = 840s)

   ENUM_SPIKE_STATE  m_state;
   double            m_running_extreme;
   datetime          m_last_spike_time;
   double            m_last_spike_size;
   string            m_last_spike_type;

   // Range Boundaries
   double            m_range_ceiling;
   double            m_range_floor;
   datetime          m_range_start_time;

   bool              m_retest_taken;       // Only 1 retest trade per 14-min window
   bool              m_pullback_confirmed; // Confirms price pulled back from ceiling/floor before allowing retest

public:
   CSpikeDetector()
   {
      m_symbol          = _Symbol;
      m_spike_threshold = 75.0;
      m_exhaustion_pts  = 2.0;
      m_window_seconds  = 14 * 60;
      Reset();
   }

   void Init(string symbol, double spike_threshold = 75.0, double exhaustion_pts = 2.0, int window_mins = 14)
   {
      m_symbol          = symbol;
      m_spike_threshold = spike_threshold;
      m_exhaustion_pts  = exhaustion_pts;
      m_window_seconds  = window_mins * 60;
      Reset();
   }

   void Reset()
   {
      m_state              = STATE_MONITORING;
      m_running_extreme    = 0.0;
      m_range_ceiling      = 0.0;
      m_range_floor        = 0.0;
      m_last_spike_time    = 0;
      m_last_spike_size    = 0.0;
      m_last_spike_type    = "NONE";
      m_retest_taken       = false;
      m_pullback_confirmed = false;
   }

   int GetRemainingWindowSeconds()
   {
      if(m_last_spike_time <= 0)
         return 0;
      datetime now = TimeCurrent();
      datetime expiry = m_last_spike_time + m_window_seconds;
      int sec_left = (int)(expiry - now);
      return (sec_left > 0 ? sec_left : 0);
   }

   bool IsWindowActive()
   {
      return (GetRemainingWindowSeconds() > 0);
   }

   // Call on every tick: Returns 1 for FADE SELL SIGNAL (Buy spike peaked), -1 for FADE BUY SIGNAL (Sell spike bottomed)
   int UpdateTick(double bid, double ask)
   {
      // Check current M1 candle expansion
      double m1_open = iOpen(m_symbol, PERIOD_M1, 0);
      if(m1_open <= 0)
         return 0;

      double upward_move   = bid - m1_open;
      double downward_move = m1_open - ask;

      // ── 1. DETECT INITIAL EXPLOSION ─────────────────────────────
      if(m_state == STATE_MONITORING || (m_state == STATE_RANGE_ESTABLISHED && !IsWindowActive()))
      {
         if(upward_move >= m_spike_threshold)
         {
            m_state = STATE_SPIKE_BUY_ACTIVE;
            m_running_extreme = bid;
            Print(">> ⚡ [SPIKE DETECTED] Massive BUY Spike in progress! Current move: +", upward_move, " pts");
            return 0;
         }
         else if(downward_move >= m_spike_threshold)
         {
            m_state = STATE_SPIKE_SELL_ACTIVE;
            m_running_extreme = ask;
            Print(">> ⚡ [SPIKE DETECTED] Massive SELL Spike in progress! Current move: -", downward_move, " pts");
            return 0;
         }
      }

      // ── 2. TRACK BUY SPIKE PEAK & DETECT EXHAUSTION ──────────────
      if(m_state == STATE_SPIKE_BUY_ACTIVE)
      {
         if(bid > m_running_extreme)
         {
            m_running_extreme = bid;
            return 0;
         }
         else if((m_running_extreme - bid) >= m_exhaustion_pts)
         {
            // Spike halted and ticked down by exhaustion threshold!
            m_state              = STATE_RANGE_ESTABLISHED;
            m_range_ceiling      = m_running_extreme;
            m_last_spike_time    = TimeCurrent(); // 14-minute window starts NOW!
            m_last_spike_size    = m_running_extreme - m1_open;
            m_last_spike_type    = "BUY SPIKE (UP)";
            m_range_start_time   = m_last_spike_time;
            m_retest_taken       = false;
            m_pullback_confirmed = false;

            Print(">> 🎯 [PEAK CONFIRMED] Buy Spike halted at ", m_running_extreme, 
                  " (Size: +", m_last_spike_size, " pts) -> Launching Trade #1: SELL FADE!");
            Print(">> ⏳ 14-Minute Re-test Countdown Window STARTED!");
            return 1; // FADE SELL NOW!
         }
      }

      // ── 3. TRACK SELL SPIKE BOTTOM & DETECT EXHAUSTION ────────────
      if(m_state == STATE_SPIKE_SELL_ACTIVE)
      {
         if(ask < m_running_extreme)
         {
            m_running_extreme = ask;
            return 0;
         }
         else if((ask - m_running_extreme) >= m_exhaustion_pts)
         {
            // Spike halted and bounced up by exhaustion threshold!
            m_state              = STATE_RANGE_ESTABLISHED;
            m_range_floor        = m_running_extreme;
            m_last_spike_time    = TimeCurrent(); // 14-minute window starts NOW!
            m_last_spike_size    = m1_open - m_running_extreme;
            m_last_spike_type    = "SELL SPIKE (DOWN)";
            m_range_start_time   = m_last_spike_time;
            m_retest_taken       = false;
            m_pullback_confirmed = false;

            Print(">> 🎯 [BOTTOM CONFIRMED] Sell Spike halted at ", m_running_extreme, 
                  " (Size: -", m_last_spike_size, " pts) -> Launching Trade #1: BUY FADE!");
            Print(">> ⏳ 14-Minute Re-test Countdown Window STARTED!");
            return -1; // FADE BUY NOW!
         }
      }

      // ── 4. TRACK PULLBACK TO ARM RETEST ───────────────────────────
      if(m_state == STATE_RANGE_ESTABLISHED && IsWindowActive() && !m_retest_taken)
      {
         if(m_range_ceiling > 0 && (m_range_ceiling - bid) >= 8.0)
         {
            m_pullback_confirmed = true;
         }
         if(m_range_floor > 0 && (ask - m_range_floor) >= 8.0)
         {
            m_pullback_confirmed = true;
         }
      }

      return 0;
   }

   // Check if price touches back the ceiling or floor within the 14-minute window
   int CheckBoundaryRetest(double bid, double ask, double buffer_pts)
   {
      if(m_state != STATE_RANGE_ESTABLISHED)
         return 0;

      if(!IsWindowActive())
         return 0;

      if(m_retest_taken)
         return 0;

      if(!m_pullback_confirmed)
         return 0;

      // Buy Spike Case: Market touches back the upper ceiling!
      if(m_range_ceiling > 0)
      {
         if(bid >= (m_range_ceiling - buffer_pts) && bid <= (m_range_ceiling + 3.0))
         {
            m_retest_taken = true;
            Print(">> 🎯 [SNIPER RETEST] Price touched UPPER CEILING at ", bid, 
                  " (Ceiling was: ", m_range_ceiling, ") within 14m window -> Launching Trade #2: SELL RETEST!");
            return 1; // SELL at Ceiling
         }
      }

      // Sell Spike Case: Market touches back the lower floor!
      if(m_range_floor > 0)
      {
         if(ask <= (m_range_floor + buffer_pts) && ask >= (m_range_floor - 3.0))
         {
            m_retest_taken = true;
            Print(">> 🎯 [SNIPER RETEST] Price touched LOWER FLOOR at ", ask, 
                  " (Floor was: ", m_range_floor, ") within 14m window -> Launching Trade #2: BUY RETEST!");
            return -1; // BUY at Floor
         }
      }

      return 0;
   }

   // Getters for Dashboard
   double GetRangeCeiling()        { return m_range_ceiling; }
   double GetRangeFloor()          { return m_range_floor; }
   double GetLastSpikeSize()       { return m_last_spike_size; }
   string GetLastSpikeType()       { return m_last_spike_type; }
   ENUM_SPIKE_STATE GetState()     { return m_state; }
   bool   IsRetestTaken()          { return m_retest_taken; }
   bool   IsPullbackConfirmed()    { return m_pullback_confirmed; }
};
