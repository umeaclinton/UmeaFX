//+------------------------------------------------------------------+
//|                                                 TradeManager.mqh |
//|                             UmeaFX FX Vol 60 Synthetic Engine    |
//|                                  Copyright 2026, UmeaFX Project. |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, UmeaFX Project."
#property link      "https://www.umeafx.com"

#include <Trade\Trade.mqh>
#include <Trade\OrderInfo.mqh>
#include <Trade\PositionInfo.mqh>

class CTradeManager
{
private:
   string         m_symbol;
   ulong          m_magic;
   double         m_fixed_lot;
   double         m_risk_percent;
   bool           m_use_fixed_lot;
   int            m_max_daily_losses;

   // Breakeven Settings
   bool           m_enable_be;
   double         m_be_trigger_pts;
   double         m_be_lock_pts;

   CTrade         m_trade;
   COrderInfo     m_order_info;
   CPositionInfo  m_position_info;

   int            m_daily_losses;
   datetime       m_current_day;

public:
   CTradeManager()
   {
      m_magic            = 606060;
      m_fixed_lot        = 0.10;
      m_risk_percent     = 1.0;
      m_use_fixed_lot    = false;
      m_max_daily_losses = 2;
      m_enable_be        = false;
      m_be_trigger_pts   = 300.0;
      m_be_lock_pts      = 15.0;
      m_daily_losses     = 0;
      m_current_day      = 0;
   }

   void Init(string symbol, ulong magic, bool use_fixed_lot, double fixed_lot, double risk_percent,
             int max_daily_losses=2, bool enable_be=false, double be_trigger=300.0, double be_lock=15.0)
   {
      m_symbol           = symbol;
      m_magic            = magic;
      m_use_fixed_lot    = use_fixed_lot;
      m_fixed_lot        = fixed_lot;
      m_risk_percent     = risk_percent;
      m_max_daily_losses = max_daily_losses;
      m_enable_be        = enable_be;
      m_be_trigger_pts   = be_trigger;
      m_be_lock_pts      = be_lock;

      m_trade.SetExpertMagicNumber(m_magic);
      m_trade.SetDeviationInPoints(20);
      m_trade.SetTypeFilling(ORDER_FILLING_IOC);
   }

   void CheckDailyReset(datetime current_time)
   {
      MqlDateTime dt;
      TimeToStruct(current_time, dt);
      datetime day_start = StringToTime(StringFormat("%04d.%02d.%02d 00:00", dt.year, dt.mon, dt.day));

      if(day_start != m_current_day)
      {
         m_current_day  = day_start;
         m_daily_losses = 0;
      }
   }

   bool IsCircuitBreakerHit() const
   {
      return (m_daily_losses >= m_max_daily_losses);
   }

   void RegisterLoss()
   {
      m_daily_losses++;
      Print("Daily loss recorded! Total today: ", m_daily_losses, " / Max allowed: ", m_max_daily_losses);
   }

   double CalculateLotSize(double entry_price, double stop_loss)
   {
      if(m_use_fixed_lot)
         return m_fixed_lot;

      double balance = AccountInfoDouble(ACCOUNT_BALANCE);
      double risk_amount = balance * (m_risk_percent / 100.0);

      double distance = MathAbs(entry_price - stop_loss);
      if(distance <= 0)
         return 0.01;

      double tick_size  = SymbolInfoDouble(m_symbol, SYMBOL_TRADE_TICK_SIZE);
      double tick_value = SymbolInfoDouble(m_symbol, SYMBOL_TRADE_TICK_VALUE);
      double point      = SymbolInfoDouble(m_symbol, SYMBOL_POINT);

      if(tick_size <= 0 || tick_value <= 0 || point <= 0)
         return 0.01;

      double money_per_lot = (distance / tick_size) * tick_value;
      if(money_per_lot <= 0)
         return 0.01;

      double calculated_lots = risk_amount / money_per_lot;

      double min_lot  = SymbolInfoDouble(m_symbol, SYMBOL_VOLUME_MIN);
      double max_lot  = SymbolInfoDouble(m_symbol, SYMBOL_VOLUME_MAX);
      double lot_step = SymbolInfoDouble(m_symbol, SYMBOL_VOLUME_STEP);

      calculated_lots = MathFloor(calculated_lots / lot_step) * lot_step;
      calculated_lots = MathMax(min_lot, MathMin(max_lot, calculated_lots));

      return calculated_lots;
   }

   int TotalActive()
   {
      int count = 0;
      for(int i = OrdersTotal() - 1; i >= 0; i--)
      {
         if(m_order_info.SelectByIndex(i))
         {
            if(m_order_info.Symbol() == m_symbol && m_order_info.Magic() == m_magic)
               count++;
         }
      }
      for(int i = PositionsTotal() - 1; i >= 0; i--)
      {
         if(m_position_info.SelectByIndex(i))
         {
            if(m_position_info.Symbol() == m_symbol && m_position_info.Magic() == m_magic)
               count++;
         }
      }
      return count;
   }

   void CancelPendingOrders()
   {
      for(int i = OrdersTotal() - 1; i >= 0; i--)
      {
         if(m_order_info.SelectByIndex(i))
         {
            if(m_order_info.Symbol() == m_symbol && m_order_info.Magic() == m_magic)
            {
               m_trade.OrderDelete(m_order_info.Ticket());
            }
         }
      }
   }

   bool PlaceBuyLimit(double entry_price, double stop_loss, double take_profit, string comment="FXVol60 BuyLimit")
   {
      double volume = CalculateLotSize(entry_price, stop_loss);
      int digits = (int)SymbolInfoInteger(m_symbol, SYMBOL_DIGITS);

      entry_price = NormalizeDouble(entry_price, digits);
      stop_loss   = NormalizeDouble(stop_loss, digits);
      take_profit = NormalizeDouble(take_profit, digits);

      return m_trade.BuyLimit(volume, entry_price, m_symbol, stop_loss, take_profit, ORDER_TIME_GTC, 0, comment);
   }

   bool PlaceSellLimit(double entry_price, double stop_loss, double take_profit, string comment="FXVol60 SellLimit")
   {
      double volume = CalculateLotSize(entry_price, stop_loss);
      int digits = (int)SymbolInfoInteger(m_symbol, SYMBOL_DIGITS);

      entry_price = NormalizeDouble(entry_price, digits);
      stop_loss   = NormalizeDouble(stop_loss, digits);
      take_profit = NormalizeDouble(take_profit, digits);

      return m_trade.SellLimit(volume, entry_price, m_symbol, stop_loss, take_profit, ORDER_TIME_GTC, 0, comment);
   }

   bool BuyMarket(double stop_loss, double take_profit, string comment="FXVol60 BuyMarket")
   {
      double ask = SymbolInfoDouble(m_symbol, SYMBOL_ASK);
      double volume = CalculateLotSize(ask, stop_loss);
      int digits = (int)SymbolInfoInteger(m_symbol, SYMBOL_DIGITS);

      stop_loss   = NormalizeDouble(stop_loss, digits);
      take_profit = NormalizeDouble(take_profit, digits);

      return m_trade.Buy(volume, m_symbol, ask, stop_loss, take_profit, comment);
   }

   bool SellMarket(double stop_loss, double take_profit, string comment="FXVol60 SellMarket")
   {
      double bid = SymbolInfoDouble(m_symbol, SYMBOL_BID);
      double volume = CalculateLotSize(bid, stop_loss);
      int digits = (int)SymbolInfoInteger(m_symbol, SYMBOL_DIGITS);

      stop_loss   = NormalizeDouble(stop_loss, digits);
      take_profit = NormalizeDouble(take_profit, digits);

      return m_trade.Sell(volume, m_symbol, bid, stop_loss, take_profit, comment);
   }

   // Manage Breakeven on open positions
   void ManageBreakeven()
   {
      if(!m_enable_be)
         return;

      int digits = (int)SymbolInfoInteger(m_symbol, SYMBOL_DIGITS);

      for(int i = PositionsTotal() - 1; i >= 0; i--)
      {
         if(m_position_info.SelectByIndex(i))
         {
            if(m_position_info.Symbol() == m_symbol && m_position_info.Magic() == m_magic)
            {
               double open_p  = m_position_info.PriceOpen();
               double curr_sl = m_position_info.StopLoss();
               double tp      = m_position_info.TakeProfit();

               if(m_position_info.PositionType() == POSITION_TYPE_BUY)
               {
                  double bid = SymbolInfoDouble(m_symbol, SYMBOL_BID);
                  double profit_pts = bid - open_p;

                  // If profit reached trigger and SL is still below BE level
                  double new_sl = NormalizeDouble(open_p + m_be_lock_pts, digits);
                  if(profit_pts >= m_be_trigger_pts && curr_sl < new_sl)
                  {
                     if(m_trade.PositionModify(m_position_info.Ticket(), new_sl, tp))
                     {
                        Print(">> BUY Position modified to BREAKEVEN at: ", new_sl, " (Locked +", m_be_lock_pts, " pts)");
                     }
                  }
               }
               else if(m_position_info.PositionType() == POSITION_TYPE_SELL)
               {
                  double ask = SymbolInfoDouble(m_symbol, SYMBOL_ASK);
                  double profit_pts = open_p - ask;

                  double new_sl = NormalizeDouble(open_p - m_be_lock_pts, digits);
                  if(profit_pts >= m_be_trigger_pts && (curr_sl == 0 || curr_sl > new_sl))
                  {
                     if(m_trade.PositionModify(m_position_info.Ticket(), new_sl, tp))
                     {
                        Print(">> SELL Position modified to BREAKEVEN at: ", new_sl, " (Locked +", m_be_lock_pts, " pts)");
                     }
                  }
               }
            }
         }
      }
   }
};
