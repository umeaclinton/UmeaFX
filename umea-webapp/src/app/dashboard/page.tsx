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
  User,
  Camera,
  KeyRound,
  FileCheck,
  X,
  CheckCircle2,
  Clock,
  AlertTriangle,
  CreditCard,
  Zap,
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

  // 3-Day Trial Countdown & Expiry State
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null);
  const [isTrialExpired, setIsTrialExpired] = useState(false);

  // Profile & Settings State
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profileTab, setProfileTab] = useState<"details" | "security" | "kyc">("details");
  const [userId, setUserId] = useState("");
  const [username, setUsername] = useState("");
  const [profileFirstName, setProfileFirstName] = useState("");
  const [profileLastName, setProfileLastName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileAge, setProfileAge] = useState("");
  const [profilePic, setProfilePic] = useState("");
  const [profileMsg, setProfileMsg] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    async function initUser() {
      const { data: { user } } = await supabasePublic.auth.getUser();
      let activeEmail = user?.email;
      let activeName = user?.user_metadata?.first_name
        ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ""}`.trim()
        : user?.user_metadata?.full_name || user?.user_metadata?.name;

      const storedPic = localStorage.getItem("umea_profile_pic") || "";
      if (storedPic) setProfilePic(storedPic);

      if (user) {
        setUserId(user.id);
        const metaFirst = user.user_metadata?.first_name || "";
        const metaLast = user.user_metadata?.last_name || "";
        const metaPhone = user.user_metadata?.phone || "";
        const metaAge = user.user_metadata?.age?.toString() || "";
        const metaUsername = user.user_metadata?.username || "";

        setProfileFirstName(metaFirst);
        setProfileLastName(metaLast);
        setProfilePhone(metaPhone);
        setProfileAge(metaAge);
        setUsername(metaUsername);

        try {
          const { data: profile } = await supabasePublic
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();

          if (profile) {
            activeName = `${profile.first_name} ${profile.last_name}`.trim();
            setProfileFirstName(profile.first_name || metaFirst);
            setProfileLastName(profile.last_name || metaLast);
            setProfilePhone(profile.phone || metaPhone);
            setProfileAge(profile.age?.toString() || metaAge);
            setUsername(profile.username || metaUsername);
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

      try {
        const statusRes = await fetch(`/api/user-status?email=${encodeURIComponent(activeEmail)}`);
        const statusData = await statusRes.json();
        if (statusData.success && statusData.user) {
          const u = statusData.user;
          if (u.plan) setPlan(u.plan);
          if (u.trial_ends_at) setTrialEndsAt(u.trial_ends_at);
          if (u.isTrialExpired) {
            setIsTrialExpired(true);
            setIsSaved(false);
            setLogin("");
          } else if (u.mt5_login) {
            setLogin(u.mt5_login.toString());
            setServer(u.mt5_server || "Weltrade-Real");
            setRiskMode(u.risk_mode || "multiplier");
            setRiskValue(u.risk_value?.toString() || "1.0");
            setMaxLot(u.max_lot?.toString() || "2.0");
            setIsSaved(true);
          }
        }
      } catch (err) {
        console.error("Failed to load user status:", err);
      }
    }
    initUser();
  }, [router]);

  // 1-second interval ticker for live 3-Day trial countdown
  useEffect(() => {
    if (plan !== "ib_free_trial" || !trialEndsAt) return;

    const tickCountdown = () => {
      const diff = new Date(trialEndsAt).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        if (!isTrialExpired) {
          setIsTrialExpired(true);
          setIsSaved(false);
          setLogin("");
          if (email) {
            fetch(`/api/user-status?email=${encodeURIComponent(email)}`).catch(() => {});
          }
        }
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / 1000 / 60) % 60);
      const seconds = Math.floor((diff / 1000) % 60);
      setTimeLeft({ days, hours, minutes, seconds });
    };

    tickCountdown();
    const interval = setInterval(tickCountdown, 1000);
    return () => clearInterval(interval);
  }, [plan, trialEndsAt, email, isTrialExpired]);

  const handleUpgradePaystack = async () => {
    try {
      const res = await fetch("/api/paystack/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, plan: "monthly_sub", amount: 75000 }),
      });
      const data = await res.json();
      if (data.success && data.authorizationUrl) window.location.href = data.authorizationUrl;
    } catch (e) {
      console.error("Paystack upgrade error:", e);
    }
  };

  const handleUpgradeCrypto = async () => {
    try {
      const res = await fetch("/api/crypto/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, plan: "monthly_sub", amount: 49.0 }),
      });
      const data = await res.json();
      if (data.success && data.invoiceUrl) window.location.href = data.invoiceUrl;
    } catch (e) {
      console.error("Crypto upgrade error:", e);
    }
  };

  const handleLogout = async () => {
    await supabasePublic.auth.signOut();
    localStorage.clear();
    router.push("/");
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileMsg("");

    try {
      if (userId) {
        await supabasePublic.from("profiles").update({
          first_name: profileFirstName.trim(),
          last_name: profileLastName.trim(),
          phone: profilePhone.trim(),
        }).eq("id", userId);

        await supabasePublic.auth.updateUser({
          data: {
            first_name: profileFirstName.trim(),
            last_name: profileLastName.trim(),
            full_name: `${profileFirstName.trim()} ${profileLastName.trim()}`,
            phone: profilePhone.trim(),
          },
        });
      }

      const updatedFullName = `${profileFirstName.trim()} ${profileLastName.trim()}`;
      setName(updatedFullName);
      localStorage.setItem("umea_user_name", updatedFullName);
      setProfileMsg("Profile updated successfully!");
    } catch (err: any) {
      setProfileMsg(err.message || "Failed to update profile.");
    } finally {
      setProfileLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) return;
    setProfileLoading(true);
    setProfileMsg("");

    try {
      const { error } = await supabasePublic.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });
      if (error) throw error;
      setProfileMsg(`Password reset instructions delivered to ${email}. Check your inbox.`);
    } catch (err: any) {
      setProfileMsg(err.message || "Failed to send reset email.");
    } finally {
      setProfileLoading(false);
    }
  };

  const handleProfilePicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setProfileMsg("Image size should be less than 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setProfilePic(base64);
      localStorage.setItem("umea_profile_pic", base64);
      setProfileMsg("Profile photo updated!");
    };
    reader.readAsDataURL(file);
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

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Interactive Profile & Settings Trigger */}
            <button
              onClick={() => {
                setIsProfileOpen(true);
                setProfileMsg("");
              }}
              className="flex items-center gap-2 sm:gap-2.5 p-1 sm:px-3 sm:py-1.5 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:border-emerald-500/40 dark:hover:border-emerald-500/40 transition group"
              title="Profile & Account Settings"
            >
              {profilePic ? (
                <img
                  src={profilePic}
                  alt="Profile"
                  className="w-8 h-8 rounded-xl object-cover ring-2 ring-emerald-500/30"
                />
              ) : (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white font-black text-xs flex items-center justify-center shadow-md shadow-emerald-500/20">
                  {name ? name.substring(0, 2).toUpperCase() : "FX"}
                </div>
              )}
              <div className="text-left hidden sm:block">
                <div className="text-xs font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-1">
                  <span className="truncate max-w-[120px]">{name}</span>
                  <Settings2 className="w-3 h-3 text-gray-400 group-hover:text-emerald-500 transition" />
                </div>
                <div className="text-[10px] font-mono text-gray-400 dark:text-slate-400 truncate max-w-[120px]">
                  {username || email}
                </div>
              </div>
            </button>
          </div>
        </div>
      </header>

      <div className="min-h-screen bg-white dark:bg-black text-gray-900 dark:text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-white transition-colors duration-200">
      {/* Spacer for fixed header height */}
      <div className="h-20 shrink-0" />

      {/* ── Main ── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 w-full flex-1">

        {/* ── 3-Day Trial Countdown & Expiry Banner ── */}
        {plan === "ib_free_trial" && (
          <ScrollReveal direction="up" delay={0}>
            {!isTrialExpired ? (
              <div className="mb-8 p-6 sm:p-7 rounded-3xl bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20 dark:border-emerald-500/30 backdrop-blur-xl relative overflow-hidden shadow-lg shadow-emerald-500/5 transition-all">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                      </span>
                      <span className="text-[11px] font-mono font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        3-Day Weltrade Free Trial
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                        ACTIVE
                      </span>
                    </div>
                    <h3 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
                      <Clock className="w-5 h-5 text-emerald-500" />
                      <span>Trial Time Remaining</span>
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mt-1 max-w-xl leading-relaxed">
                      Autonomous execution is live on Weltrade. When your 3-day trial period finishes, connected accounts will automatically disconnect. Upgrade anytime to maintain continuous, uninterrupted sync.
                    </p>
                  </div>

                  {/* Digital Countdown Timer */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 shrink-0">
                    <div className="flex items-center gap-2 sm:gap-2.5">
                      <div className="flex flex-col items-center justify-center bg-white/90 dark:bg-black/60 border border-emerald-500/20 dark:border-white/10 rounded-2xl w-14 sm:w-16 h-16 shadow-sm">
                        <span className="text-xl sm:text-2xl font-black font-mono text-gray-900 dark:text-white">
                          {String(timeLeft?.days ?? 0).padStart(2, "0")}
                        </span>
                        <span className="text-[9px] font-mono uppercase tracking-wider text-gray-400 dark:text-slate-400 font-semibold">Days</span>
                      </div>
                      <span className="text-xl font-black font-mono text-emerald-500">:</span>
                      <div className="flex flex-col items-center justify-center bg-white/90 dark:bg-black/60 border border-emerald-500/20 dark:border-white/10 rounded-2xl w-14 sm:w-16 h-16 shadow-sm">
                        <span className="text-xl sm:text-2xl font-black font-mono text-gray-900 dark:text-white">
                          {String(timeLeft?.hours ?? 0).padStart(2, "0")}
                        </span>
                        <span className="text-[9px] font-mono uppercase tracking-wider text-gray-400 dark:text-slate-400 font-semibold">Hours</span>
                      </div>
                      <span className="text-xl font-black font-mono text-emerald-500">:</span>
                      <div className="flex flex-col items-center justify-center bg-white/90 dark:bg-black/60 border border-emerald-500/20 dark:border-white/10 rounded-2xl w-14 sm:w-16 h-16 shadow-sm">
                        <span className="text-xl sm:text-2xl font-black font-mono text-gray-900 dark:text-white">
                          {String(timeLeft?.minutes ?? 0).padStart(2, "0")}
                        </span>
                        <span className="text-[9px] font-mono uppercase tracking-wider text-gray-400 dark:text-slate-400 font-semibold">Mins</span>
                      </div>
                      <span className="text-xl font-black font-mono text-emerald-500">:</span>
                      <div className="flex flex-col items-center justify-center bg-white/90 dark:bg-black/60 border border-emerald-500/20 dark:border-white/10 rounded-2xl w-14 sm:w-16 h-16 shadow-sm">
                        <span className="text-xl sm:text-2xl font-black font-mono text-emerald-500 animate-pulse">
                          {String(timeLeft?.seconds ?? 0).padStart(2, "0")}
                        </span>
                        <span className="text-[9px] font-mono uppercase tracking-wider text-gray-400 dark:text-slate-400 font-semibold">Secs</span>
                      </div>
                    </div>

                    <button
                      onClick={handleUpgradePaystack}
                      className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-black tracking-wide uppercase transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1.5 hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <span>Upgrade $49/mo</span>
                      <ArrowUpRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mb-8 p-6 sm:p-7 rounded-3xl bg-red-50 dark:bg-red-950/20 border-2 border-red-500/40 backdrop-blur-xl relative overflow-hidden shadow-xl shadow-red-500/10">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700/50 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0 mt-0.5">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[11px] font-mono font-black uppercase tracking-wider text-red-600 dark:text-red-400">
                          Trial Expired
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30">
                          ACCOUNT DISCONNECTED
                        </span>
                      </div>
                      <h3 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white tracking-tight">
                        Your 3-Day Free Trial Has Ended
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-slate-300 mt-1 max-w-xl leading-relaxed">
                        Your connected MT5 account has been automatically disconnected and autonomous trade copying is paused. Upgrade to Direct Membership ($49/mo) to link your account back and restore 24/7 cloud sync.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
                    <button
                      onClick={handleUpgradePaystack}
                      className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-black tracking-wide uppercase transition shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Upgrade with Paystack</span>
                    </button>
                    <button
                      onClick={handleUpgradeCrypto}
                      className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-black tracking-wide uppercase transition shadow-lg shadow-teal-600/25 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <Zap className="w-4 h-4" />
                      <span>Upgrade with Crypto</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </ScrollReveal>
        )}

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
                  <Typewriter text="<15ms" speed={80} delay={300} className="font-bold" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-3 w-3">
                    {isSaved && !isTrialExpired && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                    <span className={`relative inline-flex rounded-full h-3 w-3 ${
                      isTrialExpired ? "bg-red-500 animate-pulse" : isSaved ? "bg-emerald-500" : "bg-amber-500"
                    }`}></span>
                  </span>
                  <span className="text-xl font-black tracking-tight text-gray-900 dark:text-white">
                    {isTrialExpired ? "PAUSED (TRIAL EXPIRED)" : isSaved ? "ACTIVE & SYNCED" : "SETUP REQUIRED"}
                  </span>
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
                  {isTrialExpired
                    ? "Your 3-day free trial has expired. MT5 terminal disconnected. Upgrade to Direct Membership to resume 24/7 execution."
                    : isSaved
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
                  {isTrialExpired ? "Disconnected" : login ? `${login.slice(0, 4)}••••` : "Not Linked"}
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
                  {isTrialExpired
                    ? "Account unlinked automatically upon trial expiration. Upgrade to reconnect."
                    : login
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
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                  isTrialExpired
                    ? "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20"
                    : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20"
                }`}>
                  {isTrialExpired ? "EXPIRED" : "ACTIVE"}
                </span>
              </div>
              <div>
                <div className="text-xl font-black tracking-tight text-gray-900 dark:text-white">
                  {plan === "ib_free_trial" ? "3-Day Partner Pass" : "Direct Membership"}
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
                  {plan === "ib_free_trial"
                    ? "3-Day Free Partner Access under Weltrade Partner ID."
                    : "$49/month unlimited autonomous trading subscription."}
                </p>
              </div>
              {plan === "ib_free_trial" && (
                <div className="mt-4 pt-3 border-t border-gray-200 dark:border-white/8 flex gap-2">
                  <button
                    onClick={handleUpgradePaystack}
                    className="flex-1 py-1.5 px-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 text-[11px] font-bold font-mono transition text-center"
                  >💳 Paystack</button>
                  <button
                    onClick={handleUpgradeCrypto}
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
                    To maintain free 3-day partner access, your MT5 account must be registered with Weltrade Partner Code:
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

            {isTrialExpired && (
              <div className="p-4 rounded-2xl text-xs font-semibold mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-500/30 text-red-700 dark:text-red-300">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>3-Day Free Trial Expired. Account linking is locked until upgraded to Direct Membership ($49/mo).</span>
                </div>
                <button
                  type="button"
                  onClick={handleUpgradePaystack}
                  className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold shrink-0 transition self-start sm:self-auto"
                >
                  Upgrade Now
                </button>
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
                      disabled={isTrialExpired}
                      onChange={(e) => setLogin(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-sm focus:border-emerald-500 outline-none transition font-mono placeholder:text-gray-400 dark:placeholder:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-2">MT5 Trade Password</label>
                    <div className="relative">
                      <input type={showPassword ? "text" : "password"} required placeholder="••••••••••••" value={password}
                        disabled={isTrialExpired}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-sm focus:border-emerald-500 outline-none transition font-mono pr-10 placeholder:text-gray-400 dark:placeholder:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
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

              {isTrialExpired ? (
                <div className="space-y-3 mt-6">
                  <button
                    type="button"
                    onClick={handleUpgradePaystack}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 hover:brightness-110 text-white font-black text-sm transition-all shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99]"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Upgrade with Paystack ($49/mo) to Link Account</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleUpgradeCrypto}
                    className="w-full py-3.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs transition-all shadow-lg shadow-teal-600/25 flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99]"
                  >
                    <Zap className="w-4 h-4" />
                    <span>Upgrade with Crypto ($49 USDT) to Link Account</span>
                  </button>
                </div>
              ) : (
                <button type="submit" disabled={isLoading}
                  className="w-full py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-black text-sm transition-all shadow-xl shadow-emerald-500/25 disabled:opacity-50 hover:scale-[1.01] active:scale-[0.99] mt-6">
                  {isLoading ? "Encrypting & Syncing..." : isSaved ? "Update Account Configuration" : "Save & Activate System Sync"}
                </button>
              )}
            </form>
          </div>
        </ScrollReveal>
      </main>
      {/* ── Profile & Account Settings Modal ── */}
      {isProfileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-[#0c0c0c] border border-gray-200 dark:border-white/10 shadow-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-white/8 mb-6">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider">
                <User className="w-4 h-4 text-emerald-500" />
                <span>Account Profile & Settings</span>
              </div>
              <button
                onClick={() => setIsProfileOpen(false)}
                className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Avatar & Identity Banner */}
            <div className="flex items-center gap-4 mb-6 p-4 rounded-2xl bg-gray-50 dark:bg-[#111111] border border-gray-200/80 dark:border-white/5">
              <div className="relative group shrink-0">
                {profilePic ? (
                  <img
                    src={profilePic}
                    alt="Avatar"
                    className="w-16 h-16 rounded-2xl object-cover ring-2 ring-emerald-500/40"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500 text-white font-black text-xl flex items-center justify-center shadow-lg shadow-emerald-500/25">
                    {name ? name.substring(0, 2).toUpperCase() : "FX"}
                  </div>
                )}
                <label
                  htmlFor="profile-pic-upload"
                  className="absolute -bottom-1 -right-1 p-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white shadow-md cursor-pointer transition"
                  title="Upload profile picture"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <input
                    id="profile-pic-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleProfilePicChange}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-gray-900 dark:text-white truncate">{name}</h3>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shrink-0">
                    {plan === "ib_free_trial" ? "3-DAY TRIAL" : "INSTITUTIONAL"}
                  </span>
                </div>
                <div className="text-xs font-mono text-gray-400 dark:text-slate-400 truncate">
                  {username || email}
                </div>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Verified Identity Record</span>
                </p>
              </div>
            </div>

            {/* Notification message */}
            {profileMsg && (
              <div className="p-3 rounded-xl text-xs font-medium mb-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{profileMsg}</span>
              </div>
            )}

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-gray-100 dark:border-white/8 mb-6 pb-2">
              <button
                type="button"
                onClick={() => setProfileTab("details")}
                className={`text-xs font-bold px-3 py-1.5 rounded-xl transition ${
                  profileTab === "details"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                    : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                Profile Details
              </button>
              <button
                type="button"
                onClick={() => setProfileTab("security")}
                className={`text-xs font-bold px-3 py-1.5 rounded-xl transition ${
                  profileTab === "security"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                    : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                Security & Password
              </button>
              <button
                type="button"
                onClick={() => setProfileTab("kyc")}
                className={`text-xs font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 ${
                  profileTab === "kyc"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                    : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                <span>ID Verification</span>
                <span className="text-[8px] font-black uppercase px-1 py-0.2 rounded bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-slate-400">
                  Soon
                </span>
              </button>
            </div>

            {/* Tab 1: Profile Details */}
            {profileTab === "details" && (
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 dark:text-slate-300 mb-1">
                      Legal First Name
                    </label>
                    <input
                      type="text"
                      required
                      value={profileFirstName}
                      onChange={(e) => setProfileFirstName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-xs outline-none focus:border-emerald-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 dark:text-slate-300 mb-1">
                      Legal Last Name
                    </label>
                    <input
                      type="text"
                      required
                      value={profileLastName}
                      onChange={(e) => setProfileLastName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-xs outline-none focus:border-emerald-500 transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 dark:text-slate-300 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      required
                      value={profilePhone}
                      onChange={(e) => setProfilePhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-xs outline-none focus:border-emerald-500 transition font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 dark:text-slate-300 mb-1">
                      Age
                    </label>
                    <input
                      type="number"
                      disabled
                      value={profileAge}
                      className="w-full px-3 py-2 rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/5 text-gray-400 dark:text-slate-500 text-xs outline-none cursor-not-allowed font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 dark:text-slate-300 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    disabled
                    value={email}
                    className="w-full px-3 py-2 rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/5 text-gray-400 dark:text-slate-500 text-xs outline-none cursor-not-allowed"
                  />
                  <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">
                    Email address is tied to your cryptographic session and cannot be modified directly.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={profileLoading}
                  className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-black text-xs transition shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                >
                  {profileLoading ? "Updating Profile..." : "Save Profile Changes"}
                </button>
              </form>
            )}

            {/* Tab 2: Security & Password */}
            {profileTab === "security" && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-white/10">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-900 dark:text-white mb-1">
                    <KeyRound className="w-4 h-4 text-emerald-500" />
                    <span>Reset Account Password</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed mb-4">
                    Send a secure password reset link to your registered email address ({email}).
                  </p>
                  <button
                    type="button"
                    disabled={profileLoading}
                    onClick={handleResetPassword}
                    className="px-4 py-2.5 rounded-xl bg-gray-200 dark:bg-white/10 hover:bg-emerald-500 hover:text-white dark:hover:bg-emerald-500 text-gray-800 dark:text-white font-bold text-xs transition flex items-center gap-2"
                  >
                    <span>Send Password Reset Email</span>
                  </button>
                </div>
              </div>
            )}

            {/* Tab 3: ID Verification (KYC) */}
            {profileTab === "kyc" && (
              <div className="p-5 rounded-2xl bg-gray-50 dark:bg-[#111111] border border-dashed border-gray-300 dark:border-white/15 text-center">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
                  <FileCheck className="w-5 h-5" />
                </div>
                <div className="inline-block px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-slate-400 mb-2">
                  COMING SOON
                </div>
                <h4 className="font-bold text-sm text-gray-900 dark:text-white mb-1">
                  Institutional Identity Verification
                </h4>
                <p className="text-xs text-gray-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                  Automated biometric passport and government-issued ID verification pipeline will unlock in the upcoming regulatory release.
                </p>
              </div>
            )}

            {/* Logout at bottom */}
            <div className="pt-4 mt-6 border-t border-gray-100 dark:border-white/8 flex items-center justify-between">
              <span className="text-[11px] font-mono text-gray-400 dark:text-slate-500">
                UmeaFX Secure Gateway
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="text-xs font-bold text-red-500 hover:text-red-400 flex items-center gap-1.5 transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}
