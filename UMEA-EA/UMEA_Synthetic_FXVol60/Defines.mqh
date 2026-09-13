//+------------------------------------------------------------------+
//|                                                      Defines.mqh |
//|                             UmeaFX FX Vol 60 Synthetic Engine    |
//|                                  Copyright 2026, UmeaFX Project. |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, UmeaFX Project."
#property link      "https://www.umeafx.com"

// Daily zone: determines which mode fires
enum ENUM_DAILY_ZONE
{
   ZONE_EXPANSION_NORMAL = 0,    // Within +/- boundary from Daily Open (Mode 3 Body Retrace active)
   ZONE_CEILING_EXTREME  = 1,    // >= +boundary pts above Daily Open  (Mode 2 Sell Fade active)
   ZONE_FLOOR_EXTREME    = 2     // <= -boundary pts below Daily Open   (Mode 2 Buy Fade active)
};

// Strategy mode label (for logging/HUD)
enum ENUM_STRATEGY_MODE
{
   MODE_NONE             = 0,
   MODE_3_BODY_RETRACE   = 3,    // Mirror last candle, enter at X% into body
   MODE_2_DAILY_FADE     = 2     // Boundary mean-reversion fade
};
