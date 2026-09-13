//+------------------------------------------------------------------+
//|                                                      Defines.mqh |
//|                                  Copyright 2026, UmeaFX Project. |
//|                                       https://www.umeafx.com     |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, UmeaFX Project."
#property link      "https://www.umeafx.com"

//+------------------------------------------------------------------+
//| Enums for Market Structure & SMC Components                      |
//+------------------------------------------------------------------+
enum ENUM_SWING_TYPE
{
   SWING_TYPE_NONE = 0,
   SWING_TYPE_HIGH = 1,
   SWING_TYPE_LOW  = 2
};

enum ENUM_SWING_CLASS
{
   SWING_CLASS_NONE = 0,
   SWING_CLASS_HH   = 1,   // Higher High
   SWING_CLASS_LH   = 2,   // Lower High
   SWING_CLASS_HL   = 3,   // Higher Low
   SWING_CLASS_LL   = 4    // Lower Low
};

enum ENUM_MARKET_TREND
{
   TREND_NEUTRAL = 0,
   TREND_BULLISH = 1,
   TREND_BEARISH = 2
};

enum ENUM_STRUCTURE_EVENT
{
   EVENT_NONE            = 0,
   EVENT_BOS_BULLISH     = 1,
   EVENT_BOS_BEARISH     = 2,
   EVENT_CHOCH_BULLISH   = 3,
   EVENT_CHOCH_BEARISH   = 4,
   EVENT_SWEEP_BUYSIDE   = 5,
   EVENT_SWEEP_SELLSIDE  = 6
};

enum ENUM_FVG_TYPE
{
   FVG_TYPE_NONE    = 0,
   FVG_TYPE_BULLISH = 1,
   FVG_TYPE_BEARISH = 2
};

enum ENUM_FVG_STATUS
{
   FVG_UNMITIGATED        = 0,
   FVG_PARTIALLY_MITIGATED = 1,
   FVG_FULLY_MITIGATED    = 2,
   FVG_INVALIDATED        = 3
};

//+------------------------------------------------------------------+
//| Data Structures                                                  |
//+------------------------------------------------------------------+
struct SwingPoint
{
   int               bar_index;
   datetime          time;
   ENUM_SWING_TYPE   swing_type;
   double            price;
   ENUM_SWING_CLASS  classification;
   int               confirmed_bar_index;
   datetime          confirmed_time;
};

struct StructureEvent
{
   int                  bar_index;
   datetime             time;
   ENUM_STRUCTURE_EVENT event_type;
   double               level_broken;
   double               close_price;
   double               wick_extreme;
   ENUM_MARKET_TREND    trend_after;
};

struct FVGZone
{
   int               bar_index;        // Index of candle 2 (displacement candle)
   datetime          time;
   ENUM_FVG_TYPE     fvg_type;
   double            top;
   double            bottom;
   double            size;
   double            ce;               // Consequent Encroachment (50% midpoint)
   ENUM_FVG_STATUS   status;
};
