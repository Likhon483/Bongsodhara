"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  TreePine,
  ArrowRight,
  GitBranch,
  Camera,
  HeartHandshake,
  Download,
  Share2,
  Sparkles,
  CheckCircle2,
  Crown,
  Maximize2,
  Calendar,
  Users,
  Heart,
  Printer,
  Compass,
  ArrowUpRight,
  ExternalLink,
} from "lucide-react";

export default function HomePage() {
  const supabase = createClient();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        setIsLoggedIn(Boolean(user));
      } catch {
        setIsLoggedIn(false);
      } finally {
        setCheckingAuth(false);
      }
    }
    checkAuth();
  }, [supabase]);

  return (
    <div className="min-h-screen bg-stone-50/70 text-slate-900 selection:bg-emerald-100 selection:text-emerald-900 flex flex-col font-sans">
      {/* ১. নেভিগেশন বার */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-stone-200/80 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-4">
          {/* ব্র্যান্ড লোগো ও নাম: শুধু 'বংশধারা' */}
          <Link
            href="/"
            className="flex items-center gap-3 group focus:outline-none"
          >
            <div className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-2xl overflow-hidden shadow-md shadow-emerald-950/15 ring-2 ring-emerald-600/30 group-hover:scale-105 transition-transform duration-200 shrink-0 bg-emerald-950">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/bongshodhara-logo.gif"
                alt="বংশধারা লোগো"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <span className="font-black text-2xl sm:text-3xl tracking-tight text-emerald-950 font-serif leading-none block">
                বংশধারা
              </span>
              <p className="text-[11px] text-stone-500 font-medium mt-0.5 hidden xs:block">
                প্রজন্ম থেকে প্রজন্মের ইতিহাস
              </p>
            </div>
          </Link>

          {/* নেভিগেশন লিংকসমূহ */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-stone-600">
            <a
              href="#features"
              className="hover:text-emerald-700 transition cursor-pointer"
            >
              ফিচারসমূহ
            </a>
            <a
              href="#preview"
              className="hover:text-emerald-700 transition cursor-pointer"
            >
              প্রিভিউ
            </a>
            <a
              href="#how-it-works"
              className="hover:text-emerald-700 transition cursor-pointer"
            >
              কীভাবে কাজ করে
            </a>
            <a
              href="#creator"
              className="hover:text-emerald-700 transition cursor-pointer"
            >
              নির্মাতার কথা
            </a>
          </nav>

          {/* অ্যাকশন বাটন */}
          <div className="flex items-center gap-2.5">
            {checkingAuth ? (
              <div className="w-28 h-9 bg-stone-100 rounded-xl animate-pulse" />
            ) : isLoggedIn ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-emerald-800 hover:bg-emerald-900 text-white shadow-md shadow-emerald-900/15 transition cursor-pointer"
              >
                ড্যাশবোর্ডে যান
                <ArrowRight className="w-4 h-4 text-emerald-300" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold text-stone-700 hover:text-emerald-800 hover:bg-stone-100 transition"
                >
                  লগইন
                </Link>
                <Link
                  href="/tree/guest"
                  className="inline-flex items-center gap-1.5 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-emerald-800 hover:bg-emerald-900 text-white shadow-md shadow-emerald-900/15 transition cursor-pointer"
                >
                  বংশধারা তৈরি করুন
                  <ArrowRight className="w-4 h-4 text-emerald-300" />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1">
        {/* ২. হিরো সেকশন: দুই কলাম লেআউট (বামপাশে বার্তা, ডানপাশে ভিজ্যুয়াল প্রিভিউ কার্ড) */}
        <section className="relative overflow-hidden pt-10 pb-16 sm:pt-16 sm:pb-24 lg:pt-20 lg:pb-28 bg-radial from-emerald-50/70 via-stone-50/80 to-stone-50">
          {/* Subtle Ambient Decorative Circles */}
          <div className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-emerald-500/10 pointer-events-none -z-10" />
          <div className="absolute top-1/2 right-10 -translate-y-1/2 w-[500px] h-[500px] rounded-full border border-amber-400/15 pointer-events-none -z-10" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
              {/* বামপাশে: টাইটেল, ট্যাগলাইন ও CTA */}
              <div className="lg:col-span-6 space-y-6 text-center lg:text-left">
                {/* ওভারলাইন ব্যাজ */}
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-amber-300/90 shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-xs sm:text-sm font-bold text-emerald-950 font-serif tracking-wide">
                    আমাদের শিকড়, আমাদের পরিচয়
                  </span>
                </div>

                {/* বড় শিরোনাম ও সাব-হেডলাইন */}
                <div className="space-y-2">
                  <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-emerald-950 tracking-tight font-serif">
                    বংশধারা
                  </h1>
                  <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-stone-800 font-serif leading-tight">
                    প্রজন্ম থেকে প্রজন্মের ইতিহাস
                  </p>
                </div>

                {/* সংক্ষিপ্ত ও মার্জিত বর্ণনা */}
                <p className="text-base sm:text-lg text-stone-600 leading-relaxed max-w-xl mx-auto lg:mx-0">
                  পরিবারের ঐতিহ্য, পূর্বপুরুষদের স্মৃতি এবং রক্তের সম্পর্ককে
                  ডিজিটাল ক্যানভাসে চিরকাল জীবন্ত রাখার আধুনিক মাধ্যম। স্বয়ংক্রিয়
                  সম্পর্ক নির্ণয়, খ্রিস্টাব্দ ও বঙ্গাব্দ জীবনকাল এবং এক ক্লিকে
                  অফিশিয়াল প্রিন্ট বা শেয়ার করুন।
                </p>

                {/* দুটি CTA বাটন */}
                <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-3.5">
                  <Link
                    href={isLoggedIn ? "/dashboard" : "/tree/guest"}
                    className="inline-flex items-center gap-2.5 px-6 py-3.5 sm:px-7 sm:py-4 rounded-2xl text-sm sm:text-base font-bold bg-emerald-800 hover:bg-emerald-900 text-white shadow-xl shadow-emerald-900/20 hover:-translate-y-0.5 transition duration-200 cursor-pointer"
                  >
                    <TreePine className="w-5 h-5 text-amber-300" />
                    {isLoggedIn ? "আপনার ড্যাশবোর্ডে যান" : "বংশধারা তৈরি করুন"}
                    <ArrowRight className="w-4 h-4 text-emerald-300" />
                  </Link>

                  <a
                    href="#features"
                    className="inline-flex items-center gap-2 px-5 py-3.5 sm:px-6 sm:py-4 rounded-2xl text-sm sm:text-base font-semibold bg-white hover:bg-stone-100 text-stone-800 border border-stone-300 shadow-2xs transition duration-200 cursor-pointer"
                  >
                    <Compass className="w-4 h-4 text-emerald-700" />
                    ফিচারসমূহ দেখুন
                  </a>
                </div>

                {/* ট্রাস্ট ব্যাজ */}
                <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-5 text-xs font-semibold text-stone-600">
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    বিশুদ্ধ বাংলা ইন্টারফেস
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    খ্রিস্টাব্দ ও বঙ্গাব্দ সাল
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    A4 প্রিন্ট ও অফলাইন ব্যাকআপ
                  </span>
                </div>
              </div>

              {/* ডানপাশে: ফ্রেমড ভিজ্যুয়াল প্রিভিউ কার্ড (হায়ারার্কিক্যাল কাঠামো: প্রজন্ম ১ → একাধিক স্ত্রী → সন্তান) */}
              <div id="preview" className="lg:col-span-6">
                <div className="relative rounded-3xl border-2 border-emerald-600/40 bg-gradient-to-b from-emerald-50/60 via-white to-stone-50/80 p-5 sm:p-7 shadow-2xl shadow-emerald-950/10 ring-8 ring-emerald-500/5">
                  {/* ক্যানভাস প্রিভিউ হেডার বার */}
                  <div className="flex items-center justify-between pb-4 mb-6 border-b border-stone-200/80 bg-white/80 p-3 rounded-2xl">
                    <div className="flex items-center gap-2.5">
                      <div className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-xl overflow-hidden shadow-2xs ring-1 ring-emerald-600/30 shrink-0 bg-emerald-950">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="/images/bongshodhara-logo.gif"
                          alt="বংশধারা লোগো"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <h3 className="font-bold text-xs sm:text-sm text-stone-900 leading-tight">
                          খান পরিবার বংশধারা
                        </h3>
                        <p className="text-[10px] text-stone-500">
                          মোট ৯ জন সদস্য • ৩টি প্রজন্ম
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                        <Maximize2 className="w-2.5 h-2.5 text-emerald-600" />
                        ফিট ভিউ
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                        <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                        পান্না ফ্রেম
                      </span>
                    </div>
                  </div>

                  {/* গাছের নোড কাঠামো */}
                  <div className="space-y-6">
                    {/* প্রজন্ম ১: মূল পিতা / পূর্বপুরুষ */}
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-full mb-2">
                        প্রজন্ম ১ • আদি পিতা
                      </span>

                      {/* পিতা কার্ড */}
                      <div className="relative w-full max-w-[270px] bg-white rounded-2xl border-2 border-emerald-500 shadow-md p-3">
                        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-amber-500 text-white p-1 rounded-full shadow-2xs">
                          <Crown className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 border border-sky-200 flex items-center justify-center shrink-0">
                            <Users className="w-5 h-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-bold text-sky-700 bg-sky-50 px-1.5 py-0.2 rounded">
                                পুরুষ
                              </span>
                              <span className="text-[9px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded">
                                মরহুম
                              </span>
                            </div>
                            <h4 className="font-bold text-xs sm:text-sm text-stone-900 truncate mt-0.5">
                              হাজী মো: আকবর খান
                            </h4>
                            <p className="text-[9px] text-stone-500 flex items-center gap-1 mt-0.5 truncate">
                              <Calendar className="w-2.5 h-2.5 text-stone-400 shrink-0" />
                              <span>১৯৩০ খ্রি. (১৩৩৭ বঙ্গাব্দ) — ২০১৮ খ্রি.</span>
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* কানেক্টর লাইন: পিতা থেকে একাধিক স্ত্রী */}
                      <div className="w-0.5 h-4 bg-emerald-500" />
                      <div className="w-48 sm:w-60 h-0.5 bg-emerald-500" />
                    </div>

                    {/* একাধিক স্ত্রী (Spouse 1 & Spouse 2) */}
                    <div>
                      <div className="grid grid-cols-2 gap-3 sm:gap-4 max-w-md mx-auto">
                        {/* স্ত্রী ১ */}
                        <div className="bg-white rounded-xl border border-rose-200 shadow-2xs p-2.5 text-left relative">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center shrink-0">
                              <Heart className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[8px] font-bold text-rose-700">স্ত্রী ১</span>
                                <span className="text-[8px] text-slate-500 bg-slate-100 px-1 rounded">মরহুম</span>
                              </div>
                              <h5 className="font-bold text-[11px] text-stone-900 truncate">
                                সৈয়দা রাবেয়া খাতুন
                              </h5>
                              <p className="text-[8px] text-stone-400">১৯৩৫–২০১০ খ্রি.</p>
                            </div>
                          </div>
                          {/* স্ত্রী ১ থেকে সন্তান সংযোগ লাইন */}
                          <div className="w-0.5 h-3 bg-emerald-500 mx-auto mt-2" />
                        </div>

                        {/* স্ত্রী ২ */}
                        <div className="bg-white rounded-xl border border-rose-200 shadow-2xs p-2.5 text-left relative">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center shrink-0">
                              <Heart className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[8px] font-bold text-rose-700">স্ত্রী ২</span>
                                <span className="text-[8px] text-emerald-700 bg-emerald-50 px-1 rounded font-semibold">জীবিত</span>
                              </div>
                              <h5 className="font-bold text-[11px] text-stone-900 truncate">
                                জাহানারা বেগম
                              </h5>
                              <p className="text-[8px] text-stone-400">১৯৪৮ খ্রি. (১৩৫৫ বঙ্গাব্দ)</p>
                            </div>
                          </div>
                          {/* স্ত্রী ২ থেকে সন্তান সংযোগ লাইন */}
                          <div className="w-0.5 h-3 bg-emerald-500 mx-auto mt-2" />
                        </div>
                      </div>
                    </div>

                    {/* প্রজন্ম ২: সন্তানাদি (সন্তান ১, সন্তান ২, সন্তান ৩) */}
                    <div>
                      <div className="text-center mb-2">
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-full">
                          প্রজন্ম ২ • সন্তানাদি
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        {/* সন্তান ১ (স্ত্রী ১ থেকে) */}
                        <div className="bg-white rounded-xl border border-stone-200 p-2 text-left shadow-2xs">
                          <span className="text-[8px] font-bold text-sky-700 bg-sky-50 px-1 py-0.2 rounded">
                            ছেলে • জীবিত
                          </span>
                          <h6 className="font-bold text-[11px] text-stone-900 truncate mt-1">
                            রফিকুল খান
                          </h6>
                          <p className="text-[8px] text-stone-500">১৯৬৫ খ্রি.</p>
                          <span className="text-[8px] text-emerald-700 font-semibold block mt-1">
                            সন্তান: ২ জন
                          </span>
                        </div>

                        {/* সন্তান ২ (স্ত্রী ১ থেকে) */}
                        <div className="bg-white rounded-xl border border-stone-200 p-2 text-left shadow-2xs">
                          <span className="text-[8px] font-bold text-rose-700 bg-rose-50 px-1 py-0.2 rounded">
                            মেয়ে • জীবিত
                          </span>
                          <h6 className="font-bold text-[11px] text-stone-900 truncate mt-1">
                            নাসরীন আক্তার
                          </h6>
                          <p className="text-[8px] text-stone-500">১৯৭০ খ্রি.</p>
                          <span className="text-[8px] text-emerald-700 font-semibold block mt-1">
                            সন্তান: ২ জন
                          </span>
                        </div>

                        {/* সন্তান ৩ (স্ত্রী ২ থেকে) */}
                        <div className="bg-white rounded-xl border border-stone-200 p-2 text-left shadow-2xs">
                          <span className="text-[8px] font-bold text-sky-700 bg-sky-50 px-1 py-0.2 rounded">
                            ছেলে • জীবিত
                          </span>
                          <h6 className="font-bold text-[11px] text-stone-900 truncate mt-1">
                            তারেক খান
                          </h6>
                          <p className="text-[8px] text-stone-500">১৯৮২ খ্রি.</p>
                          <span className="text-[8px] text-emerald-700 font-semibold block mt-1">
                            সন্তান: ১ জন
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* প্রিভিউ কার্ড ফুটার বার */}
                  <div className="mt-5 pt-3 border-t border-stone-200/80 flex items-center justify-between text-[10px] text-stone-500">
                    <span className="font-medium text-emerald-800">
                      সবুজ কানেক্টর ও স্বয়ংক্রিয় শাখা বিন্যাস
                    </span>
                    <span>বংশধারা চার্ট প্রিভিউ</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ৩. মূল ফিচার গ্রিড: 'কেন "বংশধারা" ব্যবহার করবেন?' */}
        <section
          id="features"
          className="py-16 sm:py-24 bg-white border-y border-stone-200/80"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-14 sm:mb-16">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-3.5 py-1 rounded-full border border-amber-200/80">
                সমৃদ্ধ ও আধুনিক প্ল্যাটফর্ম
              </span>
              <h2 className="text-3xl sm:text-5xl font-black text-emerald-950 mt-3 font-serif">
                কেন &ldquo;বংশধারা&rdquo; ব্যবহার করবেন?
              </h2>
              <p className="text-base sm:text-lg text-stone-600 mt-3">
                পারিবারিক শিকড়ের সন্ধান ও ঐতিহ্যের সুরক্ষায় তৈরি প্রতিটি ফিচার
                পরিকল্পিত, নির্ভুল এবং বাংলায় পরিপূর্ণ।
              </p>
            </div>

            {/* ৬টি কার্ডের গ্রিড */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {/* ফিচার ১: হায়ারার্কিক্যাল চার্ট */}
              <div className="bg-stone-50/70 rounded-3xl p-6 sm:p-7 border border-stone-200 shadow-2xs hover:shadow-md hover:border-emerald-500/50 hover:bg-white transition-all duration-200 flex flex-col justify-between group">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100/70 text-emerald-800 border border-emerald-200 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                    <GitBranch className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-stone-900 group-hover:text-emerald-800 transition font-serif">
                    ১. হায়ারার্কিক্যাল চার্ট
                  </h3>
                  <p className="text-sm text-stone-600 mt-2.5 leading-relaxed">
                    অসীম ক্যানভাসে জুম, প্যান ও স্মুথ ড্র্যাগ সুবিধা। পিতা-মাতা,
                    একাধিক স্ত্রী/স্বামী এবং সন্তানদের স্বয়ংক্রিয় আধুনিক নোড
                    লেআউটে সুন্দরভাবে সাজানো থাকে।
                  </p>
                </div>
                <div className="mt-5 pt-4 border-t border-stone-200/80 flex items-center gap-1 text-xs font-bold text-emerald-700">
                  <span>স্মুথ ড্র্যাগ ও ফিট ভিউ</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* ফিচার ২: ছবি ও স্ট্যাটাস */}
              <div className="bg-stone-50/70 rounded-3xl p-6 sm:p-7 border border-stone-200 shadow-2xs hover:shadow-md hover:border-emerald-500/50 hover:bg-white transition-all duration-200 flex flex-col justify-between group">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-sky-100/70 text-sky-800 border border-sky-200 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                    <Camera className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-stone-900 group-hover:text-emerald-800 transition font-serif">
                    ২. ছবি ও স্ট্যাটাস
                  </h3>
                  <p className="text-sm text-stone-600 mt-2.5 leading-relaxed">
                    সদস্যদের ছবি আপলোড, জীবিত/মরহুম স্ট্যাটাস, পেশা ও ঠিকানা।
                    একই সাথে ইংরেজি খ্রিস্টাব্দ ও ঐতিহ্যবাহী বাংলা সন (বঙ্গাব্দ)
                    দ্বৈত সাল প্রদর্শনের চমৎকার ব্যবস্থা।
                  </p>
                </div>
                <div className="mt-5 pt-4 border-t border-stone-200/80 flex items-center gap-1 text-xs font-bold text-sky-700">
                  <span>মোবাইল ড্রয়ার ও দ্বৈত সাল</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* ফিচার ৩: সম্পর্ক ক্যালকুলেটর ও সার্চ */}
              <div className="bg-stone-50/70 rounded-3xl p-6 sm:p-7 border border-stone-200 shadow-2xs hover:shadow-md hover:border-emerald-500/50 hover:bg-white transition-all duration-200 flex flex-col justify-between group">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-rose-100/70 text-rose-800 border border-rose-200 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                    <HeartHandshake className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-stone-900 group-hover:text-emerald-800 transition font-serif">
                    ৩. সম্পর্ক ক্যালকুলেটর ও সার্চ
                  </h3>
                  <p className="text-sm text-stone-600 mt-2.5 leading-relaxed">
                    যেকোনো দুজন সদস্য নির্বাচন করলেই তাদের মধ্যকার শর্টেস্ট
                    রক্তের বা বৈবাহিক সংযোগ এবং খাঁটি বাংলা আত্মীয়তার নাম
                    (চাচা, মামা, ফুফু, নাতি ইত্যাদি) দ্রুত নির্ণয় করুন।
                  </p>
                </div>
                <div className="mt-5 pt-4 border-t border-stone-200/80 flex items-center gap-1 text-xs font-bold text-rose-700">
                  <span>শর্টেস্ট পাথ ও বাংলা পরিচয়</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* ফিচার ৪: শাখা ভাঁজ ও বংশপঞ্জি রিপোর্ট */}
              <div className="bg-stone-50/70 rounded-3xl p-6 sm:p-7 border border-stone-200 shadow-2xs hover:shadow-md hover:border-emerald-500/50 hover:bg-white transition-all duration-200 flex flex-col justify-between group">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-purple-100/70 text-purple-800 border border-purple-200 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                    <Printer className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-stone-900 group-hover:text-emerald-800 transition font-serif">
                    ৪. শাখা ভাঁজ ও বংশপঞ্জি রিপোর্ট
                  </h3>
                  <p className="text-sm text-stone-600 mt-2.5 leading-relaxed">
                    বিশাল বংশলতিকার যেকোনো শাখা এক ক্লিকে ভাঁজ (collapse) বা
                    প্রসারিত করুন। প্রজন্ম ১, ২, ৩ ক্রমানুসারে পিতা-মাতা,
                    জীবনসঙ্গী ও সন্তানদের সুবিন্যস্ত A4 প্রিন্ট ও PDF রিপোর্ট।
                  </p>
                </div>
                <div className="mt-5 pt-4 border-t border-stone-200/80 flex items-center gap-1 text-xs font-bold text-purple-700">
                  <span>অফিশিয়াল A4 প্রিন্ট রেজিস্টার</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* ফিচার ৫: ফ্রেমড এক্সপোর্ট ও JSON ব্যাকআপ */}
              <div className="bg-stone-50/70 rounded-3xl p-6 sm:p-7 border border-stone-200 shadow-2xs hover:shadow-md hover:border-emerald-500/50 hover:bg-white transition-all duration-200 flex flex-col justify-between group">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-amber-100/70 text-amber-800 border border-amber-200 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                    <Download className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-stone-900 group-hover:text-emerald-800 transition font-serif">
                    ৫. ফ্রেমড এক্সপোর্ট ও JSON ব্যাকআপ
                  </h3>
                  <p className="text-sm text-stone-600 mt-2.5 leading-relaxed">
                    পান্না সবুজ বা রয়্যাল গোল্ড ফ্রেমে বাঁধানো হাই-রেজ্যুলেশন
                    PNG ও PDF ডাউনলোড। কোনো তথ্য হারানোর ভয় নেই—এক ক্লিকে সম্পূর্ণ
                    অফলাইন JSON ফাইল ব্যাকআপ ও রিস্টোর করার সুবিধা।
                  </p>
                </div>
                <div className="mt-5 pt-4 border-t border-stone-200/80 flex items-center gap-1 text-xs font-bold text-amber-700">
                  <span>পান্না/রয়্যাল ফ্রেম ও রিস্টোর</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* ফিচার ৬: সহজ শেয়ার লিংক */}
              <div className="bg-stone-50/70 rounded-3xl p-6 sm:p-7 border border-stone-200 shadow-2xs hover:shadow-md hover:border-emerald-500/50 hover:bg-white transition-all duration-200 flex flex-col justify-between group">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-teal-100/70 text-teal-800 border border-teal-200 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                    <Share2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-stone-900 group-hover:text-emerald-800 transition font-serif">
                    ৬. সহজ শেয়ার লিংক
                  </h3>
                  <p className="text-sm text-stone-600 mt-2.5 leading-relaxed">
                    লগইন বা পাসওয়ার্ডের ঝামেলা ছাড়া পরিবারের স্বজনদের সাথে
                    অনন্য শেয়ারিং লিংকে চার্ট শেয়ার করুন। সুরক্ষিত ভিউ-অনলি
                    মোডে যেকোনো স্মার্টফোনে সুন্দরভাবে দেখা যাবে।
                  </p>
                </div>
                <div className="mt-5 pt-4 border-t border-stone-200/80 flex items-center gap-1 text-xs font-bold text-teal-700">
                  <span>পাসওয়ার্ডহীন সুরক্ষিত ভিউ</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ৪. 'মাত্র ৩ ধাপে শুরু করুন' সেকশন */}
        <section
          id="how-it-works"
          className="py-16 sm:py-24 bg-stone-50/70"
        >
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                সহজ প্রক্রিয়া
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-stone-900 mt-3 font-serif">
                মাত্র ৩ ধাপে শুরু করুন
              </h2>
              <p className="text-sm sm:text-base text-stone-500 mt-2">
                কোনো জটিলতা ছাড়াই আপনার পারিবারিক ইতিহাস চিরদিনের জন্য সংরক্ষণ করুন।
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
              {/* ধাপ ১ */}
              <div className="text-center space-y-3.5 p-7 rounded-3xl bg-white border border-stone-200 shadow-2xs hover:shadow-sm transition">
                <div className="w-12 h-12 rounded-2xl bg-emerald-800 text-amber-300 font-black text-lg flex items-center justify-center mx-auto shadow-sm">
                  ১
                </div>
                <h3 className="font-bold text-base sm:text-lg text-stone-900 font-serif">
                  মূল পূর্বপুরুষ যোগ করুন
                </h3>
                <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                  পরিবারের আদি পিতা বা প্রধান পূর্বপুরুষের নাম দিয়ে এক মিনিটে
                  বংশধারা শুরু করুন।
                </p>
              </div>

              {/* ধাপ ২ */}
              <div className="text-center space-y-3.5 p-7 rounded-3xl bg-white border border-stone-200 shadow-2xs hover:shadow-sm transition">
                <div className="w-12 h-12 rounded-2xl bg-emerald-800 text-amber-300 font-black text-lg flex items-center justify-center mx-auto shadow-sm">
                  ২
                </div>
                <h3 className="font-bold text-base sm:text-lg text-stone-900 font-serif">
                  জীবনসঙ্গী ও সন্তানাদি সাজান
                </h3>
                <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                  একাধিক স্ত্রী/স্বামী, সন্তান ও বংশধরদের নাম, ছবি এবং জন্ম-মৃত্যু
                  সাল ড্রয়ারের মাধ্যমে যুক্ত করুন।
                </p>
              </div>

              {/* ধাপ ৩ */}
              <div className="text-center space-y-3.5 p-7 rounded-3xl bg-white border border-stone-200 shadow-2xs hover:shadow-sm transition">
                <div className="w-12 h-12 rounded-2xl bg-emerald-800 text-amber-300 font-black text-lg flex items-center justify-center mx-auto shadow-sm">
                  ৩
                </div>
                <h3 className="font-bold text-base sm:text-lg text-stone-900 font-serif">
                  শেয়ার ও প্রিন্ট করুন
                </h3>
                <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                  পরিবারের আড্ডায় শেয়ার করুন, সুন্দর ফ্রেমে ডাউনলোড করুন কিংবা
                  A4 সাইজে বংশপঞ্জি প্রিন্ট করুন।
                </p>
              </div>
            </div>

            {/* কল-টু-অ্যাকশন স্ট্রিপ */}
            <div className="mt-12 text-center">
              <Link
                href={isLoggedIn ? "/dashboard" : "/tree/guest"}
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl text-sm sm:text-base font-bold bg-emerald-800 hover:bg-emerald-900 text-white shadow-lg shadow-emerald-900/15 transition cursor-pointer"
              >
                <TreePine className="w-5 h-5 text-amber-300" />
                {isLoggedIn ? "ড্যাশবোর্ডে প্রবেশ করুন" : "বংশধারা তৈরি করুন"}
                <ArrowRight className="w-4 h-4 ml-0.5" />
              </Link>
            </div>
          </div>
        </section>

        {/* নির্মাতার কথা সেকশন */}
        <section
          id="creator"
          className="py-16 sm:py-24 bg-gradient-to-b from-stone-50/80 to-white border-t border-stone-200/80"
        >
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="relative rounded-3xl border-2 border-emerald-600/35 bg-gradient-to-br from-white via-stone-50 to-emerald-50/40 p-6 sm:p-10 md:p-12 shadow-xl shadow-emerald-950/5 ring-8 ring-amber-400/15 overflow-hidden">
              {/* Subtle gold decorative glow */}
              <div className="absolute top-0 right-0 w-72 h-72 bg-radial from-amber-400/15 via-amber-300/5 to-transparent rounded-full pointer-events-none -mr-20 -mt-20" />

              {/* Header Badge & Title */}
              <div className="text-center sm:text-left mb-6 sm:mb-8">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-300/80 text-xs font-bold font-serif mb-3 shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  উদ্যোক্তা ও ভাবনা
                </span>
                <h2 className="text-2xl sm:text-4xl font-black text-emerald-950 font-serif tracking-tight">
                  নির্মাতার কথা
                </h2>
              </div>

              {/* Exact Text Content */}
              <div className="space-y-4 text-sm sm:text-base text-stone-700 leading-relaxed font-normal">
                <p>
                  সময়ের স্রোতে অনেক সময় আমাদের পূর্বপুরুষদের নাম, বংশলতিকা ও পারিবারিক ইতিহাস হারিয়ে যায়—নতুন প্রজন্ম জানতে পারে না তাঁদের শিকড়ের গল্প। প্রতিটি পরিবার যেন খুব সহজেই নিজেদের প্রজন্মের পর প্রজন্মের তথ্য, সম্পর্ক, ছবি ও স্মৃতি এক জায়গায় সাজিয়ে ও সংরক্ষণ করে রাখতে পারে, সেই লক্ষ্য থেকেই ‘বংশধারা’ তৈরি করা হয়েছে।
                </p>

                <p>
                  আপনাদের সব পারিবারিক তথ্য সম্পূর্ণ নিরাপদ ও সুরক্ষিত থাকবে। প্ল্যাটফর্মটি ব্যবহার করতে গিয়ে আপনাদের কোনো প্রশ্ন, মতামত বা নতুন কোনো ফিচার যুক্ত করার পরামর্শ থাকলে নিচের ফেসবুক পেজ বা প্রোফাইলের ইনবক্সে নির্দ্বিধায় মেসেজ করতে পারেন।
                </p>
              </div>

              {/* Quote Block */}
              <div className="my-7 p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-emerald-900 via-emerald-850 to-stone-900 text-white shadow-md relative overflow-hidden border border-emerald-700/50">
                <div className="absolute -right-2 -bottom-6 text-emerald-700/30 select-none text-8xl font-serif pointer-events-none leading-none">
                  &rdquo;
                </div>
                <blockquote className="relative z-10 text-sm sm:text-base font-serif italic text-emerald-50 leading-relaxed">
                  &ldquo;প্রজন্ম থেকে প্রজন্মের পারিবারিক ইতিহাস যেন হারিয়ে না যায়, সেই ভাবনা থেকেই ‘বংশধারা’-এর যাত্রা।&rdquo;
                </blockquote>
                <p className="relative z-10 text-xs sm:text-sm font-bold text-amber-300 mt-3 sm:mt-4 text-right tracking-wide">
                  — Md. NaSir AhSan
                </p>
              </div>

              {/* Clickable Social Contact Buttons */}
              <div className="pt-2 flex flex-wrap items-center gap-3.5">
                <a
                  href="https://www.facebook.com/Nasir.Ahsa"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-xs sm:text-sm font-bold bg-[#1877F2] hover:bg-[#166fe5] text-white shadow-md shadow-blue-900/10 hover:-translate-y-0.5 transition duration-200 cursor-pointer"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                  ফেসবুক পেজ
                  <ExternalLink className="w-3.5 h-3.5 ml-0.5 opacity-80" />
                </a>

                <a
                  href="https://www.facebook.com/nasirahsan0"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-xs sm:text-sm font-bold bg-white hover:bg-stone-100 text-stone-800 border border-stone-300 shadow-2xs hover:-translate-y-0.5 transition duration-200 cursor-pointer"
                >
                  <svg className="w-4 h-4 fill-[#1877F2]" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                  ফেসবুক প্রোফাইল
                  <ExternalLink className="w-3.5 h-3.5 ml-0.5 opacity-60" />
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ৫. ফুটার: ব্র্যান্ড নাম ও কপিরাইটে শুধু 'বংশধারা' */}
      <footer className="bg-white border-t border-stone-200/90 pt-12 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-stone-200/80">
            {/* Col 1: ব্র্যান্ড তথ্য */}
            <div className="md:col-span-2 space-y-3.5">
              <div className="flex items-center gap-2.5">
                <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-2xl overflow-hidden shadow-xs ring-1 ring-emerald-600/30 shrink-0 bg-emerald-950">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/bongshodhara-logo.gif"
                    alt="বংশধারা লোগো"
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="font-black text-2xl text-emerald-950 font-serif">
                  বংশধারা
                </span>
              </div>
              <p className="text-sm font-semibold text-emerald-900 font-serif">
                প্রজন্ম থেকে প্রজন্মের ইতিহাস • আমাদের শিকড়, আমাদের পরিচয়
              </p>
              <p className="text-xs text-stone-500 max-w-md leading-relaxed">
                পারিবারিক ঐতিহ্য, পূর্বপুরুষদের স্মৃতি এবং রক্তের সম্পর্ককে
                আধুনিক ডিজিটাল ক্যানভাসে চিরকাল বাঁচিয়ে রাখার অনন্য প্ল্যাটফর্ম।
              </p>
            </div>

            {/* Col 2: ফিচারসমূহ */}
            <div>
              <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-3 font-serif">
                ফিচারসমূহ
              </h4>
              <ul className="space-y-2 text-xs text-stone-600 font-medium">
                <li>হায়ারার্কিক্যাল চার্ট</li>
                <li>সম্পর্ক ক্যালকুলেটর</li>
                <li>বংশপঞ্জি রিপোর্ট ও A4 প্রিন্ট</li>
                <li>খ্রিস্টাব্দ ও বঙ্গাব্দ সমর্থন</li>
                <li>পান্না ও রয়্যাল ফ্রেম এক্সপোর্ট</li>
              </ul>
            </div>

            {/* Col 3: নেভিগেশন ও লিংক */}
            <div>
              <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-3 font-serif">
                নেভিগেশন
              </h4>
              <ul className="space-y-2 text-xs text-stone-600 font-medium">
                <li>
                  <Link href="/dashboard" className="hover:text-emerald-800 transition">
                    ড্যাশবোর্ড
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="hover:text-emerald-800 transition">
                    লগইন / রেজিস্ট্রেশন
                  </Link>
                </li>
                <li>
                  <a href="#preview" className="hover:text-emerald-800 transition">
                    চার্ট প্রিভিউ
                  </a>
                </li>
                <li>
                  <a href="#how-it-works" className="hover:text-emerald-800 transition">
                    ব্যবহার নির্দেশিকা
                  </a>
                </li>
                <li>
                  <a href="#creator" className="hover:text-emerald-800 transition">
                    নির্মাতার কথা
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* কপিরাইট ও আবেগঘন বাংলা বাক্য */}
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-500">
            <p>
              © ২০২৬ বংশধারা। সর্বস্বত্ব সংরক্ষিত।
            </p>
            <p className="font-medium text-emerald-900">
              প্রজন্ম থেকে প্রজন্মে আমাদের আত্মিক মেলবন্ধন অটুট থাকুক।
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
