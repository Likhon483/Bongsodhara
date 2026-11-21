"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  Plus,
  TreePine,
  LogOut,
  ArrowRight,
  Lock,
  Globe,
  X,
  Search,
  Users,
  Share2,
  Trash2,
  ChevronDown,
  Home,
  Calendar,
  Check,
  Loader2,
  Sparkles,
} from "lucide-react";
import { formatErrorMessage } from "@/lib/error-utils";

interface TreeItem {
  id: string;
  title_bn: string;
  description_bn: string | null;
  is_public: boolean;
  share_slug: string | null;
  created_at: string;
  updated_at?: string | null;
}

function toBengaliDigits(num: number | string | null | undefined): string {
  if (num === null || num === undefined) return "০";
  const bn = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return String(num)
    .split("")
    .map((d) => (/\d/.test(d) ? bn[Number(d)] : d))
    .join("");
}

function formatBengaliDate(isoString: string | null | undefined): string {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "";
    const months = [
      "জানুয়ারি",
      "ফেব্রুয়ারি",
      "মার্চ",
      "এপ্রিল",
      "মে",
      "জুন",
      "জুলাই",
      "আগস্ট",
      "সেপ্টেম্বর",
      "অক্টোবর",
      "নভেম্বর",
      "ডিসেম্বর",
    ];
    const day = toBengaliDigits(d.getDate());
    const month = months[d.getMonth()];
    const year = toBengaliDigits(d.getFullYear());
    return `${day} ${month}, ${year}`;
  } catch {
    return "";
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [trees, setTrees] = useState<TreeItem[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Search & interaction states
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedTreeId, setCopiedTreeId] = useState<string | null>(null);
  const [deletingTreeId, setDeletingTreeId] = useState<string | null>(null);

  // Mobile menu dropdown state
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // New tree modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [titleBn, setTitleBn] = useState("");
  const [descriptionBn, setDescriptionBn] = useState("");
  const [rootNameBn, setRootNameBn] = useState("");
  const [rootGender, setRootGender] = useState<"male" | "female" | "other">("male");
  const [creating, setCreating] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  // Load user data and trees
  useEffect(() => {
    let ignore = false;

    async function loadData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      if (!ignore) {
        setUserEmail(user.email ?? null);
      }

      const { data: treeData, error: treeError } = await supabase
        .from("trees")
        .select("id, title_bn, description_bn, is_public, share_slug, created_at, updated_at")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });

      if (!ignore) {
        if (treeError) {
          console.error("loadData treeError:", treeError);
        } else if (treeData) {
          setTrees(treeData);

          // Fetch member counts for these trees
          const treeIds = treeData.map((t) => t.id);
          if (treeIds.length > 0) {
            const { data: personsData } = await supabase
              .from("persons")
              .select("id, tree_id")
              .in("tree_id", treeIds);

            const counts: Record<string, number> = {};
            for (const p of personsData ?? []) {
              counts[p.tree_id] = (counts[p.tree_id] ?? 0) + 1;
            }
            setMemberCounts(counts);
          }
        }
        setLoading(false);
      }
    }

    loadData();

    return () => {
      ignore = true;
    };
  }, [router, supabase]);

  // Filtered trees by search query
  const filteredTrees = useMemo(() => {
    if (!searchQuery.trim()) return trees;
    const q = searchQuery.toLowerCase().trim();
    return trees.filter(
      (t) =>
        t.title_bn.toLowerCase().includes(q) ||
        (t.description_bn && t.description_bn.toLowerCase().includes(q))
    );
  }, [trees, searchQuery]);

  // Overall Statistics
  const totalTrees = trees.length;
  const totalMembers = useMemo(() => {
    return Object.values(memberCounts).reduce((acc, curr) => acc + curr, 0);
  }, [memberCounts]);
  const publicTreesCount = useMemo(() => {
    return trees.filter((t) => t.is_public).length;
  }, [trees]);

  async function handleCreateTree(e: React.FormEvent) {
    e.preventDefault();
    if (!titleBn.trim() || !rootNameBn.trim()) return;

    setCreating(true);
    setModalError(null);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("লগইন সেশন পাওয়া যায়নি। অনুগ্রহ করে আবার লগইন করুন।");
      }

      // 1. Create tree
      const { data: treeData, error: treeError } = await supabase
        .from("trees")
        .insert({
          owner_id: user.id,
          title_bn: titleBn.trim(),
          description_bn: descriptionBn.trim() || null,
        })
        .select()
        .single();

      if (treeError) throw treeError;
      if (!treeData) {
        throw new Error("বংশধারা তৈরি হয়েছে কিন্তু ডাটাবেস থেকে কোনো তথ্য পাওয়া যায়নি।");
      }

      // 2. Create root person
      const { data: rootPerson, error: personError } = await supabase
        .from("persons")
        .insert({
          tree_id: treeData.id,
          full_name_bn: rootNameBn.trim(),
          gender: rootGender,
          is_alive: true,
        })
        .select()
        .single();

      if (personError) throw personError;
      if (!rootPerson) {
        throw new Error("মূল ব্যক্তি তৈরি হয়েছে কিন্তু ডাটাবেস থেকে কোনো তথ্য পাওয়া যায়নি।");
      }

      // 3. Link root_person_id back to tree
      const { error: updateError } = await supabase
        .from("trees")
        .update({ root_person_id: rootPerson.id })
        .eq("id", treeData.id);

      if (updateError) throw updateError;

      setIsModalOpen(false);
      setModalError(null);
      router.push(`/tree/${treeData.id}`);
    } catch (err: unknown) {
      console.error("handleCreateTree error:", err);
      const errorMsg = formatErrorMessage(err);
      setModalError(errorMsg);
      alert(`বংশধারা তৈরি করতে সমস্যা হয়েছে:\n${errorMsg}`);
    } finally {
      setCreating(false);
    }
  }

  async function handleCopyLink(tree: TreeItem, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    let link = "";
    if (typeof window !== "undefined") {
      if (tree.is_public && tree.share_slug) {
        link = `${window.location.origin}/share/${tree.share_slug}`;
      } else {
        link = `${window.location.origin}/tree/${tree.id}`;
      }
      try {
        await navigator.clipboard.writeText(link);
        setCopiedTreeId(tree.id);
        setTimeout(() => setCopiedTreeId(null), 2500);
      } catch {
        alert(`লিংক: ${link}`);
      }
    }
  }

  async function handleDeleteTree(tree: TreeItem, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const confirmed = window.confirm(
      `আপনি কি নিশ্চিত যে "${tree.title_bn}" বংশধারাটি মুছে ফেলতে চান?\n\nসতর্কতা: এর সাথে যুক্ত সব সদস্য, বৈবাহিক সম্পর্ক ও বংশপঞ্জির তথ্য চিরতরে মুছে যাবে।`
    );
    if (!confirmed) return;

    setDeletingTreeId(tree.id);
    try {
      // Delete dependent relations first to avoid foreign key errors
      await supabase.from("parent_child").delete().eq("tree_id", tree.id);
      await supabase.from("unions").delete().eq("tree_id", tree.id);
      await supabase.from("persons").delete().eq("tree_id", tree.id);
      const { error } = await supabase.from("trees").delete().eq("id", tree.id);

      if (error) throw error;

      setTrees((prev) => prev.filter((t) => t.id !== tree.id));
    } catch (err: unknown) {
      console.error("handleDeleteTree error:", err);
      alert(`বংশধারা মুছে ফেলতে সমস্যা হয়েছে:\n${formatErrorMessage(err)}`);
    } finally {
      setDeletingTreeId(null);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-stone-50/70 text-slate-900 selection:bg-emerald-100 selection:text-emerald-900 flex flex-col font-sans">
      {/* মোবাইল-ফার্স্ট টপ বার (স্মার্ট ড্যাশবোর্ড মেনু ড্রপডাউনসহ) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-stone-200/90 shadow-2xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-18 flex items-center justify-between gap-3">
          {/* ব্র্যান্ড লোগো ও নাম: শুধু 'বংশধারা' */}
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-2xl overflow-hidden shadow-md shadow-emerald-950/15 ring-2 ring-emerald-600/30 group-hover:scale-105 transition-transform duration-200 shrink-0 bg-emerald-950">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/bongshodhara-logo.gif"
                alt="বংশধারা লোগো"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <span className="font-black text-xl sm:text-2xl text-emerald-950 font-serif leading-none block">
                বংশধারা
              </span>
              <span className="text-[10px] font-bold text-amber-700 tracking-wider">
                ড্যাশবোর্ড
              </span>
            </div>
          </Link>

          {/* টপ রাইট অ্যাকশন ও স্মার্ট ড্রপডাউন মেনু */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* হোমপেজ লিংক (ডেস্কটপ) */}
            <Link
              href="/"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-stone-600 hover:text-emerald-800 hover:bg-stone-100 transition"
            >
              <Home className="w-4 h-4 text-emerald-700" />
              হোমপেজ
            </Link>

            {/* স্মার্ট 'ড্যাশবোর্ড মেনু' ড্রপডাউন ট্রিগার */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl border border-stone-300/80 bg-white hover:bg-stone-50 text-xs sm:text-sm font-bold text-stone-800 shadow-2xs transition cursor-pointer"
                title="ড্যাশবোর্ড মেনু ও অ্যাকাউন্ট সেটিংস"
              >
                <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                  {userEmail ? userEmail[0].toUpperCase() : "ব"}
                </div>
                <span className="hidden xs:inline font-serif font-bold text-stone-800">
                  ড্যাশবোর্ড মেনু
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-stone-500 transition-transform duration-200 ${
                    menuOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* ড্রপডাউন প্যানেল */}
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white border border-stone-200/90 shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  {/* ব্যবহারকারীর তথ্য */}
                  <div className="px-4 py-3 bg-stone-50/80 border-b border-stone-200/70 mb-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                      লগইনকৃত অ্যাকাউন্ট
                    </p>
                    <p
                      className="text-xs font-bold text-emerald-950 truncate mt-0.5"
                      title={userEmail ?? ""}
                    >
                      {userEmail || "ব্যবহারকারী"}
                    </p>
                  </div>

                  {/* ড্রপডাউন আইটেমস */}
                  <Link
                    href="/dashboard"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-xs sm:text-sm font-semibold text-stone-700 hover:bg-stone-50 hover:text-emerald-800 transition"
                  >
                    <TreePine className="w-4 h-4 text-emerald-700" />
                    আমার ড্যাশবোর্ড
                  </Link>

                  <Link
                    href="/"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-xs sm:text-sm font-semibold text-stone-700 hover:bg-stone-50 hover:text-emerald-800 transition"
                  >
                    <Home className="w-4 h-4 text-stone-500" />
                    প্রধান হোমপেজ
                  </Link>

                  <div className="pt-1 mt-1 border-t border-stone-100">
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs sm:text-sm font-semibold text-rose-600 hover:bg-rose-50 transition cursor-pointer text-left"
                    >
                      <LogOut className="w-4 h-4 text-rose-600" />
                      লগআউট করুন
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* মূল কন্টেন্ট এরিয়া */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex-1 space-y-6 sm:space-y-8 w-full">
        {/* (১) ডিপ এমারেল্ড গ্রিন ওয়েলকাম কার্ড ও '+ নতুন বংশধারা তৈরি করুন' বাটন */}
        <section className="relative rounded-3xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-stone-900 text-white p-6 sm:p-8 shadow-xl shadow-emerald-950/15 border border-emerald-700/40 overflow-hidden">
          {/* Subtle gold ambient glow */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-radial from-amber-400/15 via-amber-300/5 to-transparent rounded-full pointer-events-none -mr-20 -mt-20" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2.5 max-w-2xl">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[11px] font-bold tracking-wide">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                আমাদের শিকড়, আমাদের পরিচয়
              </div>
              <h1 className="text-2xl sm:text-4xl font-black font-serif tracking-tight leading-tight">
                স্বাগতম, আপনার পারিবারিক বংশধারা
              </h1>
              <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed max-w-xl">
                সহজেই পরিবারের প্রতিটি প্রজন্মের শিকড়, রক্তের সম্পর্ক ও স্মৃতি
                এক জায়গায় সাজিয়ে রাখুন। স্বজনদের সাথে শেয়ার কিংবা ফ্রেমে বাঁধাই
                করুন।
              </p>

              {/* Statistics Strip */}
              <div className="pt-2 flex flex-wrap items-center gap-4 text-xs font-semibold text-emerald-200">
                <span className="inline-flex items-center gap-1.5">
                  <TreePine className="w-4 h-4 text-amber-300" />
                  মোট বংশধারা: {toBengaliDigits(totalTrees)} টি
                </span>
                <span>•</span>
                <span className="inline-flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-emerald-300" />
                  অন্তর্ভুক্ত সদস্য: {toBengaliDigits(totalMembers)} জন
                </span>
                <span>•</span>
                <span className="inline-flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-sky-300" />
                  পাবলিক লিংক: {toBengaliDigits(publicTreesCount)} টি
                </span>
              </div>
            </div>

            {/* '+ নতুন বংশধারা তৈরি করুন' প্রাইমারি বাটন */}
            <div className="shrink-0">
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 sm:px-7 sm:py-4 rounded-2xl text-sm sm:text-base font-bold bg-amber-400 hover:bg-amber-300 text-stone-950 shadow-xl shadow-amber-950/20 hover:-translate-y-0.5 transition duration-200 cursor-pointer"
              >
                <Plus className="w-5 h-5 text-stone-950 stroke-[2.5]" />
                নতুন বংশধারা তৈরি করুন
              </button>
            </div>
          </div>
        </section>

        {/* (২) বংশধারা খোঁজার সার্চ ইনপুট */}
        <section className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="বংশধারার নাম বা বিবরণ দিয়ে খুঁজুন..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-stone-300/80 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-xs sm:text-sm text-stone-800 shadow-2xs transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-600 rounded-lg cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="text-xs font-semibold text-stone-500 px-1 flex items-center justify-between sm:justify-end gap-2">
            <span>
              {searchQuery ? (
                <>পাওয়া গেছে: <strong className="text-emerald-900">{toBengaliDigits(filteredTrees.length)}</strong> টি</>
              ) : (
                <>মোট তালিকা: <strong className="text-stone-800">{toBengaliDigits(trees.length)}</strong> টি বংশধারা</>
              )}
            </span>
          </div>
        </section>

        {/* (৩) গোল্ড-বর্ডারযুক্ত বংশধারা কার্ড গ্রিড ও (৪) Empty State */}
        {loading ? (
          /* লোডিং স্কেলিটন */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-56 rounded-3xl bg-white border-2 border-stone-200/80 p-6 animate-pulse space-y-4"
              >
                <div className="h-5 bg-stone-200 rounded-lg w-2/3" />
                <div className="h-4 bg-stone-100 rounded-lg w-full" />
                <div className="h-4 bg-stone-100 rounded-lg w-1/2" />
                <div className="h-10 bg-stone-100 rounded-xl mt-6" />
              </div>
            ))}
          </div>
        ) : trees.length === 0 ? (
          /* (৪) কোনো বংশধারা না থাকলে সুন্দর বাংলা Empty State */
          <div className="bg-white rounded-3xl border-2 border-dashed border-amber-300/70 p-8 sm:p-14 text-center max-w-2xl mx-auto shadow-2xs space-y-4">
            <div className="w-16 h-16 rounded-3xl overflow-hidden shadow-sm ring-2 ring-emerald-600/30 mx-auto bg-emerald-950">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/bongshodhara-logo.gif"
                alt="বংশধারা লোগো"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-xl sm:text-2xl font-bold text-stone-900 font-serif">
                এখনও কোনো বংশধারা তৈরি করা হয়নি
              </h2>
              <p className="text-xs sm:text-sm text-stone-500 max-w-md mx-auto leading-relaxed">
                আপনার পরিবারের আদি পিতা বা মূল ব্যক্তির নাম দিয়ে আজই প্রথম
                বংশধারা শুরু করুন। আমাদের শিকড়, আমাদের পরিচয়।
              </p>
            </div>

            <div className="pt-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold bg-emerald-800 hover:bg-emerald-900 text-white shadow-md shadow-emerald-900/15 transition cursor-pointer"
              >
                <Plus className="w-4 h-4 text-amber-300" />
                প্রথম বংশধারা শুরু করুন
              </button>
            </div>
          </div>
        ) : filteredTrees.length === 0 ? (
          /* সার্চে কিছু না পাওয়া গেলে */
          <div className="bg-white rounded-3xl border border-stone-200 p-8 text-center max-w-md mx-auto shadow-2xs space-y-3">
            <Search className="w-10 h-10 text-stone-400 mx-auto" />
            <h3 className="font-bold text-stone-800 text-base">
              &ldquo;{searchQuery}&rdquo; দিয়ে কোনো বংশধারা মেলেনি
            </h3>
            <p className="text-xs text-stone-500">
              দয়া করে সঠিক নাম বা বিবরণ দিয়ে পুনরায় অনুসন্ধান করুন।
            </p>
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer pt-1"
            >
              সব বংশধারা দেখুন
            </button>
          </div>
        ) : (
          /* (৩) গোল্ড-বর্ডারযুক্ত বংশধারা কার্ড গ্রিড */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {filteredTrees.map((tree) => {
              const count = memberCounts[tree.id] || 0;
              const isDeleting = deletingTreeId === tree.id;
              const isCopied = copiedTreeId === tree.id;

              return (
                <div
                  key={tree.id}
                  className="rounded-3xl border-2 border-amber-300/70 bg-white hover:border-amber-400 p-5 sm:p-6 shadow-sm hover:shadow-xl transition-all duration-200 flex flex-col justify-between group relative ring-4 ring-amber-400/5 hover:ring-amber-400/15"
                >
                  <div className="space-y-3">
                    {/* টপ ব্যাজেস: স্ট্যাটাস ও সদস্য সংখ্যা */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-700 border border-stone-200">
                        {tree.is_public ? (
                          <>
                            <Globe className="w-3 h-3 text-emerald-600" />
                            <span className="text-emerald-800">পাবলিক</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-3 h-3 text-stone-500" />
                            <span>প্রাইভেট</span>
                          </>
                        )}
                      </span>

                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <Users className="w-3 h-3 text-emerald-600" />
                        {toBengaliDigits(count)} জন সদস্য
                      </span>
                    </div>

                    {/* বংশধারার শিরোনাম */}
                    <Link
                      href={`/tree/${tree.id}`}
                      className="block focus:outline-none"
                    >
                      <h3 className="text-lg sm:text-xl font-bold text-stone-900 group-hover:text-emerald-800 transition font-serif leading-snug">
                        {tree.title_bn}
                      </h3>
                    </Link>

                    {/* বিবরণী */}
                    <p className="text-xs sm:text-sm text-stone-600 line-clamp-2 leading-relaxed">
                      {tree.description_bn || "পারিবারিক বংশধারা ও বংশপঞ্জি চার্ট"}
                    </p>

                    {/* তারিখ ও সময় */}
                    <div className="text-[11px] text-stone-400 flex items-center gap-1.5 pt-1">
                      <Calendar className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      <span>
                        তৈরি: {formatBengaliDate(tree.created_at)}
                      </span>
                    </div>
                  </div>

                  {/* কার্ডের ফুটার অ্যাকশন বাটনসমূহ */}
                  <div className="mt-5 pt-4 border-t border-stone-100 flex items-center justify-between gap-2">
                    {/* শেয়ার লিংক বাটন */}
                    <button
                      type="button"
                      onClick={(e) => handleCopyLink(tree, e)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                        isCopied
                          ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                          : "bg-white text-stone-600 hover:bg-stone-50 border-stone-200"
                      }`}
                      title={tree.is_public ? "পাবলিক ভিউ লিংক কপি করুন" : "চার্ট লিংক কপি করুন"}
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>কপি হয়েছে</span>
                        </>
                      ) : (
                        <>
                          <Share2 className="w-3.5 h-3.5 text-stone-500" />
                          <span>লিংক কপি</span>
                        </>
                      )}
                    </button>

                    {/* মুছুন ও চার্ট খুলুন বাটনসমূহ */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => handleDeleteTree(tree, e)}
                        disabled={isDeleting}
                        className="p-1.5 rounded-xl text-stone-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition cursor-pointer disabled:opacity-50"
                        title="এই বংশধারা মুছে ফেলুন"
                      >
                        {isDeleting ? (
                          <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>

                      <Link
                        href={`/tree/${tree.id}`}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold bg-emerald-800 hover:bg-emerald-900 text-white shadow-xs hover:shadow-md transition cursor-pointer"
                      >
                        <span>চার্ট খুলুন</span>
                        <ArrowRight className="w-3.5 h-3.5 text-emerald-200" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* নতুন বংশধারা তৈরি মোডাল (Create Tree Modal) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border-2 border-emerald-600/30 ring-8 ring-amber-400/10">
            {/* মোডাল হেডার */}
            <div className="flex items-start justify-between gap-3 pb-4 mb-4 border-b border-stone-100">
              <div className="flex items-center gap-2.5">
                <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-2xl overflow-hidden shadow-xs ring-1 ring-emerald-600/30 shrink-0 bg-emerald-950">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/bongshodhara-logo.gif"
                    alt="বংশধারা লোগো"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-stone-900 font-serif">
                    নতুন বংশধারা তৈরি করুন
                  </h2>
                  <p className="text-[11px] text-stone-500">
                    মূল পূর্বপুরুষ ও পরিবারের বিবরণ দিন
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setModalError(null);
                }}
                className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* মোডাল ফর্ম */}
            <form onSubmit={handleCreateTree} className="space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block font-semibold text-stone-800 mb-1">
                  বংশধারার নাম (বাংলায়) *
                </label>
                <input
                  type="text"
                  required
                  value={titleBn}
                  onChange={(e) => setTitleBn(e.target.value)}
                  placeholder="যেমন: চৌধুরী পরিবার বংশধারা"
                  className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-stone-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-800 mb-1">
                  মূল বা প্রথম ব্যক্তির নাম *
                </label>
                <input
                  type="text"
                  required
                  value={rootNameBn}
                  onChange={(e) => setRootNameBn(e.target.value)}
                  placeholder="যেমন: হাজী মো: আকবর চৌধুরী"
                  className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-stone-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-800 mb-1">
                  মূল ব্যক্তির লিঙ্গ
                </label>
                <select
                  value={rootGender}
                  onChange={(e) =>
                    setRootGender(e.target.value as "male" | "female" | "other")
                  }
                  className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white text-stone-800 font-medium"
                >
                  <option value="male">পুরুষ</option>
                  <option value="female">মহিলা</option>
                  <option value="other">অন্যান্য</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-stone-800 mb-1">
                  সংক্ষিপ্ত বিবরণ (ঐচ্ছিক)
                </label>
                <textarea
                  rows={2}
                  value={descriptionBn}
                  onChange={(e) => setDescriptionBn(e.target.value)}
                  placeholder="গ্রাম, উপজেলা বা বংশের সংক্ষিপ্ত পরিচিতি..."
                  className="w-full px-3.5 py-2 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-stone-800"
                />
              </div>

              {modalError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 whitespace-pre-line">
                  {modalError}
                </div>
              )}

              {/* ফুটার অ্যাকশন বাটনসমূহ */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setModalError(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-100 cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-emerald-800 hover:bg-emerald-900 text-white shadow-sm transition disabled:opacity-60 cursor-pointer"
                >
                  {creating ? "তৈরি হচ্ছে..." : "বংশধারা তৈরি করুন"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* পরিচ্ছন্ন বাংলা ফুটার */}
      <footer className="bg-white border-t border-stone-200/90 py-6 mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-500">
          <div className="flex items-center gap-2">
            <div className="relative w-5 h-5 rounded-lg overflow-hidden shrink-0 bg-emerald-950">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/bongshodhara-logo.gif"
                alt="বংশধারা লোগো"
                className="w-full h-full object-cover"
              />
            </div>
            <span className="font-bold text-stone-800 font-serif">বংশধারা</span>
            <span>• আমাদের শিকড়, আমাদের পরিচয়</span>
          </div>
          <p>© ২০২৬ বংশধারা। সর্বস্বত্ব সংরক্ষিত।</p>
        </div>
      </footer>
    </div>
  );
}
