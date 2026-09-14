"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  TrendingUp,
  ShieldCheck,
  Zap,
  CheckCircle2,
  AlertCircle,
  LogOut,
  RefreshCw,
  Server,
  Layers,
  Settings2,
  Lock,
  Eye,
  EyeOff,
  Copy,
  Check,
  Activity,
  ArrowUpRight,
  HelpCircle
} from "lucide-react";
import { supabasePublic } from "@/lib/supabase";

export default function DashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [plan, setPlan] = useState<"ib_free_trial" | "monthly_sub">("ib_free_trial");

  // Form State
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [server, setServer] = useState("Weltrade-Real");
  const [riskMode, setRiskMode] = useState<"multiplier" | "fixed">("multiplier");
  const [riskValue, setRiskValue] = useState("1.0");
  const [maxLot, setMaxLot] = useState("2.0");

  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    async function initUser() {
      // 1. Check Supabase Auth
      const { data: { user } } = await supabasePublic.auth.getUser();
      let activeEmail = user?.email;
      let activeName = user?.user_metadata?.full_name || user?.user_metadata?.name;

      // 2. Fallback to localStorage
      if (!activeEmail) {
        activeEmail = localStorage.getItem("umea_user_email") || "";
        activeName = localStorage.getItem("umea_user_name") || "";
      }

      if (!activeEmail) {
        router.push("/");
        return;
      }

      setEmail(activeEmail);
      setName(activeName || activeEmail.split("@")[0] || "Trader");

      const storedPlan = (localStorage.getItem("umea_selected_plan") as any) || "ib_free_trial";
      setPlan(storedPlan);

      // Fetch user data from backend
      try {
        const res = await fetch(`/api/clients?key=umea-fx60-secret-bridge-key`);
        const data = await res.json();
        const found = data.clients?.find((c: any) => c.email.toLowerCase() === activeEmail.toLowerCase());
        if (found) {
          setLogin(found.login.toString());
          setServer(found.server);
          setRiskMode(found.riskMode || "multiplier");
          setRiskValue(found.riskValue.toString());
          setMaxLot(found.maxLot.toString());
          setIsSaved(true);
        }
      } catch {}
    }

    initUser();
  }, [router]);

  const handleLogout = async () => {
    await supabasePublic.auth.signOut();
    localStorage.clear();
    router.push("/");
  };

  const copyPartnerCode = () => {
    navigator.clipboard.writeText("UMEAFX");
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/register-mt5", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name,
          login,
          password,
          server,
          riskMode,
          riskValue,
          maxLot,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsSaved(true);
        setMessage("✅ Weltrade MT5 Account linked successfully! Autonomous execution engine is ACTIVE & SYNCED.");
      } else {
        setMessage(`❌ Error: ${data.error || "Failed to save"}`);
      }
    } catch (err: any) {
      setMessage(`❌ Network Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080B11] text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-black">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-[#080B11]/90 sticky top-0 z-40 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-400 p-[1px] shadow-lg shadow-emerald-500/20">
              <div className="w-full h-full bg-[#080B11] rounded-2xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black tracking-tight text-white">
                  Umea<span className="text-emerald-400">FX</span> Portal
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                  v2.20 Cloud
                </span>
              </div>
              <span className="block text-[10px] uppercase tracking-widest font-mono text-slate-400 font-semibold">
                Autonomous Execution Hub
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-white tracking-tight">{name}</div>
              <div className="text-[11px] font-mono text-slate-400">{email}</div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 w-full flex-1">
        {/* Status Hub Banners */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          {/* Card 1: Execution Engine Status */}
          <div className="p-6 rounded-3xl glass-card border border-slate-800/90 flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                Execution Status
              </span>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-slate-900 border border-slate-800 text-slate-300">
                <Activity className="w-3 h-3 text-emerald-400" />
                <span>&lt;15ms</span>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-3 w-3">
                  {isSaved && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${isSaved ? "bg-emerald-500" : "bg-amber-500"}`}></span>
                </span>
                <span className="text-xl font-black tracking-tight text-white">
                  {isSaved ? "ACTIVE & SYNCED" : "SETUP REQUIRED"}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                {isSaved
                  ? "Connected to cloud quantitative engine. Trades trigger automatically 24/7."
                  : "Link your Weltrade MT5 login and password below to activate execution."}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] font-mono text-emerald-400">
              <span>Target Asset</span>
              <span className="font-bold">FX Vol 60 (24/7)</span>
            </div>
          </div>

          {/* Card 2: Linked MT5 Account */}
          <div className="p-6 rounded-3xl glass-card border border-slate-800/90 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                Connected MT5 Account
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-900 border border-slate-800 text-slate-300">
                {server}
              </span>
            </div>

            <div>
              <div className="text-xl font-black tracking-tight text-white font-mono">
                {login ? `${login.slice(0, 4)}••••` : "Not Linked"}
              </div>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                {login
                  ? `Risk Mode: ${riskMode === "multiplier" ? `${riskValue}x Multiplier` : `${riskValue} Lots (Fixed)`} | Max Cap: ${maxLot}L`
                  : "No account credentials currently saved."}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>Encryption</span>
              <span className="text-teal-400 font-bold flex items-center gap-1">
                <Lock className="w-3 h-3" />
                AES-256-GCM
              </span>
            </div>
          </div>

          {/* Card 3: Membership Tier */}
          <div className="p-6 rounded-3xl glass-card border border-slate-800/90 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                Access Tier
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                ACTIVE
              </span>
            </div>

            <div>
              <div className="text-xl font-black tracking-tight text-white">
                {plan === "ib_free_trial" ? "7-Day Partner Pass" : "Direct Membership"}
              </div>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                {plan === "ib_free_trial"
                  ? "7-Day Free Partner Access under Weltrade Partner ID."
                  : "$49/month unlimited autonomous trading subscription."}
              </p>
            </div>

            {plan === "ib_free_trial" && (
              <div className="mt-4 pt-3 border-t border-slate-800/60 flex gap-2">
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch("/api/paystack/initialize", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ email, name, plan: "monthly_sub", amount: 75000 }),
                      });
                      const data = await res.json();
                      if (data.success && data.authorizationUrl) {
                        window.location.href = data.authorizationUrl;
                      }
                    } catch (e) {
                      console.error("Payment error:", e);
                    }
                  }}
                  className="flex-1 py-1.5 px-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold font-mono transition text-center"
                >
                  💳 Paystack
                </button>
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch("/api/crypto/initialize", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ email, name, plan: "monthly_sub", amount: 49.0 }),
                      });
                      const data = await res.json();
                      if (data.success && data.invoiceUrl) {
                        window.location.href = data.invoiceUrl;
                      }
                    } catch (e) {
                      console.error("Crypto payment error:", e);
                    }
                  }}
                  className="flex-1 py-1.5 px-2 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 border border-teal-500/30 text-[11px] font-bold font-mono transition text-center"
                >
                  ⚡ Crypto
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Partner Instructions Banner (Only for IB Free Trial) */}
        {plan === "ib_free_trial" && (
          <div className="mb-8 p-6 rounded-3xl bg-gradient-to-r from-emerald-950/30 via-[#0D121C] to-[#0D121C] border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0 mt-0.5">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white tracking-tight">Weltrade Partner Verification</h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  To maintain free 7-day partner access, your MT5 account must be registered with Weltrade Partner Code:
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-emerald-400 font-mono font-bold text-xs tracking-wider">
                    UMEAFX
                  </span>
                  <button
                    onClick={copyPartnerCode}
                    className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition"
                    title="Copy Partner Code"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
            <a
              href="https://www.weltrade.com"
              target="_blank"
              rel="noreferrer"
              className="px-5 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 self-stretch sm:self-auto justify-center"
            >
              <span>Open Weltrade Account</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

        {/* Credentials & Configuration Panel */}
        <div className="p-6 sm:p-9 rounded-3xl glass-card border border-slate-800/90 max-w-3xl">
          <div className="flex items-center gap-3.5 mb-6 pb-6 border-b border-slate-800/60">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-inner">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">Connect Weltrade MT5 Account</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Our autonomous execution system triggers trades to this account in under 15ms.
              </p>
            </div>
          </div>

          {message && (
            <div className={`p-4 rounded-2xl text-xs font-semibold mb-6 flex items-center gap-2.5 ${message.includes("✅") ? "bg-emerald-950/50 border border-emerald-500/30 text-emerald-300" : "bg-red-950/50 border border-red-500/30 text-red-300"}`}>
              <span>{message}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Account Credentials */}
            <div className="space-y-4">
              <div className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Account Credentials</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    MT5 Account Login ID
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 43241092"
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-white text-sm focus:border-emerald-500 outline-none transition font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    MT5 Trade Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-white text-sm focus:border-emerald-500 outline-none transition font-mono pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Broker Server Name
                </label>
                <select
                  value={server}
                  onChange={(e) => setServer(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-white text-sm focus:border-emerald-500 outline-none transition font-mono"
                >
                  <option value="Weltrade-Real">Weltrade-Real</option>
                  <option value="Weltrade-Demo">Weltrade-Demo</option>
                  <option value="Headway-Real">Headway-Real</option>
                </select>
              </div>
            </div>

            {/* Sizing & Risk Controls */}
            <div className="space-y-4 pt-4 border-t border-slate-800/60">
              <div className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Settings2 className="w-3.5 h-3.5 text-teal-400" />
                <span>Position Sizing & Risk Controls</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    Risk Calculation Mode
                  </label>
                  <select
                    value={riskMode}
                    onChange={(e) => setRiskMode(e.target.value as any)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-white text-sm focus:border-emerald-500 outline-none transition"
                  >
                    <option value="multiplier">Risk Multiplier (e.g. 1.0x master lot)</option>
                    <option value="fixed">Fixed Lot Size (e.g. 0.02 lots)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    {riskMode === "multiplier" ? "Multiplier Value (1.0 = Match Master)" : "Fixed Lot Value"}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={riskValue}
                    onChange={(e) => setRiskValue(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-white text-sm focus:border-emerald-500 outline-none transition font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Safety Max Lot Cap
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={maxLot}
                  onChange={(e) => setMaxLot(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-white text-sm focus:border-emerald-500 outline-none transition font-mono"
                />
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Protective safety cap. No single order will ever exceed this lot volume regardless of multiplier calculations.
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm transition-all shadow-xl shadow-emerald-500/25 disabled:opacity-50 hover:scale-[1.01] active:scale-[0.99] mt-6"
            >
              {isLoading ? "Encrypting & Syncing..." : isSaved ? "Update Account Configuration" : "Save & Activate System Sync"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
