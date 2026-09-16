"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ShieldCheck,
  LogOut,
  Server,
  Settings2,
  Lock,
  Eye,
  EyeOff,
  Copy,
  Check,
  Activity,
  ArrowUpRight,
  Layers,
} from "lucide-react";
import { supabasePublic } from "@/lib/supabase";
import { ScrollReveal } from "@/components/ScrollReveal";
import { Typewriter } from "@/components/Typewriter";
import { InfoTooltip } from "@/components/InfoTooltip";

export default function DashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [plan, setPlan] = useState<"ib_free_trial" | "monthly_sub">("ib_free_trial");

  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [server, setServer] = useState("Weltrade-Real");
  const [selectedInstrument, setSelectedInstrument] = useState("fx_vol_60");
  const [riskMode, setRiskMode] = useState<"multiplier" | "fixed">("multiplier");
  const [riskValue, setRiskValue] = useState("1.0");
  const [maxLot, setMaxLot] = useState("2.0");

  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    async function initUser() {
      const { data: { user } } = await supabasePublic.auth.getUser();
      let activeEmail = user?.email;
      let activeName = user?.user_metadata?.first_name
        ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ""}`.trim()
        : user?.user_metadata?.full_name || user?.user_metadata?.name;

      if (user) {
        try {
          const { data: profile } = await supabasePublic
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();

          if (profile) {
            activeName = `${profile.first_name} ${profile.last_name}`.trim();
            if (profile.plan) setPlan(profile.plan as any);
          }
        } catch {}
      }

      if (!activeEmail) {
        activeEmail = localStorage.getItem("umea_user_email") || "";
        activeName = activeName || localStorage.getItem("umea_user_name") || "";
      }

      if (!activeEmail) { router.push("/login"); return; }

      setEmail(activeEmail);
      setName(activeName || activeEmail.split("@")[0] || "Trader");
      const storedPlan = (localStorage.getItem("umea_selected_plan") as any) || "ib_free_trial";
      setPlan(storedPlan);

      try {
        const res = await fetch(`/api/clients?key=umea-fx60-secret-bridge-key`);
        const data = await res.json();
        const found = data.clients?.find((c: any) => c.email.toLowerCase() === activeEmail!.toLowerCase());
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
        body: JSON.stringify({ email, name, login, password, server, riskMode, riskValue, maxLot }),
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
    <>
      {/* ── Navbar — fixed so it never scrolls ── */}
      <header className="bg-white/95 dark:bg-black/95 fixed top-0 left-0 right-0 z-40 backdrop-blur-xl shadow-sm dark:shadow-[0_1px_12px_rgba(0,0,0,0.6)] transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-400 p-[1px] shadow-lg shadow-emerald-500/20">
              <div className="w-full h-full bg-black rounded-2xl overflow-hidden">
                <Image src="/logo.png" alt="UmeaFX Logo" width={40} height={40} className="w-full h-full object-cover" priority />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black tracking-tight text-gray-900 dark:text-white">
                  Umea<span className="text-emerald-500">FX</span> Portal
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 font-bold">
                  v2.20 Cloud
                </span>
              </div>
              <span className="block text-[10px] uppercase tracking-widest font-mono text-gray-400 dark:text-slate-400 font-semibold">
                Autonomous Execution Hub
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-gray-900 dark:text-white tracking-tight">{name}</div>
              <div className="text-[11px] font-mono text-gray-400 dark:text-slate-400">{email}</div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2.5 rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-400 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/10 transition"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="min-h-screen bg-white dark:bg-black text-gray-900 dark:text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-white transition-colors duration-200">
      {/* Spacer for fixed header height */}
      <div className="h-20 shrink-0" />

      {/* ── Main ── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 w-full flex-1">

        {/* ── Status Hub Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">

          {/* Card 1: Execution Status */}
          <ScrollReveal direction="up" delay={0}>
            <div className="p-6 rounded-3xl glass-card glass-card-hover border border-gray-200 dark:border-white/8 flex flex-col justify-between relative overflow-hidden h-full">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-mono font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider">
                  Execution Status
                </span>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-600 dark:text-slate-300">
                  <Activity className="w-3 h-3 text-emerald-500" />
                  <Typewriter text="&lt;15ms" speed={80} delay={300} className="font-bold" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-3 w-3">
                    {isSaved && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                    <span className={`relative inline-flex rounded-full h-3 w-3 ${isSaved ? "bg-emerald-500" : "bg-amber-500"}`}></span>
                  </span>
                  <span className="text-xl font-black tracking-tight text-gray-900 dark:text-white">
                    {isSaved ? "ACTIVE & SYNCED" : "SETUP REQUIRED"}
                  </span>
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
                  {isSaved
                    ? "Connected to cloud quantitative engine. Trades trigger automatically 24/7."
                    : "Link your Weltrade MT5 login and password below to activate execution."}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-gray-200 dark:border-white/8 flex items-center justify-between text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
                <span>Target Asset</span>
                <Typewriter text="FX Vol 60 (24/7)" speed={45} delay={500} className="font-bold" />
              </div>
            </div>
          </ScrollReveal>

          {/* Card 2: Linked MT5 Account */}
          <ScrollReveal direction="up" delay={150}>
            <div className="p-6 rounded-3xl glass-card glass-card-hover border border-gray-200 dark:border-white/8 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-mono font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider">
                  Connected MT5 Account
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-600 dark:text-slate-300">
                  {server}
                </span>
              </div>
              <div>
                <div className="text-xl font-black tracking-tight text-gray-900 dark:text-white font-mono">
                  {login ? `${login.slice(0, 4)}••••` : "Not Linked"}
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
                  {login
                    ? `Risk Mode: ${riskMode === "multiplier" ? `${riskValue}x Multiplier` : `${riskValue} Lots (Fixed)`} | Max Cap: ${maxLot}L`
                    : "No account credentials currently saved."}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-gray-200 dark:border-white/8 flex items-center justify-between text-[11px] font-mono text-gray-400 dark:text-slate-400">
                <span>Encryption</span>
                <span className="text-teal-600 dark:text-teal-400 font-bold flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  <Typewriter text="AES-256-GCM" speed={55} delay={400} />
                </span>
              </div>
            </div>
          </ScrollReveal>

          {/* Card 3: Membership Tier */}
          <ScrollReveal direction="up" delay={300}>
            <div className="p-6 rounded-3xl glass-card glass-card-hover border border-gray-200 dark:border-white/8 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-mono font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider">
                  Access Tier
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                  ACTIVE
                </span>
              </div>
              <div>
                <div className="text-xl font-black tracking-tight text-gray-900 dark:text-white">
                  {plan === "ib_free_trial" ? "7-Day Partner Pass" : "Direct Membership"}
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
                  {plan === "ib_free_trial"
                    ? "7-Day Free Partner Access under Weltrade Partner ID."
                    : "$49/month unlimited autonomous trading subscription."}
                </p>
              </div>
              {plan === "ib_free_trial" && (
                <div className="mt-4 pt-3 border-t border-gray-200 dark:border-white/8 flex gap-2">
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch("/api/paystack/initialize", {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ email, name, plan: "monthly_sub", amount: 75000 }),
                        });
                        const data = await res.json();
                        if (data.success && data.authorizationUrl) window.location.href = data.authorizationUrl;
                      } catch (e) { console.error(e); }
                    }}
                    className="flex-1 py-1.5 px-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 text-[11px] font-bold font-mono transition text-center"
                  >💳 Paystack</button>
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch("/api/crypto/initialize", {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ email, name, plan: "monthly_sub", amount: 49.0 }),
                        });
                        const data = await res.json();
                        if (data.success && data.invoiceUrl) window.location.href = data.invoiceUrl;
                      } catch (e) { console.error(e); }
                    }}
                    className="flex-1 py-1.5 px-2 rounded-xl bg-teal-50 dark:bg-teal-500/10 hover:bg-teal-100 dark:hover:bg-teal-500/20 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-500/30 text-[11px] font-bold font-mono transition text-center"
                  >⚡ Crypto</button>
                </div>
              )}
            </div>
          </ScrollReveal>
        </div>

        {/* ── Partner Banner ── */}
        {plan === "ib_free_trial" && (
          <ScrollReveal direction="up" delay={100}>
            <div className="mb-8 p-6 rounded-3xl bg-emerald-50 dark:bg-gradient-to-r dark:from-emerald-950/30 dark:via-black dark:to-black border border-emerald-200 dark:border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors duration-200">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white tracking-tight">Weltrade Partner Verification</h4>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 leading-relaxed">
                    To maintain free 7-day partner access, your MT5 account must be registered with Weltrade Partner Code:
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="px-3 py-1 rounded-lg bg-white dark:bg-black border border-gray-200 dark:border-white/10 text-emerald-600 dark:text-emerald-400 font-mono font-bold text-xs tracking-wider">
                      UMEAFX
                    </span>
                    <button onClick={copyPartnerCode} title="Copy Partner Code"
                      className="p-1.5 rounded-lg bg-white dark:bg-black border border-gray-200 dark:border-white/10 text-gray-400 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition">
                      {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
              <a href="https://www.weltrade.com" target="_blank" rel="noreferrer"
                className="px-5 py-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-500/10 hover:bg-emerald-200 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30 text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 self-stretch sm:self-auto justify-center">
                <span>Open Weltrade Account</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </ScrollReveal>
        )}

        {/* ── Config Panel ── */}
        <ScrollReveal direction="up" delay={200}>
          <div className="p-6 sm:p-9 rounded-3xl glass-card border border-gray-200 dark:border-white/8 max-w-3xl">
            <div className="flex items-center gap-3.5 mb-6 pb-6 border-b border-gray-200 dark:border-white/8">
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">
                  <Typewriter text="Connect Weltrade MT5 Account" speed={30} delay={400} cursor={false} />
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  Our autonomous execution system triggers trades to this account in under 15ms.
                </p>
              </div>
            </div>

            {message && (
              <div className={`p-4 rounded-2xl text-xs font-semibold mb-6 flex items-center gap-2.5 ${
                message.includes("✅")
                  ? "bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                  : "bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-500/30 text-red-700 dark:text-red-300"
              }`}>
                <span>{message}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Target Trading Instrument */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-mono font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Target Trading Instrument</span>
                  </div>
                  <InfoTooltip
                    title="Target Instrument"
                    content="Select the synthetic asset you want the algorithm to trade on this MT5 account. Currently, FX Vol 60 is live and fully synced. Additional instruments will unlock as each quantitative engine is enabled."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* FX Vol 60 - Active */}
                  <button
                    type="button"
                    onClick={() => setSelectedInstrument("fx_vol_60")}
                    className={`relative p-3.5 rounded-xl text-left transition-all border ${
                      selectedInstrument === "fx_vol_60"
                        ? "bg-emerald-500/10 border-emerald-500 text-gray-900 dark:text-white shadow-sm ring-1 ring-emerald-500/30"
                        : "bg-gray-50 dark:bg-[#111111] border-gray-200 dark:border-white/10 text-gray-700 dark:text-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black tracking-tight">FX Vol 60 Index</span>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                        Live
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-snug">
                      Autonomous synthetic volatility engine. Active 24/7.
                    </p>
                  </button>

                  {/* Range Break 100 - Disabled */}
                  <div className="relative p-3.5 rounded-xl text-left border bg-gray-100/60 dark:bg-white/[0.02] border-gray-200/60 dark:border-white/5 opacity-60 cursor-not-allowed">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black text-gray-500 dark:text-slate-400 tracking-tight">Range Break 100</span>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-white/10">
                        Unavailable
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 dark:text-slate-400 leading-snug">
                      Range-break algorithm pending multi-broker sync rollout.
                    </p>
                  </div>

                  {/* Range Break 200 - Disabled */}
                  <div className="relative p-3.5 rounded-xl text-left border bg-gray-100/60 dark:bg-white/[0.02] border-gray-200/60 dark:border-white/5 opacity-60 cursor-not-allowed">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black text-gray-500 dark:text-slate-400 tracking-tight">Range Break 200</span>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-white/10">
                        Unavailable
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 dark:text-slate-400 leading-snug">
                      Higher volatility range break engine in internal testing.
                    </p>
                  </div>

                  {/* Boom & Crash 1000 - Disabled */}
                  <div className="relative p-3.5 rounded-xl text-left border bg-gray-100/60 dark:bg-white/[0.02] border-gray-200/60 dark:border-white/5 opacity-60 cursor-not-allowed">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black text-gray-500 dark:text-slate-400 tracking-tight">Boom & Crash 1000</span>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-white/10">
                        Unavailable
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 dark:text-slate-400 leading-snug">
                      Tick spike detector in quantitative research phase.
                    </p>
                  </div>
                </div>
              </div>

              {/* Account Credentials */}
              <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-white/8">
                <div className="text-xs font-mono font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Account Credentials</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-2">MT5 Account Login ID</label>
                    <input type="number" required placeholder="e.g. 43241092" value={login}
                      onChange={(e) => setLogin(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-sm focus:border-emerald-500 outline-none transition font-mono placeholder:text-gray-400 dark:placeholder:text-slate-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-2">MT5 Trade Password</label>
                    <div className="relative">
                      <input type={showPassword ? "text" : "password"} required placeholder="••••••••••••" value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-sm focus:border-emerald-500 outline-none transition font-mono pr-10 placeholder:text-gray-400 dark:placeholder:text-slate-600"
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-gray-600 dark:text-slate-300">Broker Server Name</label>
                    <InfoTooltip
                      title="Broker Server"
                      content="Select the exact MT5 server name provided by your broker in your account registration email (e.g. Weltrade-Real or Weltrade-Demo)."
                    />
                  </div>
                  <select value={server} onChange={(e) => setServer(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-sm focus:border-emerald-500 outline-none transition font-mono dark:[color-scheme:dark]">
                    <option value="Weltrade-Real">Weltrade-Real</option>
                    <option value="Weltrade-Demo">Weltrade-Demo</option>
                    <option value="Headway-Real">Headway-Real</option>
                  </select>
                </div>
              </div>

              {/* Position Sizing */}
              <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-white/8">
                <div className="text-xs font-mono font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Settings2 className="w-3.5 h-3.5 text-teal-500" />
                  <span>Position Sizing & Risk Controls</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-gray-600 dark:text-slate-300">Risk Calculation Mode</label>
                      <InfoTooltip
                        title="Risk Calculation Mode"
                        content="Multiplier scales your trade lot size relative to the master account (e.g., 1.0x copies exact master volume, 0.5x copies half volume). Fixed Lot enforces an exact unvarying volume on every single trade regardless of master size."
                      />
                    </div>
                    <select value={riskMode} onChange={(e) => setRiskMode(e.target.value as any)}
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-sm focus:border-emerald-500 outline-none transition dark:[color-scheme:dark]">
                      <option value="multiplier">Risk Multiplier (e.g. 1.0x master lot)</option>
                      <option value="fixed">Fixed Lot Size (e.g. 0.02 lots)</option>
                    </select>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-gray-600 dark:text-slate-300">
                        {riskMode === "multiplier" ? "Multiplier Value (1.0 = Match Master)" : "Fixed Lot Value"}
                      </label>
                      <InfoTooltip
                        title={riskMode === "multiplier" ? "Position Multiplier" : "Fixed Lot Sizing"}
                        content={
                          riskMode === "multiplier"
                            ? "A value of 1.0 matches the master trade volume 1:1. Set to 0.5 for conservative 50% risk, or 1.5 to 2.0 for higher capital allocation. Always balance this against your account margin."
                            : "Specific lot size executed on your account regardless of master trade size. For example, 0.02 lots per trade."
                        }
                      />
                    </div>
                    <input type="number" step="0.01" required value={riskValue}
                      onChange={(e) => setRiskValue(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-sm focus:border-emerald-500 outline-none transition font-mono placeholder:text-gray-400 dark:placeholder:text-slate-600"
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-gray-600 dark:text-slate-300">Safety Max Lot Cap</label>
                    <InfoTooltip
                      title="Safety Max Lot Cap"
                      content="A strict protective barrier for your balance. No trade order will ever exceed this lot volume under any circumstance, preventing accidental over-leveraging during extreme balance swings."
                    />
                  </div>
                  <input type="number" step="0.01" required value={maxLot}
                    onChange={(e) => setMaxLot(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-sm focus:border-emerald-500 outline-none transition font-mono dark:[color-scheme:dark]"
                  />
                  <p className="text-[11px] text-gray-400 dark:text-slate-400 mt-1.5">
                    Protective safety cap. No single order will ever exceed this lot volume regardless of multiplier calculations.
                  </p>
                </div>
              </div>

              <button type="submit" disabled={isLoading}
                className="w-full py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-black text-sm transition-all shadow-xl shadow-emerald-500/25 disabled:opacity-50 hover:scale-[1.01] active:scale-[0.99] mt-6">
                {isLoading ? "Encrypting & Syncing..." : isSaved ? "Update Account Configuration" : "Save & Activate System Sync"}
              </button>
            </form>
          </div>
        </ScrollReveal>
      </main>
      </div>
    </>
  );
}
