"use client";

import { useState, useMemo, useRef } from "react";
import type {
  PersonRecord,
  UnionRecord,
  ParentChildRecord,
} from "@/lib/treeGraph";
import {
  X,
  Printer,
  Download,
  Loader2,
  Table as TableIcon,
  LayoutGrid,
  TreePine,
  User,
  Users,
  Heart,
  UserCheck,
  MapPin,
  Briefcase,
  Calendar,
} from "lucide-react";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { formatLifeDates } from "@/lib/dateUtils";

interface GenealogyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  treeTitle: string;
  treeDescription?: string | null;
  rootPersonId?: string | null;
  persons: PersonRecord[];
  unions: UnionRecord[];
  parentChild: ParentChildRecord[];
}

export interface MemberReportItem {
  person: PersonRecord;
  parents: PersonRecord[];
  spouses: PersonRecord[];
  children: PersonRecord[];
}

export interface GenerationGroup {
  genNumber: number;
  genLabel: string;
  members: MemberReportItem[];
}

function toBengaliDigits(num: number | string): string {
  const bn = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return String(num)
    .split("")
    .map((d) => (/\d/.test(d) ? bn[Number(d)] : d))
    .join("");
}

function formatBengaliDate(date: Date = new Date()): string {
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
  const day = toBengaliDigits(date.getDate());
  const month = months[date.getMonth()];
  const year = toBengaliDigits(date.getFullYear());
  return `${day} ${month}, ${year}`;
}

export default function GenealogyReportModal({
  isOpen,
  onClose,
  treeTitle,
  treeDescription,
  rootPersonId,
  persons,
  unions,
  parentChild,
}: GenealogyReportModalProps) {
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const reportPreviewRef = useRef<HTMLDivElement | null>(null);

  const generationGroups: GenerationGroup[] = useMemo(() => {
    if (persons.length === 0) return [];

    const personMap = new Map<string, PersonRecord>();
    for (const p of persons) personMap.set(p.id, p);

    // Spouses
    const spousesMap = new Map<string, string[]>();
    for (const u of unions) {
      const s1 = spousesMap.get(u.partner_1_id) ?? [];
      if (!s1.includes(u.partner_2_id)) s1.push(u.partner_2_id);
      spousesMap.set(u.partner_1_id, s1);

      const s2 = spousesMap.get(u.partner_2_id) ?? [];
      if (!s2.includes(u.partner_1_id)) s2.push(u.partner_1_id);
      spousesMap.set(u.partner_2_id, s2);
    }

    // Parents & Children
    const parentsMap = new Map<string, string[]>();
    const childrenMap = new Map<string, string[]>();

    for (const pc of parentChild) {
      if (!personMap.has(pc.parent_id) || !personMap.has(pc.child_id)) continue;
      const pList = parentsMap.get(pc.child_id) ?? [];
      if (!pList.includes(pc.parent_id)) pList.push(pc.parent_id);
      parentsMap.set(pc.child_id, pList);

      const cList = childrenMap.get(pc.parent_id) ?? [];
      if (!cList.includes(pc.child_id)) cList.push(pc.child_id);
      childrenMap.set(pc.parent_id, cList);
    }

    // Generation BFS from rootPersonId or first person
    const startId =
      rootPersonId && personMap.has(rootPersonId)
        ? rootPersonId
        : persons[0].id;

    const genMap = new Map<string, number>();
    const queue: string[] = [startId];
    genMap.set(startId, 0);

    while (queue.length > 0) {
      const currId = queue.shift()!;
      const currGen = genMap.get(currId)!;

      // Spouses stay in same generation
      for (const spId of spousesMap.get(currId) ?? []) {
        if (!genMap.has(spId)) {
          genMap.set(spId, currGen);
          queue.push(spId);
        }
      }

      // Children go to gen + 1
      for (const chId of childrenMap.get(currId) ?? []) {
        if (!genMap.has(chId)) {
          genMap.set(chId, currGen + 1);
          queue.push(chId);
        }
      }

      // Parents go to gen - 1
      for (const paId of parentsMap.get(currId) ?? []) {
        if (!genMap.has(paId)) {
          genMap.set(paId, currGen - 1);
          queue.push(paId);
        }
      }
    }

    // Assign fallback generation for any unreached persons
    let fallbackGen = 0;
    for (const p of persons) {
      if (!genMap.has(p.id)) {
        genMap.set(p.id, fallbackGen);
        fallbackGen += 1;
      }
    }

    // Normalize minimum generation to 0
    let minGen = Infinity;
    for (const g of genMap.values()) {
      if (g < minGen) minGen = g;
    }
    const shift = minGen === Infinity ? 0 : -minGen;
    for (const [id, g] of genMap.entries()) {
      genMap.set(id, g + shift);
    }

    // Group members by generation
    const genGroupsMap = new Map<number, PersonRecord[]>();
    for (const p of persons) {
      const g = genMap.get(p.id) ?? 0;
      if (!genGroupsMap.has(g)) genGroupsMap.set(g, []);
      genGroupsMap.get(g)!.push(p);
    }

    const sortedGens = Array.from(genGroupsMap.keys()).sort((a, b) => a - b);

    return sortedGens.map((g, idx) => {
      const memberPersons = genGroupsMap.get(g) ?? [];
      // Sort members within generation: root first, then males first, then name
      memberPersons.sort((a, b) => {
        if (a.id === rootPersonId) return -1;
        if (b.id === rootPersonId) return 1;
        if (a.gender === "male" && b.gender !== "male") return -1;
        if (b.gender === "male" && a.gender !== "male") return 1;
        return a.full_name_bn.localeCompare(b.full_name_bn, "bn");
      });

      const members: MemberReportItem[] = memberPersons.map((p) => ({
        person: p,
        parents: (parentsMap.get(p.id) ?? [])
          .map((id) => personMap.get(id)!)
          .filter(Boolean),
        spouses: (spousesMap.get(p.id) ?? [])
          .map((id) => personMap.get(id)!)
          .filter(Boolean),
        children: (childrenMap.get(p.id) ?? [])
          .map((id) => personMap.get(id)!)
          .filter(Boolean),
      }));

      const genNumber = idx + 1;
      const genLabel =
        genNumber === 1
          ? `প্রজন্ম ১ (মূল পূর্বপুরুষ)`
          : `প্রজন্ম ${toBengaliDigits(genNumber)}`;

      return {
        genNumber,
        genLabel,
        members,
      };
    });
  }, [persons, unions, parentChild, rootPersonId]);

  // Overall statistics
  const stats = useMemo(() => {
    const alive = persons.filter((p) => p.is_alive).length;
    const deceased = persons.length - alive;
    const male = persons.filter((p) => p.gender === "male").length;
    const female = persons.filter((p) => p.gender === "female").length;
    return {
      total: persons.length,
      alive,
      deceased,
      male,
      female,
      generations: generationGroups.length,
    };
  }, [persons, generationGroups]);

  function handlePrint() {
    window.print();
  }

  async function handleDownloadPdf() {
    const el = reportPreviewRef.current;
    if (!el) return;

    setDownloadingPdf(true);
    try {
      // 1. Wait for document.fonts.ready so Bengali fonts are fully loaded
      if (typeof document !== "undefined" && "fonts" in document) {
        await document.fonts.ready;
      }
      await new Promise((resolve) => setTimeout(resolve, 150));

      // 2. High-density pixel ratio (minimum 3x) for crisp Bengali typography
      const pixelRatio = Math.min(
        Math.max(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 3),
        4
      );

      const dataUrl = await toPng(el, {
        cacheBust: true,
        pixelRatio,
        backgroundColor: "#ffffff",
        style: {
          fontFamily:
            "var(--font-hind-siliguri), 'Hind Siliguri', var(--font-noto-bengali), 'Noto Sans Bengali', sans-serif",
          letterSpacing: "normal",
          textRendering: "geometricPrecision",
        },
      });

      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      // A4 portrait in mm: 210 x 297 with margins
      const pdf = new jsPDF({
        orientation: "p",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 8;
      const usableWidth = pageWidth - margin * 2;
      const usableHeight = pageHeight - margin * 2;
      const imgWidth = usableWidth;
      const imgHeight = (img.height * imgWidth) / img.width;

      let heightLeft = imgHeight;
      let position = margin;

      pdf.addImage(dataUrl, "PNG", margin, position, imgWidth, imgHeight, undefined, "FAST");
      heightLeft -= usableHeight;

      while (heightLeft > 0) {
        position -= usableHeight;
        pdf.addPage();
        pdf.addImage(dataUrl, "PNG", margin, position, imgWidth, imgHeight, undefined, "FAST");
        heightLeft -= usableHeight;
      }

      const safeTitle = (treeTitle || "bongshodhara").replace(
        /[^a-zA-Z0-9\u0980-\u09FF_-]/g,
        "_"
      );
      pdf.save(`${safeTitle}-report.pdf`);
    } catch (err) {
      console.error("PDF generation error:", err);
      alert(
        "PDF তৈরি করার সময় একটি সমস্যা হয়েছে। অনুগ্রহ করে 'প্রিন্ট করুন' বাটন চেপে ব্রাউজারের প্রিন্ট ডায়ালগ থেকে 'Save as PDF' নির্বাচন করুন।"
      );
    } finally {
      setDownloadingPdf(false);
    }
  }

  if (!isOpen) return null;

  return (
    <>
      {/* Global Dedicated Print CSS */}
      <style jsx global>{`
        @media screen {
          #bongshodhara-print-report {
            display: none !important;
          }
        }

        @media print {
          /* Hide all regular screen elements */
          body * {
            visibility: hidden;
          }

          /* Hide modal backdrop and interactive UI */
          .no-print,
          header,
          nav,
          aside,
          button,
          input,
          select {
            display: none !important;
          }

          /* Show only the dedicated print section */
          #bongshodhara-print-report,
          #bongshodhara-print-report * {
            visibility: visible !important;
          }

          #bongshodhara-print-report {
            display: block !important;
            position: static !important;
            overflow: visible !important;
            height: auto !important;
            min-height: 100% !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
            border: none !important;
          }

          @page {
            size: A4 portrait;
            margin: 12mm 15mm 15mm 15mm;
          }

          .page-break-avoid {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          table {
            page-break-inside: auto;
            width: 100% !important;
          }

          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          thead {
            display: table-header-group;
          }
        }
      `}</style>

      {/* Screen Interactive Modal (Hidden in Print) */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs no-print animate-in fade-in duration-200">
        <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 flex flex-col h-[94vh] overflow-hidden">
          {/* Header Controls Bar */}
          <div className="px-5 py-3.5 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center shadow-xs">
                <TreePine className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                  বংশপঞ্জি রিপোর্ট ও প্রিন্ট লিস্ট
                </h2>
                <p className="text-[11px] text-slate-500">
                  প্রজন্মভিত্তিক বংশতালিকা রেজিস্টার ও অফিশিয়াল প্রিন্ট ভিউ
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* View Switcher */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-700 border border-slate-200/80">
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    viewMode === "table"
                      ? "bg-white text-emerald-800 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <TableIcon className="w-3.5 h-3.5" />
                  তালিকা ভিউ
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("cards")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    viewMode === "cards"
                      ? "bg-white text-emerald-800 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  কার্ড ভিউ
                </button>
              </div>

              {/* PDF Download Button */}
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition shadow-2xs cursor-pointer disabled:opacity-60"
                title="সরাসরি .pdf ফাইল ডাউনলোড করুন"
              >
                {downloadingPdf ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-700" />
                    PDF তৈরি হচ্ছে...
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5 text-emerald-700" />
                    PDF ডাউনলোড
                  </>
                )}
              </button>

              {/* Print Button */}
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white transition shadow-xs cursor-pointer"
                title="A4 পেপারে প্রিন্ট বা ব্রাউজারের প্রিন্ট ডায়ালগ খুলুন"
              >
                <Printer className="w-3.5 h-3.5" />
                প্রিন্ট করুন
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer ml-1"
                title="বন্ধ করুন"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Scrollable Screen Preview Container */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100/60 flex justify-center">
            <div
              ref={reportPreviewRef}
              className="bg-white w-full max-w-4xl p-6 sm:p-10 rounded-2xl shadow-sm border border-slate-200 space-y-8"
            >
              {/* Document Official Header */}
              <div className="border-b-2 border-emerald-800 pb-5 text-center space-y-2">
                <div className="inline-block px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold tracking-wider mb-1">
                  পারিবারিক বংশপঞ্জি ও বংশতালিকা রেজিস্টার
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  {treeTitle}
                </h1>
                {treeDescription && (
                  <p className="text-xs sm:text-sm text-slate-600 max-w-2xl mx-auto italic">
                    {treeDescription}
                  </p>
                )}

                {/* Summary Strip in Header */}
                <div className="pt-3 flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-xs text-slate-700 border-t border-slate-200/80 mt-4">
                  <span className="font-semibold text-slate-900">
                    মোট সদস্য: {toBengaliDigits(stats.total)} জন
                  </span>
                  <span>•</span>
                  <span>
                    প্রজন্ম সংখ্যা: {toBengaliDigits(stats.generations)} টি
                  </span>
                  <span>•</span>
                  <span>
                    পুরুষ: {toBengaliDigits(stats.male)} | মহিলা:{" "}
                    {toBengaliDigits(stats.female)}
                  </span>
                  <span>•</span>
                  <span className="text-emerald-800 font-medium">
                    জীবিত: {toBengaliDigits(stats.alive)} | মরহুম:{" "}
                    {toBengaliDigits(stats.deceased)}
                  </span>
                  <span>•</span>
                  <span className="text-slate-500">
                    তারিখ: {formatBengaliDate()}
                  </span>
                </div>
              </div>

              {/* Generation Sections */}
              <div className="space-y-8">
                {generationGroups.map((group) => (
                  <section
                    key={group.genNumber}
                    className="space-y-3.5 page-break-avoid"
                  >
                    {/* Generation Header Banner */}
                    <div className="flex items-center justify-between pb-1.5 border-b-2 border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-emerald-800 text-white text-xs font-bold flex items-center justify-center">
                          {toBengaliDigits(group.genNumber)}
                        </span>
                        <h2 className="text-base sm:text-lg font-bold text-slate-900">
                          {group.genLabel}
                        </h2>
                      </div>
                      <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
                        সদস্য: {toBengaliDigits(group.members.length)} জন
                      </span>
                    </div>

                    {/* View: Table Mode */}
                    {viewMode === "table" ? (
                      <div className="overflow-x-auto rounded-xl border border-slate-300">
                        <table className="w-full text-left text-xs text-slate-800 border-collapse">
                          <thead>
                            <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-900 text-[11px]">
                              <th className="py-2.5 px-3 w-10 text-center border-r border-slate-300">
                                নং
                              </th>
                              <th className="py-2.5 px-3 min-w-[130px] border-r border-slate-300">
                                সদস্যের নাম
                              </th>
                              <th className="py-2.5 px-3 min-w-[90px] border-r border-slate-300">
                                অবস্থা
                              </th>
                              <th className="py-2.5 px-3 min-w-[120px] border-r border-slate-300">
                                পিতা ও মাতা
                              </th>
                              <th className="py-2.5 px-3 min-w-[120px] border-r border-slate-300">
                                জীবনসঙ্গী
                              </th>
                              <th className="py-2.5 px-3 min-w-[140px] border-r border-slate-300">
                                সন্তানাদি
                              </th>
                              <th className="py-2.5 px-3 min-w-[120px]">
                                ঠিকানা / পেশা
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {group.members.map((item, mIdx) => (
                              <tr
                                key={item.person.id}
                                className={
                                  mIdx % 2 === 1
                                    ? "bg-slate-50/50"
                                    : "bg-white"
                                }
                              >
                                <td className="py-2 px-3 text-center text-slate-500 font-medium border-r border-slate-200">
                                  {toBengaliDigits(mIdx + 1)}
                                </td>
                                <td className="py-2 px-3 font-semibold text-slate-900 border-r border-slate-200">
                                  <div className="flex items-center gap-1.5">
                                    <span>{item.person.full_name_bn}</span>
                                    {item.person.id === rootPersonId && (
                                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                        মূল
                                      </span>
                                    )}
                                  </div>
                                  {item.person.nickname_bn && (
                                    <span className="text-[10px] text-slate-500 block">
                                      ({item.person.nickname_bn})
                                    </span>
                                  )}
                                  {(() => {
                                    const { lifeSpanSummary } = formatLifeDates({
                                      birthDateAd: item.person.birth_date_ad,
                                      birthDateBs: item.person.birth_date_bs,
                                      deathDateAd: item.person.death_date_ad,
                                      isAlive: item.person.is_alive,
                                    });
                                    if (!lifeSpanSummary) return null;
                                    return (
                                      <span
                                        className="text-[10px] text-slate-500 font-normal flex items-center gap-1 mt-0.5"
                                        title={lifeSpanSummary}
                                      >
                                        <Calendar className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                        <span className="truncate">{lifeSpanSummary}</span>
                                      </span>
                                    );
                                  })()}
                                </td>
                                <td className="py-2 px-3 border-r border-slate-200">
                                  <div className="space-y-0.5">
                                    <span className="text-[11px] font-medium block">
                                      {item.person.gender === "male"
                                        ? "পুরুষ"
                                        : item.person.gender === "female"
                                        ? "মহিলা"
                                        : "অন্যান্য"}
                                    </span>
                                    <span
                                      className={`text-[10px] px-1.5 py-0.2 rounded font-semibold inline-block ${
                                        item.person.is_alive
                                          ? "text-emerald-700 bg-emerald-50 border border-emerald-200"
                                          : "text-slate-600 bg-slate-100 border border-slate-200"
                                      }`}
                                    >
                                      {item.person.is_alive
                                        ? "জীবিত"
                                        : "মরহুম"}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-2 px-3 border-r border-slate-200">
                                  {item.parents.length > 0 ? (
                                    <div className="space-y-0.5 text-[11px]">
                                      {item.parents.map((pa) => (
                                        <span key={pa.id} className="block">
                                          {pa.gender === "male"
                                            ? "পিতা: "
                                            : "মাতা: "}
                                          <span className="font-medium text-slate-800">
                                            {pa.full_name_bn}
                                          </span>
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 italic">
                                      —
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-3 border-r border-slate-200">
                                  {item.spouses.length > 0 ? (
                                    <div className="space-y-0.5 text-[11px]">
                                      {item.spouses.map((sp) => (
                                        <span
                                          key={sp.id}
                                          className="block text-slate-800 font-medium"
                                        >
                                          {sp.full_name_bn}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 italic">
                                      —
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-3 border-r border-slate-200">
                                  {item.children.length > 0 ? (
                                    <div className="text-[11px] text-slate-800">
                                      <span className="font-semibold text-emerald-800 block mb-0.5">
                                        মোট {toBengaliDigits(item.children.length)}{" "}
                                        জন:
                                      </span>
                                      <span className="leading-tight text-slate-700">
                                        {item.children
                                          .map((c) => c.full_name_bn)
                                          .join(", ")}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 italic">
                                      —
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-[11px] text-slate-700">
                                  {item.person.hometown_bn && (
                                    <span className="block truncate">
                                      {item.person.hometown_bn}
                                    </span>
                                  )}
                                  {item.person.occupation_bn && (
                                    <span className="text-slate-500 block truncate">
                                      {item.person.occupation_bn}
                                    </span>
                                  )}
                                  {!item.person.hometown_bn &&
                                    !item.person.occupation_bn && (
                                      <span className="text-slate-400 italic">
                                        —
                                      </span>
                                    )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      /* View: Card Mode */
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {group.members.map((item) => (
                          <div
                            key={item.person.id}
                            className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2 text-xs shadow-2xs"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0 overflow-hidden font-bold">
                                  {item.person.avatar_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={item.person.avatar_url}
                                      alt={item.person.full_name_bn}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <User className="w-4 h-4" />
                                  )}
                                </div>
                                <div>
                                  <h3 className="font-bold text-slate-900">
                                    {item.person.full_name_bn}
                                  </h3>
                                  <span className="text-[10px] text-slate-500">
                                    {item.person.gender === "male"
                                      ? "পুরুষ"
                                      : item.person.gender === "female"
                                      ? "মহিলা"
                                      : "অন্যান্য"}
                                    {" • "}
                                    {item.person.is_alive
                                      ? "জীবিত"
                                      : "মরহুম"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-1 text-[11px] text-slate-600 pt-1 border-t border-slate-100">
                              {(() => {
                                const { lifeSpanSummary } = formatLifeDates({
                                  birthDateAd: item.person.birth_date_ad,
                                  birthDateBs: item.person.birth_date_bs,
                                  deathDateAd: item.person.death_date_ad,
                                  isAlive: item.person.is_alive,
                                });
                                if (!lifeSpanSummary) return null;
                                return (
                                  <div className="flex items-start gap-1 text-slate-600">
                                    <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                                    <span>{lifeSpanSummary}</span>
                                  </div>
                                );
                              })()}
                              {item.parents.length > 0 && (
                                <div className="flex items-start gap-1">
                                  <Users className="w-3.5 h-3.5 text-sky-600 shrink-0 mt-0.5" />
                                  <span>
                                    পিতা-মাতা:{" "}
                                    {item.parents
                                      .map((p) => p.full_name_bn)
                                      .join(" ও ")}
                                  </span>
                                </div>
                              )}

                              {item.spouses.length > 0 && (
                                <div className="flex items-start gap-1">
                                  <Heart className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                                  <span>
                                    জীবনসঙ্গী:{" "}
                                    {item.spouses
                                      .map((s) => s.full_name_bn)
                                      .join(", ")}
                                  </span>
                                </div>
                              )}

                              {item.children.length > 0 && (
                                <div className="flex items-start gap-1">
                                  <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                  <span>
                                    সন্তানাদি (
                                    {toBengaliDigits(item.children.length)} জন):{" "}
                                    {item.children
                                      .map((c) => c.full_name_bn)
                                      .join(", ")}
                                  </span>
                                </div>
                              )}

                              {item.person.hometown_bn && (
                                <div className="flex items-start gap-1">
                                  <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                                  <span>{item.person.hometown_bn}</span>
                                </div>
                              )}

                              {item.person.occupation_bn && (
                                <div className="flex items-start gap-1">
                                  <Briefcase className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5" />
                                  <span>{item.person.occupation_bn}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                ))}
              </div>

              {/* Document Sign-off Footer */}
              <div className="pt-8 border-t-2 border-slate-300 text-xs text-slate-500 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <span className="font-semibold text-slate-700 block">
                      পারিবারিক বংশপঞ্জি রেজিস্টার
                    </span>
                    <span>
                      প্রস্তুতকরণ সফটওয়্যার: বংশধারা (bangla-family-tree)
                    </span>
                  </div>
                  <div className="text-right">
                    <span>মুদ্রণের তারিখ: {formatBengaliDate()}</span>
                  </div>
                </div>

                <div className="pt-6 grid grid-cols-2 sm:grid-cols-3 gap-6 text-center text-slate-600 text-[11px]">
                  <div className="border-t border-slate-400 pt-1">
                    তথ্য সংগ্রহকারীর স্বাক্ষর
                  </div>
                  <div className="border-t border-slate-400 pt-1">
                    পারিবারিক প্রধানের স্বাক্ষর
                  </div>
                  <div className="border-t border-slate-400 pt-1 col-span-2 sm:col-span-1">
                    যাচাইকারীর স্বাক্ষর
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer (Hidden in print) */}
          <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-between no-print shrink-0">
            <span className="text-xs text-slate-500 hidden sm:inline">
              A4 পেপারে মুদ্রণ বা সরাসরি PDF ফাইল ডাউনলোড করতে পারেন।
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition shadow-2xs cursor-pointer disabled:opacity-60"
              >
                {downloadingPdf ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-700" />
                    PDF তৈরি হচ্ছে...
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5 text-emerald-700" />
                    PDF ডাউনলোড
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white transition shadow-xs cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                প্রিন্ট করুন
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white cursor-pointer transition"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Dedicated Section for Native @media print (#bongshodhara-print-report) */}
      <div id="bongshodhara-print-report">
        {/* Document Official Header */}
        <div style={{ borderBottom: "2px solid #065f46", paddingBottom: "14px", textAlign: "center", marginBottom: "20px" }}>
          <div style={{ display: "inline-block", padding: "3px 12px", borderRadius: "9999px", background: "#ecfdf5", color: "#065f46", fontSize: "11px", fontWeight: "bold", marginBottom: "6px" }}>
            পারিবারিক বংশপঞ্জি ও বংশতালিকা রেজিস্টার
          </div>
          <h1 style={{ fontSize: "24px", fontWeight: "900", color: "#0f172a", margin: "4px 0" }}>
            {treeTitle}
          </h1>
          {treeDescription && (
            <p style={{ fontSize: "12px", color: "#475569", fontStyle: "italic", margin: "4px 0" }}>
              {treeDescription}
            </p>
          )}

          {/* Summary Strip */}
          <div style={{ paddingTop: "8px", borderTop: "1px solid #e2e8f0", marginTop: "10px", fontSize: "11px", color: "#334155" }}>
            <span>মোট সদস্য: {toBengaliDigits(stats.total)} জন</span>
            {" • "}
            <span>প্রজন্ম সংখ্যা: {toBengaliDigits(stats.generations)} টি</span>
            {" • "}
            <span>পুরুষ: {toBengaliDigits(stats.male)} | মহিলা: {toBengaliDigits(stats.female)}</span>
            {" • "}
            <span>জীবিত: {toBengaliDigits(stats.alive)} | মরহুম: {toBengaliDigits(stats.deceased)}</span>
            {" • "}
            <span>মুদ্রণের তারিখ: {formatBengaliDate()}</span>
          </div>
        </div>

        {/* Generation by Generation Tables */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {generationGroups.map((group) => (
            <div key={group.genNumber} className="page-break-avoid" style={{ breakInside: "avoid" }}>
              {/* Generation Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #0f172a", paddingBottom: "4px", marginBottom: "8px" }}>
                <h2 style={{ fontSize: "14px", fontWeight: "bold", color: "#0f172a", margin: 0 }}>
                  {group.genLabel}
                </h2>
                <span style={{ fontSize: "11px", fontWeight: "bold", color: "#475569" }}>
                  সদস্য: {toBengaliDigits(group.members.length)} জন
                </span>
              </div>

              {/* Table */}
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", color: "#1e293b", border: "1px solid #cbd5e1" }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1", textAlign: "left" }}>
                    <th style={{ padding: "6px 8px", width: "32px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>নং</th>
                    <th style={{ padding: "6px 8px", borderRight: "1px solid #cbd5e1" }}>সদস্যের নাম</th>
                    <th style={{ padding: "6px 8px", width: "70px", borderRight: "1px solid #cbd5e1" }}>অবস্থা</th>
                    <th style={{ padding: "6px 8px", borderRight: "1px solid #cbd5e1" }}>পিতা ও মাতা</th>
                    <th style={{ padding: "6px 8px", borderRight: "1px solid #cbd5e1" }}>জীবনসঙ্গী</th>
                    <th style={{ padding: "6px 8px", borderRight: "1px solid #cbd5e1" }}>সন্তানাদি</th>
                    <th style={{ padding: "6px 8px" }}>ঠিকানা ও পেশা</th>
                  </tr>
                </thead>
                <tbody>
                  {group.members.map((item, mIdx) => (
                    <tr
                      key={item.person.id}
                      style={{
                        background: mIdx % 2 === 1 ? "#f8fafc" : "#ffffff",
                        borderBottom: "1px solid #e2e8f0",
                        breakInside: "avoid",
                      }}
                    >
                      <td style={{ padding: "6px 8px", textAlign: "center", borderRight: "1px solid #e2e8f0", color: "#64748b" }}>
                        {toBengaliDigits(mIdx + 1)}
                      </td>
                      <td style={{ padding: "6px 8px", fontWeight: "bold", borderRight: "1px solid #e2e8f0" }}>
                        {item.person.full_name_bn}
                        {item.person.id === rootPersonId && " (মূল)"}
                        {item.person.nickname_bn && (
                          <div style={{ fontSize: "10px", fontWeight: "normal", color: "#64748b" }}>
                            ({item.person.nickname_bn})
                          </div>
                        )}
                        {(() => {
                          const { lifeSpanSummary } = formatLifeDates({
                            birthDateAd: item.person.birth_date_ad,
                            birthDateBs: item.person.birth_date_bs,
                            deathDateAd: item.person.death_date_ad,
                            isAlive: item.person.is_alive,
                          });
                          if (!lifeSpanSummary) return null;
                          return (
                            <div style={{ fontSize: "10px", fontWeight: "normal", color: "#475569", marginTop: "2px" }}>
                              {lifeSpanSummary}
                            </div>
                          );
                        })()}
                      </td>
                      <td style={{ padding: "6px 8px", borderRight: "1px solid #e2e8f0" }}>
                        <div>{item.person.gender === "male" ? "পুরুষ" : item.person.gender === "female" ? "মহিলা" : "অন্যান্য"}</div>
                        <div style={{ fontSize: "10px", color: item.person.is_alive ? "#047857" : "#64748b" }}>
                          {item.person.is_alive ? "জীবিত" : "মরহুম"}
                        </div>
                      </td>
                      <td style={{ padding: "6px 8px", borderRight: "1px solid #e2e8f0" }}>
                        {item.parents.length > 0 ? (
                          item.parents.map((p) => (
                            <div key={p.id}>
                              {p.gender === "male" ? "পিতা: " : "মাতা: "}
                              {p.full_name_bn}
                            </div>
                          ))
                        ) : (
                          <span style={{ color: "#94a3b8" }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: "6px 8px", borderRight: "1px solid #e2e8f0" }}>
                        {item.spouses.length > 0 ? (
                          item.spouses.map((s) => <div key={s.id}>{s.full_name_bn}</div>)
                        ) : (
                          <span style={{ color: "#94a3b8" }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: "6px 8px", borderRight: "1px solid #e2e8f0" }}>
                        {item.children.length > 0 ? (
                          <div>
                            <div style={{ fontWeight: "bold", color: "#047857" }}>
                              মোট {toBengaliDigits(item.children.length)} জন:
                            </div>
                            <div>{item.children.map((c) => c.full_name_bn).join(", ")}</div>
                          </div>
                        ) : (
                          <span style={{ color: "#94a3b8" }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: "6px 8px" }}>
                        {item.person.hometown_bn && <div>{item.person.hometown_bn}</div>}
                        {item.person.occupation_bn && (
                          <div style={{ color: "#64748b", fontSize: "10px" }}>
                            {item.person.occupation_bn}
                          </div>
                        )}
                        {!item.person.hometown_bn && !item.person.occupation_bn && (
                          <span style={{ color: "#94a3b8" }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        {/* Document Sign-off Footer */}
        <div style={{ marginTop: "30px", paddingTop: "14px", borderTop: "2px solid #cbd5e1", fontSize: "11px", color: "#475569" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong>পারিবারিক বংশপঞ্জি রেজিস্টার</strong> • সফটওয়্যার: বংশধারা (bangla-family-tree)
            </div>
            <div>মুদ্রণের তারিখ: {formatBengaliDate()}</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px", textAlign: "center", marginTop: "35px", fontSize: "10px", color: "#334155" }}>
            <div style={{ borderTop: "1px solid #64748b", paddingTop: "4px" }}>
              তথ্য সংগ্রহকারীর স্বাক্ষর
            </div>
            <div style={{ borderTop: "1px solid #64748b", paddingTop: "4px" }}>
              পারিবারিক প্রধানের স্বাক্ষর
            </div>
            <div style={{ borderTop: "1px solid #64748b", paddingTop: "4px" }}>
              যাচাইকারীর স্বাক্ষর
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
