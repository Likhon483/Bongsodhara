"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  Mail,
  Lock,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  KeyRound,
  Send,
} from "lucide-react";

function translateAuthError(msg: string): string {
  const lower = msg.toLowerCase();
  if (
    lower.includes("code verifier") ||
    lower.includes("code_verifier") ||
    lower.includes("pkce") ||
    lower.includes("pkce_verifier_missing") ||
    lower.includes("both auth_code and code_verifier")
  ) {
    return "যে ব্রাউজার থেকে পাসওয়ার্ড রিসেট লিংক চাওয়া হয়েছে সেই একই ব্রাউজারে লিংকটি ওপেন করতে হবে অথবা নতুন করে রিসেট লিংকের অনুরোধ করতে হবে।";
  }
  if (
    lower.includes("otp_expired") ||
    lower.includes("expired") ||
    lower.includes("email link is invalid or has expired") ||
    lower.includes("token has expired") ||
    lower.includes("invalid token")
  ) {
    return "রিসেট লিংকটি মেয়াদোত্তীর্ণ বা অবৈধ, অনুগ্রহ করে নতুন করে রিসেট লিংক পাঠান।";
  }
  if (lower.includes("invalid login credentials")) {
    return "ইমেইল অথবা পাসওয়ার্ড সঠিক নয়। অনুগ্রহ করে পুনরায় যাচাই করুন।";
  }
  if (
    lower.includes("user already registered") ||
    lower.includes("already registered")
  ) {
    return "এই ইমেইল দিয়ে ইতিমধ্যে একটি অ্যাকাউন্ট রয়েছে। দয়া করে লগইন করুন।";
  }
  if (lower.includes("password should be at least")) {
    return "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।";
  }
  if (
    lower.includes("security purposes, you can only request this once") ||
    lower.includes("for security purposes")
  ) {
    return "নিরাপত্তার স্বার্থে ৬০ সেকেন্ডের মধ্যে একবারই পাসওয়ার্ড রিসেট লিংক পাঠানো যায়। অনুগ্রহ করে একটু অপেক্ষা করে আবার চেষ্টা করুন।";
  }
  if (lower.includes("rate limit") || lower.includes("too many requests")) {
    return "অতিরিক্ত অনুরোধ পাঠানো হয়েছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।";
  }
  if (lower.includes("email not confirmed")) {
    return "আপনার ইমেইল ঠিকানা এখনো ভেরিফাই করা হয়নি। অনুগ্রহ করে ইনবক্স চেক করুন।";
  }
  if (lower.includes("user not found")) {
    return "এই ইমেইল ঠিকানায় কোনো নিবন্ধিত অ্যাকাউন্ট পাওয়া যায়নি।";
  }
  if (lower.includes("invalid email") || lower.includes("unable to validate email")) {
    return "অনুগ্রহ করে একটি সঠিক ইমেইল ঠিকানা প্রদান করুন।";
  }
  return msg || "একটি সমস্যা হয়েছে। আবার চেষ্টা করুন।";
}

function getInitialHashError(): { error: string | null; isExpired: boolean } {
  if (typeof window === "undefined" || !window.location.hash) {
    return { error: null, isExpired: false };
  }
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const hashErrorCode = hashParams.get("error_code");
  const hashErrorDesc =
    hashParams.get("error_description") || hashParams.get("error");
  const fullErr = hashErrorCode || hashErrorDesc;
  if (!fullErr) return { error: null, isExpired: false };
  const isExpired =
    fullErr.includes("otp_expired") ||
    fullErr.toLowerCase().includes("expired") ||
    fullErr.toLowerCase().includes("invalid") ||
    fullErr.toLowerCase().includes("code verifier") ||
    fullErr.toLowerCase().includes("pkce");
  return { error: translateAuthError(fullErr), isExpired };
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const urlMode = searchParams.get("mode");
  const rawUrlError =
    searchParams.get("error_code") ||
    searchParams.get("error_description") ||
    searchParams.get("error");

  const [initialData] = useState(() => {
    const hashInfo = getInitialHashError();
    const queryError = rawUrlError ? translateAuthError(rawUrlError) : null;
    const error = hashInfo.error || queryError;
    const isExpiredNotice =
      hashInfo.isExpired ||
      (Boolean(rawUrlError) &&
        (rawUrlError!.includes("otp_expired") ||
          rawUrlError!.toLowerCase().includes("expired") ||
          rawUrlError!.toLowerCase().includes("invalid") ||
          rawUrlError!.toLowerCase().includes("code verifier") ||
          rawUrlError!.toLowerCase().includes("pkce")));

    const initialMode: "login" | "signup" | "forgot" =
      urlMode === "forgot" || isExpiredNotice ? "forgot" : "login";
    return { mode: initialMode, error };
  });

  const [mode, setMode] = useState<"login" | "signup" | "forgot">(initialData.mode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(initialData.error);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  // Listen to hashchange events if redirected with hash fragments
  useEffect(() => {
    function handleHashChange() {
      const hashInfo = getInitialHashError();
      if (hashInfo.error) {
        setErrorMsg(hashInfo.error);
        setMode("forgot");
      }
    }
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setInfoMsg(null);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        router.push("/dashboard");
        router.refresh();
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        setInfoMsg(
          "অ্যাকাউন্ট তৈরি হয়েছে! ইমেইল ভেরিফিকেশন চালু থাকলে ইনবক্স চেক করুন অথবা সরাসরি লগইন করুন।"
        );
      } else if (mode === "forgot") {
        // Dynamic origin support for Vercel deployment and local development
        let origin = "http://localhost:3001";
        if (typeof window !== "undefined" && window.location.origin) {
          origin = window.location.origin;
        } else if (process.env.NEXT_PUBLIC_SITE_URL) {
          origin = process.env.NEXT_PUBLIC_SITE_URL;
        }
        if (origin.includes("0.0.0.0")) {
          origin = origin.replace("0.0.0.0", "localhost");
        }
        origin = origin.replace(/\/$/, "");
        const redirectUrl = `${origin}/reset-password`;

        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: redirectUrl,
        });
        if (error) throw error;

        setResetSent(true);
        setInfoMsg(
          "পাসওয়ার্ড রিসেটের লিংক আপনার ইমেইলে পাঠানো হয়েছে! অনুগ্রহ করে আপনার ইনবক্স (বা স্প্যাম ফোল্ডার) চেক করে প্রদত্ত লিংকে ক্লিক করুন।"
        );
      }
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : "একটি সমস্যা হয়েছে।";
      setErrorMsg(translateAuthError(rawMsg));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-slate-50 to-teal-100 p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100/80 p-6 sm:p-8 relative overflow-hidden">
        {/* Top decorative gradient bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-600 via-amber-400 to-teal-600" />

        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6 pt-2">
          <Link
            href="/"
            className="group flex flex-col items-center focus:outline-none transition-transform hover:scale-105"
          >
            <div className="relative w-12 h-12 rounded-2xl overflow-hidden shadow-md ring-2 ring-emerald-600/30 mb-3 bg-emerald-950">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/bongshodhara-logo.gif"
                alt="বংশধারা লোগো"
                className="w-full h-full object-cover"
              />
            </div>
            <h1 className="text-2xl font-black text-emerald-950 font-serif tracking-tight">
              বংশধারা
            </h1>
          </Link>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xs">
            {mode === "login" && "আপনার বংশতালিকা পরিচালনা করতে লগইন করুন"}
            {mode === "signup" && "নতুন অ্যাকাউন্ট খুলে বংশধারা তৈরি শুরু করুন"}
            {mode === "forgot" && "পাসওয়ার্ড পুনরুদ্ধার করতে ইমেইল ঠিকানা দিন"}
          </p>
        </div>

        {/* Mode Selector Tabs (Hidden in forgot mode) */}
        {mode !== "forgot" ? (
          <div className="grid grid-cols-2 gap-1.5 bg-slate-100/80 p-1 rounded-2xl mb-6 border border-slate-200/50">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setErrorMsg(null);
                setInfoMsg(null);
              }}
              className={`py-2 text-xs sm:text-sm font-semibold rounded-xl transition ${
                mode === "login"
                  ? "bg-white text-emerald-800 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              লগইন
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setErrorMsg(null);
                setInfoMsg(null);
              }}
              className={`py-2 text-xs sm:text-sm font-semibold rounded-xl transition ${
                mode === "signup"
                  ? "bg-white text-emerald-800 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              সাইনআপ
            </button>
          </div>
        ) : (
          <div className="mb-5">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setErrorMsg(null);
                setInfoMsg(null);
                setResetSent(false);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100/80 px-3 py-1.5 rounded-xl transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              লগইনে ফিরে যান
            </button>
          </div>
        )}

        {/* Forgot Password Notice / Form Title */}
        {mode === "forgot" && (
          <div className="mb-4">
            <div className="flex items-center gap-2 text-emerald-900 font-bold text-base mb-1">
              <KeyRound className="w-4 h-4 text-emerald-600" />
              <span>পাসওয়ার্ড ভুলে গেছেন?</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              আপনার অ্যাকাউন্টের ইমেইল ঠিকানাটি নিচে লিখুন। আমরা আপনাকে পাসওয়ার্ড রিসেট করার একটি নিরাপদ লিংক পাঠাব।
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email field */}
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
              ইমেইল ঠিকানা
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition bg-slate-50/50 hover:bg-white"
              />
            </div>
          </div>

          {/* Password field (Only in login and signup modes) */}
          {mode !== "forgot" && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs sm:text-sm font-semibold text-slate-700">
                  পাসওয়ার্ড
                </label>
                {mode === "login" && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode("forgot");
                      setErrorMsg(null);
                      setInfoMsg(null);
                    }}
                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline transition cursor-pointer"
                  >
                    পাসওয়ার্ড ভুলে গেছেন?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="কমপক্ষে ৬ অক্ষর"
                  className="w-full pl-10 pr-10 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition bg-slate-50/50 hover:bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                  aria-label={showPassword ? "পাসওয়ার্ড লুকান" : "পাসওয়ার্ড দেখুন"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-300/80 text-xs sm:text-sm text-amber-950 flex items-start gap-2.5 shadow-sm">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="leading-relaxed font-medium">
                {errorMsg}
              </div>
            </div>
          )}

          {/* Info / Success Message */}
          {infoMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs sm:text-sm text-emerald-800 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="leading-relaxed font-medium">{infoMsg}</p>
                {resetSent && (
                  <p className="text-[11px] text-emerald-700 pt-1">
                    ইমেইল না পেলে স্প্যাম ফোল্ডার চেক করুন অথবা কিছুক্ষণ পর আবার চেষ্টা করুন।
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 sm:py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold text-sm rounded-xl flex items-center justify-center gap-2 transition shadow-md shadow-emerald-700/10 cursor-pointer"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === "login" && "লগইন করুন"}
            {mode === "signup" && "অ্যাকাউন্ট তৈরি করুন"}
            {mode === "forgot" && (
              <>
                <Send className="w-3.5 h-3.5" />
                {resetSent ? "আবার রিসেট লিংক পাঠান" : "রিসেট লিংক পাঠান"}
              </>
            )}
          </button>
        </form>

        {/* Footer Link for Forgot Mode */}
        {mode === "forgot" && (
          <div className="pt-4 text-center border-t border-slate-100 mt-4">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setErrorMsg(null);
                setInfoMsg(null);
                setResetSent(false);
              }}
              className="text-xs font-semibold text-slate-500 hover:text-emerald-700 transition cursor-pointer"
            >
              পাসওয়ার্ড মনে পড়েছে? লগইন করুন
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-slate-50 to-teal-100 p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-8 flex flex-col items-center justify-center text-center shadow-lg">
            <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mb-3" />
            <p className="text-sm font-medium text-slate-700">লোড হচ্ছে...</p>
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
