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
  Award
} from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"ib_free_trial" | "monthly_sub">("ib_free_trial");

  const handleQuickLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    // Store session locally for demo/app state
    localStorage.setItem("umea_user_email", email);
    localStorage.setItem("umea_user_name", name || email.split("@")[0]);
    localStorage.setItem("umea_selected_plan", selectedPlan);
    
    // Register initial user state
    fetch("/api/select-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name: name || email.split("@")[0], plan: selectedPlan }),
    }).finally(() => {
      router.push("/dashboard");
    });
  };

  return (
    <main className="min-h-screen bg-[#090D14] flex flex-col justify-between">
      {/* Navigation */}
      <header className="border-b border-gray-800/80 backdrop-blur-md sticky top-0 z-40 bg-[#090D14]/80">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-gray-200 to-emerald-400 bg-clip-text text-transparent">
                UmeaFX
              </span>
              <span className="block text-[10px] uppercase tracking-widest font-mono text-emerald-400 font-bold">
                Synthetic Engine
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-black transition-all duration-200 shadow-md shadow-emerald-500/20 hover:scale-[1.02]"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative px-6 py-20 lg:py-28 max-w-6xl mx-auto text-center flex flex-col items-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs font-semibold mb-8 animate-pulse">
          <Sparkles className="w-3.5 h-3.5" />
          <span>24/7/365 Algorithmic Trade Copying on FX Vol 60</span>
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white max-w-4xl leading-[1.1]">
          Institutional Synthetic Trading.{" "}
          <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
            Copied Instantly.
          </span>
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-gray-400 max-w-2xl leading-relaxed">
          Connect your Weltrade MT5 account in 60 seconds. Our high-conviction statistical engine executes precision 12% body-retracements automatically to your account with zero setup.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <button
            onClick={() => {
              setSelectedPlan("ib_free_trial");
              setIsModalOpen(true);
            }}
            className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-black font-bold text-base hover:brightness-110 shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
          >
            <span>Start 1-Week Free Trial</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setSelectedPlan("monthly_sub");
              setIsModalOpen(true);
            }}
            className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gray-900 border border-gray-800 text-gray-200 font-semibold text-base hover:bg-gray-800 transition-all flex items-center justify-center gap-2"
          >
            <span>View Pricing ($49/mo)</span>
          </button>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20 text-left w-full">
          <div className="p-6 rounded-2xl bg-[#0E1420] border border-gray-800/80 hover:border-emerald-500/30 transition-all">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-5 text-emerald-400">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">&lt;15ms Copier Speed</h3>
            <p className="text-sm text-gray-400">
              Sub-millisecond trade replication directly to your Weltrade MT5 account with automated Breakeven protection.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#0E1420] border border-gray-800/80 hover:border-emerald-500/30 transition-all">
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mb-5 text-teal-400">
              <Clock className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">24/7/365 Non-Stop</h3>
            <p className="text-sm text-gray-400">
              Synthetics never close. The engine scans every 1-hour candle day and night, including weekends and holidays.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#0E1420] border border-gray-800/80 hover:border-emerald-500/30 transition-all">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-5 text-cyan-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Built-in Risk Management</h3>
            <p className="text-sm text-gray-400">
              Strict 200 pt stop loss, 400 pt take profit (1:2 R:R), plus daily circuit breakers to prevent overtrading.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing & IB Options Section */}
      <section className="px-6 py-20 bg-[#0B0F17] border-t border-gray-800/60">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
            Choose Your Access Option
          </h2>
          <p className="mt-3 text-gray-400 max-w-xl mx-auto">
            Get 100% free access for 7 days by joining our partner network, or subscribe directly.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12 max-w-4xl mx-auto text-left">
            {/* IB Free Plan */}
            <div className="relative p-8 rounded-3xl bg-gradient-to-b from-emerald-950/40 to-[#0E1420] border-2 border-emerald-500/50 shadow-xl shadow-emerald-500/10">
              <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-emerald-500 text-black text-xs font-black uppercase tracking-wider">
                Most Popular
              </div>
              <div className="text-sm font-bold text-emerald-400 uppercase tracking-wider mb-2">
                IB Partner Pass
              </div>
              <div className="text-4xl font-black text-white mb-1">
                FREE <span className="text-lg text-gray-400 font-normal">/ 7 Days</span>
              </div>
              <p className="text-sm text-gray-400 mb-6">
                Open a new Weltrade account under our Partner ID and get 7 days full automated copying free.
              </p>

              <ul className="space-y-3 mb-8 text-sm text-gray-300">
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Full access to FX Vol 60 Master Bot</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Instant 1-click MT5 connection</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Automated Breakeven & SL/TP Sync</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Option to renew via subscription after 7 days</span>
                </li>
              </ul>

              <button
                onClick={() => {
                  setSelectedPlan("ib_free_trial");
                  setIsModalOpen(true);
                }}
                className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-all shadow-md shadow-emerald-500/20"
              >
                Claim 7-Day Free Trial
              </button>
            </div>

            {/* Direct Monthly Plan */}
            <div className="p-8 rounded-3xl bg-[#0E1420] border border-gray-800">
              <div className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">
                Standard SaaS
              </div>
              <div className="text-4xl font-black text-white mb-1">
                $49 <span className="text-lg text-gray-400 font-normal">/ month</span>
              </div>
              <p className="text-sm text-gray-400 mb-6">
                Direct monthly subscription for existing Weltrade or private accounts. Cancel anytime.
              </p>

              <ul className="space-y-3 mb-8 text-sm text-gray-300">
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Full access to FX Vol 60 Master Bot</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Custom risk multiplier settings</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>VIP Priority Execution Channel</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>24/7 Dedicated Support</span>
                </li>
              </ul>

              <button
                onClick={() => {
                  setSelectedPlan("monthly_sub");
                  setIsModalOpen(true);
                }}
                className="w-full py-3.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-bold text-sm transition-all"
              >
                Subscribe Now ($49/mo)
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Auth / Sign Up Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0E1420] border border-gray-800 rounded-3xl max-w-md w-full p-8 relative shadow-2xl">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 text-gray-400 hover:text-white text-lg font-bold"
            >
              ✕
            </button>

            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-3 text-emerald-400">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold text-white">Access UmeaFX Copier</h3>
              <p className="text-xs text-gray-400 mt-1">
                Selected Plan:{" "}
                <span className="text-emerald-400 font-bold uppercase">
                  {selectedPlan === "ib_free_trial" ? "7-Day IB Free Trial" : "Monthly Sub ($49)"}
                </span>
              </p>
            </div>

            {/* Google 1-Click Button Simulation */}
            <button
              onClick={() => {
                const sampleEmail = "trader@" + Math.random().toString(36).substring(7) + ".com";
                setEmail(sampleEmail);
                setName("Google Trader");
                localStorage.setItem("umea_user_email", sampleEmail);
                localStorage.setItem("umea_user_name", "Google Trader");
                localStorage.setItem("umea_selected_plan", selectedPlan);
                fetch("/api/select-plan", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ email: sampleEmail, name: "Google Trader", plan: selectedPlan }),
                }).finally(() => {
                  router.push("/dashboard");
                });
              }}
              className="w-full py-3.5 px-4 rounded-xl bg-white hover:bg-gray-100 text-gray-900 font-bold text-sm transition-all flex items-center justify-center gap-3 mb-4 shadow-md"
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
              <div className="border-t border-gray-800 w-full"></div>
              <span className="bg-[#0E1420] px-3 text-[11px] text-gray-500 font-semibold uppercase tracking-wider">
                Or with email
              </span>
            </div>

            <form onSubmit={handleQuickLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Your Name</label>
                <input
                  type="text"
                  placeholder="e.g. Alex Trader"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-800 text-white text-sm focus:border-emerald-500 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="you@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-800 text-white text-sm focus:border-emerald-500 outline-none transition"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-all mt-2 shadow-lg shadow-emerald-500/20"
              >
                Continue to Dashboard &rarr;
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-gray-900 px-6 py-8 text-center text-xs text-gray-600">
        <p>&copy; 2026 UmeaFX Synthetics. Proprietary Cloud Copy Trading Technology. All Rights Reserved.</p>
      </footer>
    </main>
  );
}
