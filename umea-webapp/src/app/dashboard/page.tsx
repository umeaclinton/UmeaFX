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
} from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [plan, setPlan] = useState<"ib_free_trial" | "monthly_sub">("ib_free_trial");

  // Form State
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [server, setServer] = useState("Weltrade-Real");
  const [riskMode, setRiskMode] = useState<"multiplier" | "fixed">("multiplier");
  const [riskValue, setRiskValue] = useState("1.0");
  const [maxLot, setMaxLot] = useState("2.0");

  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const storedEmail = localStorage.getItem("umea_user_email");
    const storedName = localStorage.getItem("umea_user_name");
    const storedPlan = (localStorage.getItem("umea_selected_plan") as any) || "ib_free_trial";

    if (!storedEmail) {
      router.push("/");
      return;
    }

    setEmail(storedEmail);
    setName(storedName || "Trader");
    setPlan(storedPlan);

    // Fetch existing user state from backend
    fetch(`/api/clients?key=umea-fx60-secret-bridge-key`)
      .then((res) => res.json())
      .then((data) => {
        const found = data.clients?.find((c: any) => c.email.toLowerCase() === storedEmail.toLowerCase());
        if (found) {
          setLogin(found.login.toString());
          setServer(found.server);
          setRiskMode(found.riskMode || "multiplier");
          setRiskValue(found.riskValue.toString());
          setMaxLot(found.maxLot.toString());
          setIsSaved(true);
        }
      })
      .catch(() => {});
  }, [router]);

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
        setMessage("✅ Weltrade MT5 Account linked successfully! Copier is now armed.");
      } else {
        setMessage(`❌ Error: ${data.error || "Failed to save"}`);
      }
    } catch (err: any) {
      setMessage(`❌ Network Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-[#090D14] flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-gray-800/80 bg-[#0B0F17]/90 sticky top-0 z-40 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-bold text-white tracking-tight">UmeaFX Copier Portal</span>
              <span className="hidden sm:inline-block ml-3 px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                Live Bridge v2.20
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-semibold text-white">{name}</div>
              <div className="text-[11px] text-gray-400">{email}</div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800 transition"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-10 w-full flex-1">
        {/* Status Banners */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Subscription Status Card */}
          <div className="p-6 rounded-2xl bg-[#0E1420] border border-gray-800">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
              Active Access Tier
            </div>
            <div className="flex items-center justify-between">
              <div className="text-xl font-extrabold text-white">
                {plan === "ib_free_trial" ? "7-Day IB Free Trial" : "Monthly Sub ($49)"}
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30">
                ACTIVE
              </span>
            </div>
            <div className="mt-3 text-xs text-gray-400">
              {plan === "ib_free_trial" ? (
                <span>Expires in <strong className="text-emerald-400">7 days</strong>. Automatically syncs with master.</span>
              ) : (
                <span>Next billing cycle: Active monthly auto-renew.</span>
              )}
            </div>
          </div>

          {/* Copier Status Card */}
          <div className="p-6 rounded-2xl bg-[#0E1420] border border-gray-800">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
              Copier Bridge Status
            </div>
            <div className="flex items-center justify-between">
              <div className="text-xl font-extrabold text-white flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${isSaved ? "bg-emerald-500 animate-pulse" : "bg-yellow-500"}`} />
                <span>{isSaved ? "ARMED & READY" : "SETUP NEEDED"}</span>
              </div>
            </div>
            <div className="mt-3 text-xs text-gray-400">
              {isSaved ? "Your account will receive trades the moment Master executes." : "Fill the credentials below to start copying."}
            </div>
          </div>

          {/* Strategy Live Specs */}
          <div className="p-6 rounded-2xl bg-[#0E1420] border border-gray-800">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
              Master Target Asset
            </div>
            <div className="text-xl font-extrabold text-emerald-400">
              FX Vol 60 (24/7/365)
            </div>
            <div className="mt-3 text-xs text-gray-400">
              Mode 3: 12% Body Retrace | SL 200 pts | TP 400 pts
            </div>
          </div>
        </div>

        {/* IB Partner Instructions (Only for IB Trial) */}
        {plan === "ib_free_trial" && (
          <div className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-[#0E1420] to-[#0E1420] border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-6 h-6 text-emerald-400 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-white">Weltrade IB Partner Verification</h4>
                <p className="text-xs text-gray-400 mt-0.5">
                  Ensure your MT5 account was opened under Partner Code <strong className="text-emerald-300 font-mono">UMEAFX</strong> or through our partner link.
                </p>
              </div>
            </div>
            <a
              href="https://www.weltrade.com"
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-emerald-400 text-xs font-bold whitespace-nowrap transition"
            >
              Open Weltrade Account &rarr;
            </a>
          </div>
        )}

        {/* Credentials Form */}
        <div className="p-8 rounded-3xl bg-[#0E1420] border border-gray-800 max-w-3xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Connect Weltrade MT5 Account</h3>
              <p className="text-xs text-gray-400">
                Trades will be executed into this account automatically in under 15ms.
              </p>
            </div>
          </div>

          {message && (
            <div className={`p-4 rounded-xl text-xs font-semibold mb-6 ${message.includes("✅") ? "bg-emerald-950/60 border border-emerald-500/30 text-emerald-300" : "bg-red-950/60 border border-red-500/30 text-red-300"}`}>
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-2">
                  MT5 Account Login ID
                </label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 34808764"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-800 text-white text-sm focus:border-emerald-500 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-2">
                  MT5 Trade Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-800 text-white text-sm focus:border-emerald-500 outline-none transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-2">
                  Broker Server Name
                </label>
                <select
                  value={server}
                  onChange={(e) => setServer(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-800 text-white text-sm focus:border-emerald-500 outline-none transition"
                >
                  <option value="Weltrade-Real">Weltrade-Real</option>
                  <option value="Weltrade-Demo">Weltrade-Demo</option>
                  <option value="Headway-Real">Headway-Real</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-2">
                  Risk Execution Mode
                </label>
                <select
                  value={riskMode}
                  onChange={(e) => setRiskMode(e.target.value as any)}
                  className="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-800 text-white text-sm focus:border-emerald-500 outline-none transition"
                >
                  <option value="multiplier">Risk Multiplier (e.g. 1.0x master lot)</option>
                  <option value="fixed">Fixed Lot Size (e.g. 0.02 lots)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-2">
                  {riskMode === "multiplier" ? "Multiplier Value (1.0 = Exactly match master)" : "Fixed Lot Size"}
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={riskValue}
                  onChange={(e) => setRiskValue(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-800 text-white text-sm focus:border-emerald-500 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-2">
                  Safety Max Lot Cap
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={maxLot}
                  onChange={(e) => setMaxLot(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-800 text-white text-sm focus:border-emerald-500 outline-none transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              {isLoading ? "Saving Credentials..." : isSaved ? "Update MT5 Credentials" : "Save & Arm Copier"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
