//+------------------------------------------------------------------+
//|                                                 TradeManager.mqh |
//|                                  Copyright 2026, UmeaFX Project. |
//|                                       https://www.umeafx.com     |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, UmeaFX Project."
#property link      "https://www.umeafx.com"

#include <Trade\Trade.mqh>
#include <Trade\OrderInfo.mqh>
#include <Trade\PositionInfo.mqh>
#include "Defines.mqh"

class CTradeManager
{
private:
   string            m_symbol;
   ulong             m_magic;
   double            m_risk_percent;
   int               m_max_pending_bars;
   CTrade            m_trade;
   COrderInfo        m_order_info;
   CPositionInfo     m_position_info;

public:
   CTradeManager()
   {
      m_magic            = 123456;
      m_risk_percent     = 1.0;
      m_max_pending_bars = 16;
   }

   void Init(string symbol, ulong magic, double risk_percent, int max_pending_bars=16)
   {
      m_symbol           = symbol;
      m_magic            = magic;
      m_risk_percent     = risk_percent;
      m_max_pending_bars = max_pending_bars;

      m_trade.SetExpertMagicNumber(m_magic);
      m_trade.SetDeviationInPoints(10);
      m_trade.SetTypeFilling(ORDER_FILLING_IOC);
   }

   double CalculateLotSize(double entry_price, double stop_loss)
   {
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

      // Adjust to broker lot constraints
      double min_lot  = SymbolInfoDouble(m_symbol, SYMBOL_VOLUME_MIN);
      double max_lot  = SymbolInfoDouble(m_symbol, SYMBOL_VOLUME_MAX);
      double lot_step = SymbolInfoDouble(m_symbol, SYMBOL_VOLUME_STEP);

      calculated_lots = MathFloor(calculated_lots / lot_step) * lot_step;
      calculated_lots = MathMax(min_lot, MathMin(max_lot, calculated_lots));

      return calculated_lots;
   }

   int TotalActiveOrders()
   {
      int count = 0;
      // Pending orders
      for(int i = OrdersTotal() - 1; i >= 0; i--)
      {
         if(m_order_info.SelectByIndex(i))
         {
            if(m_order_info.Symbol() == m_symbol && m_order_info.Magic() == m_magic)
               count++;
         }
      }
      // Open positions
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

   bool PlaceBuyLimit(double entry_price, double stop_loss, double take_profit, datetime expiration=0)
   {
      double volume = CalculateLotSize(entry_price, stop_loss);
      int digits = (int)SymbolInfoInteger(m_symbol, SYMBOL_DIGITS);

      entry_price = NormalizeDouble(entry_price, digits);
      stop_loss   = NormalizeDouble(stop_loss, digits);
      take_profit = NormalizeDouble(take_profit, digits);

      return m_trade.BuyLimit(volume, entry_price, m_symbol, stop_loss, take_profit, ORDER_TIME_GTC, expiration, "UmeaFX-SMC BuyLimit");
   }

   bool PlaceSellLimit(double entry_price, double stop_loss, double take_profit, datetime expiration=0)
   {
      double volume = CalculateLotSize(entry_price, stop_loss);
      int digits = (int)SymbolInfoInteger(m_symbol, SYMBOL_DIGITS);

      entry_price = NormalizeDouble(entry_price, digits);
      stop_loss   = NormalizeDouble(stop_loss, digits);
      take_profit = NormalizeDouble(take_profit, digits);

      return m_trade.SellLimit(volume, entry_price, m_symbol, stop_loss, take_profit, ORDER_TIME_GTC, expiration, "UmeaFX-SMC SellLimit");
   }

   void CancelStaleOrders(datetime current_bar_time, int timeframe_seconds)
   {
      for(int i = OrdersTotal() - 1; i >= 0; i--)
      {
         if(m_order_info.SelectByIndex(i))
         {
            if(m_order_info.Symbol() == m_symbol && m_order_info.Magic() == m_magic)
            {
               datetime order_time = (datetime)m_order_info.TimeSetup();
               if(current_bar_time - order_time > (m_max_pending_bars * timeframe_seconds))
               {
                  m_trade.OrderDelete(m_order_info.Ticket());
               }
            }
         }
      }
   }
};
