//+------------------------------------------------------------------+
//|                                                  SniperTrade.mqh |
//|                         UMEA Range Break 100 Sniper Engine       |
//|                                  Copyright 2026, UmeaFX Project. |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, UmeaFX Project."
#property link      "https://www.umeafx.com"

#include <Trade\Trade.mqh>
#include <Trade\PositionInfo.mqh>

class CSniperTrade
{
private:
   string         m_symbol;
   ulong          m_magic;
   double         m_fixed_lot;
   bool           m_use_fixed_lot;
   double         m_risk_percent;
   CTrade         m_trade;
   CPositionInfo  m_pos;

public:
   CSniperTrade()
   {
      m_symbol        = _Symbol;
      m_magic         = 707070;
      m_fixed_lot     = 0.05;
      m_use_fixed_lot = true;
      m_risk_percent  = 1.0;
   }

   void Init(string symbol, ulong magic, bool use_fixed_lot, double fixed_lot, double risk_percent)
   {
      m_symbol        = symbol;
      m_magic         = magic;
      m_use_fixed_lot = use_fixed_lot;
      m_fixed_lot     = fixed_lot;
      m_risk_percent  = risk_percent;

      m_trade.SetExpertMagicNumber(m_magic);
      m_trade.SetDeviationInPoints(10);

      // Auto-detect optimal filling mode for Deriv
      uint filling = (uint)SymbolInfoInteger(m_symbol, SYMBOL_FILLING_MODE);
      if((filling & SYMBOL_FILLING_FOK) != 0)
         m_trade.SetTypeFilling(ORDER_FILLING_FOK);
      else if((filling & SYMBOL_FILLING_IOC) != 0)
         m_trade.SetTypeFilling(ORDER_FILLING_IOC);
      else
         m_trade.SetTypeFilling(ORDER_FILLING_RETURN);
   }

   double CalculateLot(double estimated_risk_pts = 50.0)
   {
      if(m_use_fixed_lot)
         return m_fixed_lot;

      double balance = AccountInfoDouble(ACCOUNT_BALANCE);
      double risk_amount = balance * (m_risk_percent / 100.0);
      double tick_value = SymbolInfoDouble(m_symbol, SYMBOL_TRADE_TICK_VALUE);
      double tick_size  = SymbolInfoDouble(m_symbol, SYMBOL_TRADE_TICK_SIZE);

      if(tick_value <= 0 || tick_size <= 0)
         return m_fixed_lot;

      double loss_per_lot = (estimated_risk_pts / tick_size) * tick_value;
      double lots = risk_amount / loss_per_lot;

      double min_lot  = SymbolInfoDouble(m_symbol, SYMBOL_VOLUME_MIN);
      double max_lot  = SymbolInfoDouble(m_symbol, SYMBOL_VOLUME_MAX);
      double lot_step = SymbolInfoDouble(m_symbol, SYMBOL_VOLUME_STEP);

      lots = MathFloor(lots / lot_step) * lot_step;
      return MathMax(min_lot, MathMin(max_lot, lots));
   }

   int TotalActive()
   {
      int count = 0;
      for(int i = PositionsTotal() - 1; i >= 0; i--)
      {
         if(m_pos.SelectByIndex(i))
         {
            if(m_pos.Symbol() == m_symbol && m_pos.Magic() == m_magic)
               count++;
         }
      }
      return count;
   }

   // Instant Sell at Buy Spike peak
   bool SellAtPeak(double take_profit_pts, string comment = "RB100-FadeSell")
   {
      double bid = SymbolInfoDouble(m_symbol, SYMBOL_BID);
      int digits = (int)SymbolInfoInteger(m_symbol, SYMBOL_DIGITS);
      double volume = CalculateLot();

      double tp = 0.0;
      if(take_profit_pts > 0)
         tp = NormalizeDouble(bid - take_profit_pts, digits);

      // Fast execution without SL (as per spike gap mechanics)
      bool res = m_trade.Sell(volume, m_symbol, bid, 0.0, tp, comment);
      if(!res)
      {
         // Retry with IOC if FOK fails
         m_trade.SetTypeFilling(ORDER_FILLING_IOC);
         res = m_trade.Sell(volume, m_symbol, bid, 0.0, tp, comment);
      }
      return res;
   }

   // Instant Buy at Sell Spike bottom
   bool BuyAtBottom(double take_profit_pts, string comment = "RB100-FadeBuy")
   {
      double ask = SymbolInfoDouble(m_symbol, SYMBOL_ASK);
      int digits = (int)SymbolInfoInteger(m_symbol, SYMBOL_DIGITS);
      double volume = CalculateLot();

      double tp = 0.0;
      if(take_profit_pts > 0)
         tp = NormalizeDouble(ask + take_profit_pts, digits);

      bool res = m_trade.Buy(volume, m_symbol, ask, 0.0, tp, comment);
      if(!res)
      {
         m_trade.SetTypeFilling(ORDER_FILLING_IOC);
         res = m_trade.Buy(volume, m_symbol, ask, 0.0, tp, comment);
      }
      return res;
   }

   // Real-time tick monitor: Closes position immediately if profit target points reached
   void CheckQuickClose(double target_pts)
   {
      if(target_pts <= 0)
         return;

      for(int i = PositionsTotal() - 1; i >= 0; i--)
      {
         if(m_pos.SelectByIndex(i))
         {
            if(m_pos.Symbol() == m_symbol && m_pos.Magic() == m_magic)
            {
               double open_p = m_pos.PriceOpen();
               if(m_pos.PositionType() == POSITION_TYPE_BUY)
               {
                  double bid = SymbolInfoDouble(m_symbol, SYMBOL_BID);
                  if((bid - open_p) >= target_pts)
                  {
                     m_trade.PositionClose(m_pos.Ticket());
                     Print(">> 🎯 [SNIPER TP HIT] BUY closed at Bid: ", bid, " (Profit: +", (bid - open_p), " pts)");
                  }
               }
               else if(m_pos.PositionType() == POSITION_TYPE_SELL)
               {
                  double ask = SymbolInfoDouble(m_symbol, SYMBOL_ASK);
                  if((open_p - ask) >= target_pts)
                  {
                     m_trade.PositionClose(m_pos.Ticket());
                     Print(">> 🎯 [SNIPER TP HIT] SELL closed at Ask: ", ask, " (Profit: +", (open_p - ask), " pts)");
                  }
               }
            }
         }
      }
   }

   // Force close all positions opened by this EA (e.g., on 14-min hard timeout)
   void ForceCloseAll(string reason = "14-min Hard Timeout")
   {
      for(int i = PositionsTotal() - 1; i >= 0; i--)
      {
         if(m_pos.SelectByIndex(i))
         {
            if(m_pos.Symbol() == m_symbol && m_pos.Magic() == m_magic)
            {
               ulong ticket = m_pos.Ticket();
               double profit = m_pos.Profit();
               if(m_trade.PositionClose(ticket))
               {
                  PrintFormat(">> ⚠️ [FORCE CLOSE] Position #%I64u closed at market (Reason: %s | P/L: $%.2f)",
                              ticket, reason, profit);
               }
            }
         }
      }
   }
};
