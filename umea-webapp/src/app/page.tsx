"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  ShieldCheck, 
  Zap, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  ArrowRight, 
  Lock, 
  Sparkles,
  Activity,
  Sliders,
  Cpu,
  ChevronRight,
  BarChart3,
  Server
} from "lucide-react";
import { supabasePublic } from "@/lib/supabase";

export default function HomePage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"ib_free_trial" | "monthly_sub">("ib_free_trial");
  const [paymentGateway, setPaymentGateway] = useState<"paystack" | "crypto">("paystack");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Interactive Calculator State
  const [calcBalance, setCalcBalance] = useState<number>(1000);
  const [calcRisk, setCalcRisk] = useState<number>(1.0);

  const handleQuickLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsProcessingPayment(true);
    
    // Store session locally
    localStorage.setItem("umea_user_email", email);
    localStorage.setItem("umea_user_name", name || email.split("@")[0]);
    localStorage.setItem("umea_selected_plan", selectedPlan);
    
    // If Paid Monthly Plan selected
    if (selectedPlan === "monthly_sub") {
      try {
        if (paymentGateway === "crypto") {
          const res = await fetch("/api/crypto/initialize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, name: name || email.split("@")[0], amount: 49.0 }),
          });
          const data = await res.json();
          if (data.success && data.invoiceUrl) {
            window.location.href = data.invoiceUrl;
            return;
          }
        } else {
          const res = await fetch("/api/paystack/initialize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email,
              name: name || email.split("@")[0],
              plan: "monthly_sub",
              amount: 75000,
            }),
          });
          const data = await res.json();
          if (data.success && data.authorizationUrl) {
            window.location.href = data.authorizationUrl;
            return;
          }
        }
      } catch (err) {
        console.error("Payment checkout error:", err);
      }
    }

    // Default: Register plan and proceed to dashboard
    fetch("/api/select-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name: name || email.split("@")[0], plan: selectedPlan }),
    }).finally(() => {
      setIsProcessingPayment(false);
      router.push("/dashboard");
    });
  };

  return (
    <main className="min-h-screen bg-[#080B11] text-slate-100 flex flex-col justify-between selection:bg-emerald-500 selection:text-black">
      {/* Floating Glass Header */}
      <header className="border-b border-slate-800/80 backdrop-blur-xl sticky top-0 z-40 bg-[#080B11]/80 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-400 p-[1px] shadow-lg shadow-emerald-500/20">
              <div className="w-full h-full bg-[#080B11] rounded-2xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-tight text-white">
                  Umea<span className="text-emerald-400">FX</span>
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  ENGINE LIVE
                </span>
              </div>
              <span className="block text-[10px] uppercase tracking-widest font-mono text-slate-400 font-semibold">
                Autonomous Synthetic System
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setSelectedPlan("ib_free_trial");
                setIsModalOpen(true);
              }}
              className="px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all duration-200 shadow-lg shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98]"
            >
              Connect MT5
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative px-4 sm:px-6 pt-16 pb-20 lg:pt-24 lg:pb-28 max-w-7xl mx-auto flex flex-col items-center text-center">
        {/* Market Status Pill */}
        <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-xs font-semibold mb-8 text-slate-300 shadow-inner">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-mono text-emerald-400">FX Vol 60</span>
          <span className="text-slate-600">•</span>
          <span>Continuous 24/7/365 Execution</span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white max-w-5xl leading-[1.08]">
          Institutional Algorithmic Trading.{" "}
          <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
            Automated Directly to Your MT5.
          </span>
        </h1>

        <p className="mt-6 text-base sm:text-xl text-slate-400 max-w-3xl leading-relaxed">
          Link your Weltrade MT5 account in under 60 seconds. Our cloud-hosted quantitative algorithm executes proprietary volatility setups directly onto your account around the clock—with zero manual intervention required.
        </p>

        {/* Hero CTAs */}
        <div className="mt-10 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <button
            onClick={() => {
              setSelectedPlan("ib_free_trial");
              setIsModalOpen(true);
            }}
            className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 text-slate-950 font-black text-sm sm:text-base hover:brightness-110 shadow-xl shadow-emerald-500/25 transition-all flex items-center justify-center gap-2.5 hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>Start 7-Day Partner Access</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setSelectedPlan("monthly_sub");
              setIsModalOpen(true);
            }}
            className="w-full sm:w-auto px-8 py-4 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-200 font-bold text-sm sm:text-base hover:bg-slate-800/80 hover:border-slate-700 transition-all flex items-center justify-center gap-2"
          >
            <span>Direct Membership ($49/mo)</span>
          </button>
        </div>

        {/* Live Architecture Execution Visualizer Card */}
        <div className="w-full max-w-5xl mt-16 p-5 sm:p-8 rounded-3xl glass-card border border-slate-800/80 text-left relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between pb-6 mb-6 border-b border-slate-800/60 gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <Cpu className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Autonomous Execution Architecture
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Fully managed cloud system. No VPS needed, no local software, zero device battery drain.
              </p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-xs font-semibold">
              <Activity className="w-3.5 h-3.5 animate-pulse" />
              <span>Execution Latency: &lt;15ms</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Step 1 */}
            <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between">
              <div>
                <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Layer 1 • Quantitative</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                </div>
                <h4 className="text-sm font-bold text-white mb-1">FX Vol 60 Algorithm</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Continuously scans the 24/7 synthetic stream on the H1 timeframe for directional volume displacement and trend continuation.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800/50 flex items-center justify-between text-[11px] font-mono text-emerald-400">
                <span>Signal Frequency</span>
                <span className="font-bold">24/7 Non-Stop</span>
              </div>
            </div>

            {/* Step 2 */}
            <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between">
              <div>
                <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Layer 2 • Risk Guard</span>
                  <span className="w-2 h-2 rounded-full bg-teal-400" />
                </div>
                <h4 className="text-sm font-bold text-white mb-1">Dynamic Risk Control</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Automated Breakeven protection locks gains once in profit. Adaptive trailing and daily safety circuit breakers secure capital.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800/50 flex items-center justify-between text-[11px] font-mono text-teal-400">
                <span>Protection Model</span>
                <span className="font-bold">Auto Breakeven</span>
              </div>
            </div>

            {/* Step 3 */}
            <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between">
              <div>
                <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Layer 3 • Broker Sync</span>
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                </div>
                <h4 className="text-sm font-bold text-white mb-1">Direct MT5 Execution</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Trades are filled natively on your Weltrade MT5 account in under 15ms. Sized to your exact risk settings and account balance.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800/50 flex items-center justify-between text-[11px] font-mono text-cyan-400">
                <span>Client Terminal</span>
                <span className="font-bold">Zero Setup Needed</span>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 text-left w-full">
          <div className="p-7 rounded-3xl glass-card glass-card-hover">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-5 text-emerald-400 shadow-inner">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">High-Speed Execution</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Ultra-low latency connection triggers trades the microsecond institutional criteria are verified, ensuring minimal slippage.
            </p>
          </div>

          <div className="p-7 rounded-3xl glass-card glass-card-hover">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mb-5 text-teal-400 shadow-inner">
              <Clock className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">24/7/365 Synthetics</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Unlike traditional Forex or equities, synthetic volatility markets never close for weekends or bank holidays. Continuous operation.
            </p>
          </div>

          <div className="p-7 rounded-3xl glass-card glass-card-hover">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-5 text-cyan-400 shadow-inner">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Bank-Grade Encryption</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              All broker trade passwords are encrypted with military-grade AES-256-GCM authenticated encryption before being stored.
            </p>
          </div>
        </div>
      </section>

      {/* Interactive Sizing & Risk Simulator */}
      <section className="px-4 sm:px-6 py-20 bg-[#0B0F17] border-y border-slate-800/80">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-mono font-semibold text-slate-400 mb-3">
              <Sliders className="w-3.5 h-3.5 text-emerald-400" />
              <span>Risk Management Calculator</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Predictable, Controlled Position Sizing
            </h2>
            <p className="mt-3 text-slate-400 text-sm sm:text-base max-w-xl mx-auto">
              Simulate how your account automatically scales trade volume to preserve capital.
            </p>
          </div>

          <div className="p-6 sm:p-10 rounded-3xl glass-card border border-slate-800/80">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-300 mb-2 font-mono">
                    <span>Account Balance</span>
                    <span className="text-emerald-400 font-bold">${calcBalance.toLocaleString()} USD</span>
                  </div>
                  <input
                    type="range"
                    min="100"
                    max="10000"
                    step="100"
                    value={calcBalance}
                    onChange={(e) => setCalcBalance(Number(e.target.value))}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                  />
                  <div className="flex justify-between text-[11px] text-slate-400 mt-1 font-mono">
                    <span>$100</span>
                    <span>$5,000</span>
                    <span>$10,000</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-300 mb-2 font-mono">
                    <span>Risk Multiplier</span>
                    <span className="text-teal-400 font-bold">{calcRisk.toFixed(1)}x Master Lot</span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="2.0"
                    step="0.1"
                    value={calcRisk}
                    onChange={(e) => setCalcRisk(Number(e.target.value))}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-400"
                  />
                  <div className="flex justify-between text-[11px] text-slate-400 mt-1 font-mono">
                    <span>0.2x (Conservative)</span>
                    <span>1.0x (Standard)</span>
                    <span>2.0x (Aggressive)</span>
                  </div>
                </div>
              </div>

              {/* Simulation Result Card */}
              <div className="p-6 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
                <div className="text-xs font-mono uppercase tracking-wider text-slate-400">
                  Calculated Order Specifications
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80">
                    <div className="text-[11px] text-slate-400">Target Asset</div>
                    <div className="text-sm font-bold text-white mt-1">FX Vol 60</div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80">
                    <div className="text-[11px] text-slate-400">Approx. Lot Size</div>
                    <div className="text-sm font-bold text-emerald-400 mt-1">
                      {(Math.max(0.01, (calcBalance / 500) * 0.02 * calcRisk)).toFixed(2)} Lots
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80">
                    <div className="text-[11px] text-slate-400">Default Risk Ratio</div>
                    <div className="text-sm font-bold text-white mt-1">1:2 R:R (30 / 60 pts)</div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80">
                    <div className="text-[11px] text-slate-400">Breakeven Offset</div>
                    <div className="text-sm font-bold text-teal-400 mt-1">Auto at +15 pts</div>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed italic">
                  * Dynamic lot sizing scales with your balance while adhering strictly to your safety lot caps.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing & Access Options Section */}
      <section className="px-4 sm:px-6 py-24 max-w-6xl mx-auto text-center w-full">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Select Your Access Tier
        </h2>
        <p className="mt-3 text-slate-400 max-w-xl mx-auto text-sm sm:text-base">
          Start 100% free for 7 days via our partner network, or subscribe directly. Cancel anytime.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12 max-w-4xl mx-auto text-left">
          {/* IB Free Plan */}
          <div className="relative p-7 sm:p-9 rounded-3xl bg-gradient-to-b from-emerald-950/30 via-[#0E1420] to-[#0E1420] border-2 border-emerald-500/50 shadow-2xl shadow-emerald-500/10 flex flex-col justify-between">
            <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-emerald-500 text-slate-950 text-[11px] font-black uppercase tracking-wider">
              Recommended
            </div>
            <div>
              <div className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider mb-2">
                Partner Tier
              </div>
              <div className="text-4xl font-black text-white mb-1">
                FREE <span className="text-base text-slate-400 font-normal">/ 7 Days</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mb-6">
                Open an account under our Weltrade Partner ID and receive 7 days of full autonomous execution at zero cost.
              </p>

              <ul className="space-y-3.5 mb-8 text-xs sm:text-sm text-slate-300">
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Full access to FX Vol 60 Autonomous System</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Automated Breakeven & Stop Loss Sync</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Sub-15ms cloud execution pipeline</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>No VPS required — 100% hands-free</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => {
                setSelectedPlan("ib_free_trial");
                setIsModalOpen(true);
              }}
              className="w-full py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm transition-all shadow-lg shadow-emerald-500/25 hover:scale-[1.01] active:scale-[0.99]"
            >
              Activate 7-Day Partner Pass
            </button>
          </div>

          {/* Direct Monthly Plan */}
          <div className="p-7 sm:p-9 rounded-3xl glass-card border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-2">
                Independent Membership
              </div>
              <div className="text-4xl font-black text-white mb-1">
                $49 <span className="text-base text-slate-400 font-normal">/ month</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mb-6">
                Direct monthly subscription for any Weltrade MT5 account. Switch or cancel at any time.
              </p>

              <ul className="space-y-3.5 mb-8 text-xs sm:text-sm text-slate-300">
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Full access to FX Vol 60 Autonomous System</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Customizable risk multiplier & safety caps</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Priority execution bandwidth</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Pay via Card, Bank Transfer, or Crypto</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => {
                setSelectedPlan("monthly_sub");
                setIsModalOpen(true);
              }}
              className="w-full py-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              Subscribe Directly ($49/mo)
            </button>
          </div>
        </div>
      </section>

      {/* Auth / Sign Up Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0D121C] border border-slate-800 rounded-3xl max-w-md w-full p-6 sm:p-8 relative shadow-2xl">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-900 border border-slate-800 text-slate-400 hover:text-white flex items-center justify-center text-sm font-bold transition"
            >
              ✕
            </button>

            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-3 text-emerald-400">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-black text-white tracking-tight">Access UmeaFX Portal</h3>
              <p className="text-xs text-slate-400 mt-1">
                Selected:{" "}
                <span className="text-emerald-400 font-bold uppercase font-mono">
                  {selectedPlan === "ib_free_trial" ? "7-Day Partner Pass" : "Direct Membership ($49)"}
                </span>
              </p>
            </div>

            {/* Google 1-Click Button */}
            <button
              onClick={async () => {
                const { error } = await supabasePublic.auth.signInWithOAuth({
                  provider: "google",
                  options: {
                    redirectTo: `${window.location.origin}/auth/callback`,
                  },
                });
                if (error) {
                  console.error("Google Auth error:", error.message);
                }
              }}
              className="w-full py-3.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm transition-all flex items-center justify-center gap-3 mb-4 shadow-md hover:scale-[1.01]"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            <div className="relative flex items-center justify-center my-5">
              <div className="border-t border-slate-800 w-full"></div>
              <span className="bg-[#0D121C] px-3 text-[10px] text-slate-500 font-mono font-semibold uppercase tracking-wider">
                Or with email
              </span>
            </div>

            <form onSubmit={handleQuickLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Alex Trader"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-white text-sm focus:border-emerald-500 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-white text-sm focus:border-emerald-500 outline-none transition"
                />
              </div>

              {selectedPlan === "monthly_sub" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2">Payment Gateway</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPaymentGateway("paystack")}
                      className={`p-3 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-1 ${paymentGateway === "paystack" ? "bg-emerald-500/10 border-emerald-500 text-emerald-400" : "bg-slate-900 border-slate-800 text-slate-400"}`}
                    >
                      <span>💳 Paystack</span>
                      <span className="text-[10px] text-slate-500">Cards / Bank Transfer</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentGateway("crypto")}
                      className={`p-3 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-1 ${paymentGateway === "crypto" ? "bg-emerald-500/10 border-emerald-500 text-emerald-400" : "bg-slate-900 border-slate-800 text-slate-400"}`}
                    >
                      <span>⚡ Crypto (USDT)</span>
                      <span className="text-[10px] text-slate-500">TRC20 / BEP20 / BTC</span>
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isProcessingPayment}
                className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm transition-all mt-2 shadow-lg shadow-emerald-500/25 disabled:opacity-50"
              >
                {isProcessingPayment ? "Connecting..." : selectedPlan === "monthly_sub" ? `Proceed to Checkout ($49 via ${paymentGateway === "crypto" ? "Crypto" : "Paystack"}) →` : "Enter Portal →"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-900 px-4 sm:px-6 py-8 text-center text-xs text-slate-500">
        <p>&copy; 2026 UmeaFX Synthetics. Institutional Automated Execution Technology. All Rights Reserved.</p>
      </footer>
    </main>
  );
}
