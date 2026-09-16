"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ShieldCheck,
  Lock,
  Mail,
  User,
  Phone,
  Calendar,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { supabasePublic } from "@/lib/supabase";
import { ScrollReveal } from "@/components/ScrollReveal";

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"signin" | "signup" | "otp">("signin");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Sign In State
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Legal Sign Up State
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [age, setAge] = useState("");
  const [phone, setPhone] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showSignupPassword, setShowSignupPassword] = useState(false);

  // OTP State (Flexibly supports 6 to 8 digit codes & copy-paste)
  const [otpCode, setOtpCode] = useState("");
  const [resendCooldown, setResendCooldown] = useState(60);
  const otpInputRef = useRef<HTMLInputElement>(null);

  // Resend Timer countdown
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (mode === "otp" && resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [mode, resendCooldown]);

  // Handle Sign In
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setIsLoading(true);

    try {
      const { data, error } = await supabasePublic.auth.signInWithPassword({
        email: loginEmail.trim(),
        password: loginPassword,
      });

      if (error) {
        if (error.message.toLowerCase().includes("invalid login credentials")) {
          throw new Error("Invalid email or password. If you haven't registered yet, please create an account.");
        }
        throw error;
      }

      if (data.user) {
        localStorage.setItem("umea_user_email", data.user.email || loginEmail);
        const fullName = data.user.user_metadata?.full_name || data.user.user_metadata?.first_name;
        if (fullName) localStorage.setItem("umea_user_name", fullName);

        setSuccessMsg(`Welcome back, ${data.user.user_metadata?.first_name || "Trader"}! Accessing dashboard...`);
        setTimeout(() => {
          router.push("/dashboard");
        }, 800);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to sign in. Please verify your credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Legal Sign Up Submission -> Trigger OTP
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (signupPassword !== confirmPassword) {
      setErrorMsg("Passwords do not match. Please re-enter your password.");
      return;
    }

    if (parseInt(age, 10) < 18) {
      setErrorMsg("You must be at least 18 years of age to register an institutional trading account.");
      return;
    }

    setIsLoading(true);

    try {
      const formattedUsername = username.startsWith("@") ? username : `@${username}`;

      const { data, error } = await supabasePublic.auth.signUp({
        email: signupEmail.trim(),
        password: signupPassword,
        options: {
          data: {
            first_name: firstName.trim(),
            middle_name: middleName.trim() || null,
            last_name: lastName.trim(),
            full_name: `${firstName.trim()} ${lastName.trim()}`,
            username: formattedUsername.trim(),
            age: parseInt(age, 10),
            phone: phone.trim(),
          },
        },
      });

      if (error) throw error;

      // Switch to OTP view
      setMode("otp");
      setResendCooldown(60);
      setSuccessMsg(`Verification code was sent to ${signupEmail.trim()}`);
      setTimeout(() => {
        otpInputRef.current?.focus();
      }, 200);
    } catch (err: any) {
      setErrorMsg(err.message || "Sign up failed. Please check your inputs.");
    } finally {
      setIsLoading(false);
    }
  };

  // Focus OTP input when switching to OTP view
  useEffect(() => {
    if (mode === "otp") {
      setTimeout(() => {
        otpInputRef.current?.focus();
      }, 200);
    }
  }, [mode]);

  // Handle OTP input change
  const handleOtpInput = (val: string) => {
    const cleaned = val.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
    setOtpCode(cleaned);

    // Auto-verify if user entered/pasted full 8 digits
    if (cleaned.length === 8) {
      verifyOtpCode(cleaned);
    }
  };

  // Verify OTP code (works for 6 or 8 digits)
  const verifyOtpCode = async (code: string) => {
    if (!code || code.length < 6) {
      setErrorMsg("Please enter the complete verification code from your email.");
      return;
    }
    setErrorMsg("");
    setSuccessMsg("");
    setIsLoading(true);

    try {
      const { data, error } = await supabasePublic.auth.verifyOtp({
        email: signupEmail.trim(),
        token: code.trim(),
        type: "signup",
      });

      if (error) throw error;

      if (data.user) {
        // Save profile in public.profiles table
        const formattedUsername = username.startsWith("@") ? username : `@${username}`;
        try {
          await supabasePublic.from("profiles").upsert({
            id: data.user.id,
            first_name: firstName.trim(),
            middle_name: middleName.trim() || null,
            last_name: lastName.trim(),
            username: formattedUsername.trim(),
            age: parseInt(age, 10),
            phone: phone.trim(),
            email: signupEmail.trim(),
            plan: "ib_free_trial",
            max_accounts: 1,
          });
        } catch (dbErr) {
          console.warn("Profile table insert notice:", dbErr);
        }

        localStorage.setItem("umea_user_email", data.user.email || signupEmail);
        localStorage.setItem("umea_user_name", `${firstName} ${lastName}`);

        setSuccessMsg(`Verification successful! Welcome, ${firstName}!`);
        setTimeout(() => {
          router.push("/dashboard");
        }, 1000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Invalid or expired code. Please verify and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Resend OTP code
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setErrorMsg("");
    setSuccessMsg("");
    setIsLoading(true);

    try {
      const { error } = await supabasePublic.auth.resend({
        type: "signup",
        email: signupEmail.trim(),
      });
      if (error) throw error;
      setResendCooldown(60);
      setSuccessMsg(`New 6-digit code sent to ${signupEmail.trim()}`);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to resend code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Continue with Google
  const handleGoogleSignIn = async () => {
    try {
      const { error } = await supabasePublic.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setErrorMsg(err.message || "Google authentication failed.");
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#000000] text-gray-900 dark:text-white flex flex-col justify-between selection:bg-emerald-500 selection:text-white transition-colors duration-200">
      {/* Top Header */}
      <header className="px-6 py-6 border-b border-gray-100 dark:border-white/8 flex items-center justify-between max-w-7xl mx-auto w-full">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center text-white font-black text-base shadow-lg shadow-emerald-500/25 group-hover:scale-105 transition">
            U
          </div>
          <span className="font-black text-lg tracking-tight">
            Umea<span className="text-emerald-500">FX</span>
          </span>
        </Link>
        <Link
          href="/"
          className="text-xs font-semibold text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition"
        >
          Back to Home
        </Link>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-12">
        <div className="w-full max-w-xl">
          <ScrollReveal direction="fade">
            <div className="p-6 sm:p-10 rounded-3xl bg-white dark:bg-[#0c0c0c] border border-gray-200 dark:border-white/10 shadow-2xl shadow-black/5 dark:shadow-black/60">
              {/* Header Title */}
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 text-[11px] font-mono font-bold mb-3">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Secure Institutional Gateway</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                  {mode === "signin" && "Sign In to Your Account"}
                  {mode === "signup" && "Create Institutional Account"}
                  {mode === "otp" && "Verify Email Code"}
                </h1>
                <p className="mt-1.5 text-xs text-gray-500 dark:text-slate-400">
                  {mode === "signin" && "Access your autonomous execution terminal and MT5 configuration."}
                  {mode === "signup" && "Enter your legal document details to establish verified execution access."}
                  {mode === "otp" && `Enter the 6-digit code delivered to ${signupEmail}`}
                </p>
              </div>

              {/* Status Alert Banners */}
              {errorMsg && (
                <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 text-xs font-medium mb-6 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-medium mb-6 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* ── MODE 1: SIGN IN ── */}
              {mode === "signin" && (
                <div className="space-y-6">
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                        Email Address
                      </label>
                      <div className="relative">
                        <input
                          type="email"
                          required
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          placeholder="name@example.com"
                          className="w-full px-4 py-3 pl-10 rounded-xl bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-sm focus:border-emerald-500 outline-none transition placeholder:text-gray-400 dark:placeholder:text-slate-600"
                        />
                        <Mail className="w-4 h-4 text-gray-400 dark:text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                        Password
                      </label>
                      <div className="relative">
                        <input
                          type={showLoginPassword ? "text" : "password"}
                          required
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          placeholder="••••••••••••"
                          className="w-full px-4 py-3 pl-10 pr-10 rounded-xl bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-sm focus:border-emerald-500 outline-none transition placeholder:text-gray-400 dark:placeholder:text-slate-600 font-mono"
                        />
                        <Lock className="w-4 h-4 text-gray-400 dark:text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <button
                          type="button"
                          onClick={() => setShowLoginPassword(!showLoginPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 dark:hover:text-white transition"
                        >
                          {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-black text-sm transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-50 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
                    >
                      {isLoading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Verifying Credentials...</span>
                        </>
                      ) : (
                        <>
                          <span>Sign In to Terminal</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>

                  {/* Social Divider */}
                  <div className="relative my-6 text-center">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200 dark:border-white/10" />
                    </div>
                    <span className="relative px-3 bg-white dark:bg-[#0c0c0c] text-[11px] font-mono text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                      Or Continue With
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    className="w-full py-3 rounded-xl bg-gray-50 dark:bg-[#111111] hover:bg-gray-100 dark:hover:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-800 dark:text-white text-xs font-bold transition flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                      />
                    </svg>
                    <span>Google Account</span>
                  </button>

                  <div className="pt-4 border-t border-gray-100 dark:border-white/8 text-center">
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      Don&apos;t have an account yet?{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setMode("signup");
                          setErrorMsg("");
                          setSuccessMsg("");
                        }}
                        className="text-emerald-500 font-bold hover:underline"
                      >
                        Create Account
                      </button>
                    </p>
                  </div>
                </div>
              )}

              {/* ── MODE 2: LEGAL SIGN UP BOARD ── */}
              {mode === "signup" && (
                <form onSubmit={handleSignUp} className="space-y-4">
                  {/* Name Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                        Legal First Name <span className="text-emerald-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="As on legal ID"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-xs focus:border-emerald-500 outline-none transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                        Legal Last Name <span className="text-emerald-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="As on legal ID"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-xs focus:border-emerald-500 outline-none transition"
                      />
                    </div>
                  </div>

                  {/* Middle Name & Username */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                        Middle Name <span className="text-gray-400 font-normal">(Optional)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Middle name"
                        value={middleName}
                        onChange={(e) => setMiddleName(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-xs focus:border-emerald-500 outline-none transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                        Username <span className="text-emerald-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          placeholder="e.g. trader_pro"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          className="w-full px-3.5 py-2.5 pl-7 rounded-xl bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-xs focus:border-emerald-500 outline-none transition font-mono"
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-mono">
                          @
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Age & Phone Number */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                        Age (18+) <span className="text-emerald-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="18"
                        max="120"
                        required
                        placeholder="Age"
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-xs focus:border-emerald-500 outline-none transition font-mono"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                        Phone Number <span className="text-emerald-500">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="+1 (555) 000-0000"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-xs focus:border-emerald-500 outline-none transition font-mono"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                      Email Address <span className="text-emerald-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="name@example.com"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-xs focus:border-emerald-500 outline-none transition"
                    />
                  </div>

                  {/* Passwords */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                        Desired Password <span className="text-emerald-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showSignupPassword ? "text" : "password"}
                          required
                          placeholder="••••••••••••"
                          value={signupPassword}
                          onChange={(e) => setSignupPassword(e.target.value)}
                          className="w-full px-3.5 py-2.5 pr-8 rounded-xl bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-xs focus:border-emerald-500 outline-none transition font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSignupPassword(!showSignupPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                        >
                          {showSignupPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                        Confirm Password <span className="text-emerald-500">*</span>
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="••••••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-xs focus:border-emerald-500 outline-none transition font-mono"
                      />
                    </div>
                  </div>

                  <p className="text-[10px] text-gray-400 dark:text-slate-500 leading-relaxed pt-1">
                    By submitting, an email verification code will be sent to confirm your identity. Your details are encrypted in compliance with institutional data security standards.
                  </p>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-black text-sm transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-50 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 mt-4"
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Sending Verification Code...</span>
                      </>
                    ) : (
                      <>
                        <span>Submit & Send Verification Code</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <div className="pt-3 border-t border-gray-100 dark:border-white/8 text-center">
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      Already have an account?{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setMode("signin");
                          setErrorMsg("");
                          setSuccessMsg("");
                        }}
                        className="text-emerald-500 font-bold hover:underline"
                      >
                        Sign In
                      </button>
                    </p>
                  </div>
                </form>
              )}

              {/* ── MODE 3: 6 TO 8 DIGIT OTP VERIFICATION ── */}
              {mode === "otp" && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-center text-xs font-semibold text-gray-700 dark:text-slate-300 mb-2">
                      Enter Verification Code
                    </label>
                    <div className="relative max-w-sm mx-auto">
                      <input
                        ref={otpInputRef}
                        type="text"
                        maxLength={8}
                        placeholder="••••••••"
                        value={otpCode}
                        onChange={(e) => handleOtpInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && otpCode.length >= 6) {
                            verifyOtpCode(otpCode);
                          }
                        }}
                        className="w-full py-3.5 px-4 text-center font-mono text-2xl sm:text-3xl font-black tracking-[0.4em] sm:tracking-[0.6em] rounded-2xl bg-gray-50 dark:bg-[#111111] border-2 border-gray-200 dark:border-white/15 focus:border-emerald-500 text-gray-900 dark:text-white outline-none transition shadow-inner uppercase"
                      />
                    </div>
                    <p className="text-center text-[11px] text-gray-400 dark:text-slate-500 mt-2">
                      Enter or paste the code delivered to your email.
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={isLoading || otpCode.trim().length < 6}
                    onClick={() => verifyOtpCode(otpCode.trim())}
                    className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-black text-sm transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-50 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Verifying Code...</span>
                      </>
                    ) : (
                      <>
                        <span>Confirm & Enter Dashboard</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400 pt-2">
                    <button
                      type="button"
                      onClick={() => setMode("signup")}
                      className="hover:text-gray-900 dark:hover:text-white transition"
                    >
                      ← Change Details
                    </button>
                    <div>
                      {resendCooldown > 0 ? (
                        <span>Resend code in <strong className="font-mono text-emerald-500">{resendCooldown}s</strong></span>
                      ) : (
                        <button
                          type="button"
                          onClick={handleResendOtp}
                          className="text-emerald-500 font-bold hover:underline"
                        >
                          Resend Code Now
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollReveal>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 border-t border-gray-100 dark:border-white/8 text-center text-[11px] text-gray-400 dark:text-slate-500 font-mono">
        UmeaFX Autonomous Systems © 2026. All rights reserved.
      </footer>
    </div>
  );
}
