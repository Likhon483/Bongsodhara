"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  Lock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ArrowLeft,
  KeyRound,
  ShieldCheck,
  Laptop,
} from "lucide-react";

interface ParsedError {
  text: string;
  isCodeVerifier: boolean;
}

function parsePasswordResetError(msg: string): ParsedError {
  const lower = msg.toLowerCase();

  // PKCE code verifier missing (e.g. opened in different browser or private mode)
  if (
    lower.includes("code verifier") ||
    lower.includes("code_verifier") ||
    lower.includes("pkce") ||
    lower.includes("pkce_verifier_missing") ||
    lower.includes("both auth_code and code_verifier")
  ) {
    return {
      text: "যে ব্রাউজার থেকে পাসওয়ার্ড রিসেট লিংক চাওয়া হয়েছে সেই একই ব্রাউজারে লিংকটি ওপেন করতে হবে অথবা নতুন করে রিসেট লিংকের অনুরোধ করতে হবে।",
      isCodeVerifier: true,
    };
  }

  // Expired or invalid token / link
  if (
    lower.includes("otp_expired") ||
    lower.includes("expired") ||
    lower.includes("email link is invalid or has expired") ||
    lower.includes("token has expired") ||
    lower.includes("invalid token") ||
    lower.includes("auth session missing") ||
    lower.includes("session expired") ||
    lower.includes("access_denied") ||
    lower.includes("invalid")
  ) {
    return {
      text: "রিসেট লিংকটি মেয়াদোত্তীর্ণ বা অবৈধ, অনুগ্রহ করে নতুন করে রিসেট লিংক পাঠান।",
      isCodeVerifier: false,
    };
  }

  if (lower.includes("new password should be different")) {
    return {
      text: "নতুন পাসওয়ার্ডটি আপনার আগের পাসওয়ার্ডের চেয়ে ভিন্ন হতে হবে।",
      isCodeVerifier: false,
    };
  }

  if (lower.includes("password should be at least")) {
    return {
      text: "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।",
      isCodeVerifier: false,
    };
  }

  if (lower.includes("rate limit") || lower.includes("too many requests")) {
    return {
      text: "খুব দ্রুত একাধিকবার চেষ্টা করা হয়েছে। অনুগ্রহ করে কিছুক্ষণ অপেক্ষা করুন।",
      isCodeVerifier: false,
    };
  }

  return {
    text: msg || "পাসওয়ার্ড আপডেট করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।",
    isCodeVerifier: false,
  };
}

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [checkingSession, setCheckingSession] = useState(true);
  const [hasValidSession, setHasValidSession] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [isCodeVerifierIssue, setIsCodeVerifierIssue] = useState(false);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function verifyRecoverySession() {
      try {
        // 1. Check for error parameters in query string
        const urlErrorCode = searchParams.get("error_code");
        const urlErrorDesc = searchParams.get("error_description") || searchParams.get("error");
        if (urlErrorCode || urlErrorDesc) {
          const parsed = parsePasswordResetError(urlErrorCode || urlErrorDesc || "");
          if (isMounted) {
            setSessionError(parsed.text);
            setIsCodeVerifierIssue(parsed.isCodeVerifier);
            setCheckingSession(false);
          }
          return;
        }

        // 2. Check for error or token in URL hash fragment
        if (typeof window !== "undefined" && window.location.hash) {
          const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
          const hashErrorCode = hashParams.get("error_code");
          const hashErrorDesc = hashParams.get("error_description") || hashParams.get("error");

          if (hashErrorCode || hashErrorDesc) {
            const parsed = parsePasswordResetError(hashErrorCode || hashErrorDesc || "");
            if (isMounted) {
              setSessionError(parsed.text);
              setIsCodeVerifierIssue(parsed.isCodeVerifier);
              setCheckingSession(false);
            }
            return;
          }

          const accessToken = hashParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token");
          if (accessToken) {
            const { data: sessionData, error: sessionErr } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || "",
            });
            if (!sessionErr && sessionData.session) {
              if (isMounted) {
                setHasValidSession(true);
                setCheckingSession(false);
              }
              return;
            }
          }
        }

        // 3. Check if a code parameter was provided (PKCE flow)
        const code = searchParams.get("code");
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error && data.session) {
            if (isMounted) {
              setHasValidSession(true);
              setCheckingSession(false);
            }
            return;
          }
          if (error) {
            const parsed = parsePasswordResetError(error.message);
            if (isMounted) {
              setSessionError(parsed.text);
              setIsCodeVerifierIssue(parsed.isCodeVerifier);
              setCheckingSession(false);
            }
            return;
          }
        }

        // 4. Check existing session (e.g. established via /auth/callback)
        const { data: currentSessionData } = await supabase.auth.getSession();
        if (currentSessionData?.session) {
          if (isMounted) {
            setHasValidSession(true);
            setCheckingSession(false);
          }
          return;
        }

        // 5. Listen for onAuthStateChange events (e.g. PASSWORD_RECOVERY)
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((event: string, session: unknown) => {
          if (event === "PASSWORD_RECOVERY" || (session && isMounted)) {
            setHasValidSession(true);
            setCheckingSession(false);
          }
        });

        // 6. Graceful timeout fallback
        const timer = setTimeout(() => {
          if (isMounted) {
            setCheckingSession(false);
          }
        }, 2200);

        return () => {
          subscription.unsubscribe();
          clearTimeout(timer);
        };
      } catch (err: unknown) {
        if (isMounted) {
          const rawMsg = err instanceof Error ? err.message : "";
          const parsed = parsePasswordResetError(rawMsg);
          setSessionError(parsed.text);
          setIsCodeVerifierIssue(parsed.isCodeVerifier);
          setCheckingSession(false);
        }
      }
    }

    verifyRecoverySession();

    return () => {
      isMounted = false;
    };
  }, [searchParams, supabase]);

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (password.length < 6) {
      setErrorMsg("পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("উভয় ঘরে লেখা পাসওয়ার্ড হুবহু মেলেনি। অনুগ্রহ করে যাচাই করুন।");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        throw error;
      }

      setSuccess(true);

      // Smooth redirect to dashboard after 2.5 seconds
      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 2500);
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : "পাসওয়ার্ড আপডেট ব্যর্থ হয়েছে।";
      const parsed = parsePasswordResetError(rawMsg);
      setErrorMsg(parsed.text);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-slate-50 to-teal-100 p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100/80 p-6 sm:p-8 relative overflow-hidden">
        {/* Decorative top bar */}
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
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/60 mt-1.5">
            <KeyRound className="w-3.5 h-3.5 text-amber-600" />
            পাসওয়ার্ড পরিবর্তন
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-2">
            আপনার বংশধারা অ্যাকাউন্টের জন্য নতুন একটি নিরাপদ পাসওয়ার্ড নির্ধারণ করুন
          </p>
        </div>

        {/* State 1: Checking Session Loading */}
        {checkingSession && (
          <div className="py-8 flex flex-col items-center justify-center text-center">
            <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mb-3" />
            <p className="text-sm font-medium text-slate-700">রিসেট লিংক যাচাই করা হচ্ছে...</p>
            <p className="text-xs text-slate-400 mt-1">দয়া করে কিছুক্ষণ অপেক্ষা করুন</p>
          </div>
        )}

        {/* State 2: Invalid Session, Code Verifier Issue, or Link Expired */}
        {!checkingSession && !hasValidSession && !success && (
          <div className="space-y-4">
            {isCodeVerifierIssue ? (
              /* Specific Guidance when opened in a different browser (PKCE code verifier missing) */
              <div className="p-4 rounded-2xl bg-amber-50/95 border border-amber-300 text-amber-950 space-y-2.5 shadow-sm">
                <div className="flex items-start gap-2.5">
                  <Laptop className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-bold text-amber-900">
                      একই ব্রাউজারে লিংকটি ওপেন করুন
                    </h3>
                    <p className="text-xs sm:text-sm text-amber-800/95 mt-1 leading-relaxed">
                      নিরাপত্তার স্বার্থে, যে ব্রাউজার বা ডিভাইস থেকে পাসওয়ার্ড রিসেটের অনুরোধ করা হয়েছিল, লিংকটি সেই একই ব্রাউজারেই ওপেন করতে হবে।
                    </p>
                  </div>
                </div>
                <div className="text-[11px] sm:text-xs text-amber-900/80 bg-amber-100/70 p-2.5 rounded-xl border border-amber-200/60 space-y-1">
                  <p>• <strong>পদ্ধতি ১:</strong> ইমেইলের রিসেট লিংকটি কপি করে আপনার পূর্বের ব্রাউজারের অ্যাড্রেস বারে পেস্ট করুন।</p>
                  <p>• <strong>পদ্ধতি ২:</strong> অথবা এই ব্রাউজার থেকেই নিচে ক্লিক করে নতুন রিসেট লিংকের অনুরোধ পাঠান।</p>
                </div>
              </div>
            ) : (
              /* General Expired or Invalid Link Notice */
              <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-300/80 text-amber-950">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-bold text-amber-900">
                      রিসেট লিংক সংক্রান্ত তথ্য
                    </h3>
                    <p className="text-xs sm:text-sm text-amber-800 mt-1 leading-relaxed font-medium">
                      {sessionError ||
                        "রিসেট লিংকটি মেয়াদোত্তীর্ণ বা অবৈধ, অনুগ্রহ করে নতুন করে রিসেট লিংক পাঠান।"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2 pt-2">
              <Link
                href="/login?mode=forgot"
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition shadow-sm hover:shadow"
              >
                <KeyRound className="w-4 h-4" />
                নতুন রিসেট লিংকের অনুরোধ করুন
              </Link>
              <Link
                href="/login"
                className="w-full py-2 text-slate-600 hover:text-slate-900 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                লগইনে ফিরে যান
              </Link>
            </div>
          </div>
        )}

        {/* State 3: Password Reset Successful */}
        {success && (
          <div className="py-6 space-y-4 text-center">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto ring-8 ring-emerald-50 shadow-inner">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-emerald-950">
                পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে!
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
                আপনার <strong>বংশধারা</strong> অ্যাকাউন্টের পাসওয়ার্ড সফলভাবে হালনাগাদ করা হয়েছে। এখন আপনি নতুন পাসওয়ার্ড দিয়ে নিরাপদভাবে লগইন ও ড্যাশবোর্ডে প্রবেশ করতে পারবেন।
              </p>
            </div>
            <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-center justify-center gap-2 font-medium">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
              কয়েক সেকেন্ডের মধ্যে স্বয়ংক্রিয়ভাবে ড্যাশবোর্ডে নিয়ে যাওয়া হচ্ছে...
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  router.push("/dashboard");
                  router.refresh();
                }}
                className="w-full py-2.5 sm:py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl flex items-center justify-center gap-2 transition shadow-md shadow-emerald-700/10 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                ড্যাশবোর্ডে প্রবেশ করুন
              </button>
            </div>
          </div>
        )}

        {/* State 4: Valid Session, Form Visible */}
        {!checkingSession && hasValidSession && !success && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            {/* New Password */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                নতুন পাসওয়ার্ড
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড"
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
              <p className="text-[11px] text-slate-400 mt-1">
                পাসওয়ার্ডটিতে অক্ষর, সংখ্যা ও প্রতীকের মিশ্রণ রাখা নিরাপদ।
              </p>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                পাসওয়ার্ড নিশ্চিত করুন
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="পুনরায় নতুন পাসওয়ার্ডটি লিখুন"
                  className="w-full pl-10 pr-10 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition bg-slate-50/50 hover:bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                  aria-label={showConfirmPassword ? "পাসওয়ার্ড লুকান" : "পাসওয়ার্ড দেখুন"}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="text-[11px] text-amber-600 font-medium mt-1">
                  উভয় ঘরে পাসওয়ার্ড মিলছে না
                </p>
              )}
            </div>

            {/* Error Message Alert */}
            {errorMsg && (
              <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-300/80 text-xs sm:text-sm text-amber-950 flex items-start gap-2.5 shadow-sm">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="leading-relaxed font-medium">
                  {errorMsg}
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || password.length < 6 || password !== confirmPassword}
              className="w-full py-2.5 sm:py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl flex items-center justify-center gap-2 transition shadow-md shadow-emerald-700/10 cursor-pointer"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "পাসওয়ার্ড সংরক্ষণ করা হচ্ছে..." : "নতুন পাসওয়ার্ড সংরক্ষণ করুন"}
            </button>

            {/* Back to Login link */}
            <div className="pt-2 text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-emerald-700 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                লগইনে ফিরে যান
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
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
      <ResetPasswordContent />
    </Suspense>
  );
}
