"use client";

import { useState, useMemo } from "react";
import type {
  PersonRecord,
  UnionRecord,
  ParentChildRecord,
} from "@/lib/treeGraph";
import {
  calculateRelationship,
  type RelationshipResult,
} from "@/lib/relationshipCalculator";
import {
  X,
  HeartHandshake,
  ArrowRight,
  ArrowLeftRight,
  User,
  Users,
  Search,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from "lucide-react";

interface RelationshipModalProps {
  isOpen: boolean;
  onClose: () => void;
  persons: PersonRecord[];
  unions: UnionRecord[];
  parentChild: ParentChildRecord[];
  initialPersonAId?: string | null;
  initialPersonBId?: string | null;
}

function toBengaliDigits(num: number): string {
  const bn = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return String(num)
    .split("")
    .map((d) => (/\d/.test(d) ? bn[Number(d)] : d))
    .join("");
}

export default function RelationshipModal({
  isOpen,
  onClose,
  persons,
  unions,
  parentChild,
  initialPersonAId,
  initialPersonBId,
}: RelationshipModalProps) {
  const [personAId, setPersonAId] = useState<string>(() => {
    if (initialPersonAId && persons.some((p) => p.id === initialPersonAId)) {
      return initialPersonAId;
    }
    return persons[0]?.id || "";
  });

  const [personBId, setPersonBId] = useState<string>(() => {
    if (initialPersonBId && persons.some((p) => p.id === initialPersonBId)) {
      return initialPersonBId;
    }
    return persons.length > 1 ? persons[1].id : "";
  });

  const [searchA, setSearchA] = useState("");
  const [searchB, setSearchB] = useState("");

  const personA = useMemo(
    () => persons.find((p) => p.id === personAId) ?? null,
    [persons, personAId]
  );

  const personB = useMemo(
    () => persons.find((p) => p.id === personBId) ?? null,
    [persons, personBId]
  );

  // Filtered lists for selection
  const filteredPersonsA = useMemo(() => {
    const q = searchA.trim().toLowerCase();
    if (!q) return persons;
    return persons.filter(
      (p) =>
        p.full_name_bn.toLowerCase().includes(q) ||
        (p.nickname_bn && p.nickname_bn.toLowerCase().includes(q))
    );
  }, [persons, searchA]);

  const filteredPersonsB = useMemo(() => {
    const q = searchB.trim().toLowerCase();
    if (!q) return persons;
    return persons.filter(
      (p) =>
        p.full_name_bn.toLowerCase().includes(q) ||
        (p.nickname_bn && p.nickname_bn.toLowerCase().includes(q))
    );
  }, [persons, searchB]);

  // Calculate relationship result
  const result: RelationshipResult | null = useMemo(() => {
    if (!personAId || !personBId) return null;
    return calculateRelationship({
      personAId,
      personBId,
      persons,
      unions,
      parentChild,
    });
  }, [personAId, personBId, persons, unions, parentChild]);

  function handleSwap() {
    setPersonAId(personBId);
    setPersonBId(personAId);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-50/70 via-white to-emerald-50/40">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                পারিবারিক সম্পর্ক ক্যালকুলেটর
              </h2>
              <p className="text-xs text-slate-500">
                যেকোনো দুজন সদস্যের মধ্যকার আত্মীয়তার সম্পর্ক ও শর্টেস্ট পাথ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            title="বন্ধ করুন"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {/* Selectors Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
            {/* Person A Selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                প্রথম ব্যক্তি (সাপেক্ষ সদস্য)
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="খুঁজুন..."
                  value={searchA}
                  onChange={(e) => setSearchA(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg mb-1 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <select
                value={personAId}
                onChange={(e) => setPersonAId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">সদস্য নির্বাচন করুন...</option>
                {filteredPersonsA.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name_bn} (
                    {p.gender === "male"
                      ? "পুরুষ"
                      : p.gender === "female"
                      ? "মহিলা"
                      : "অন্যান্য"}
                    {!p.is_alive ? ", মরহুম" : ""})
                  </option>
                ))}
              </select>
            </div>

            {/* Swap Button */}
            <div className="flex justify-center pt-2 sm:pt-4">
              <button
                type="button"
                onClick={handleSwap}
                disabled={!personAId || !personBId}
                className="p-2.5 rounded-full bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-slate-600 hover:text-emerald-700 transition cursor-pointer shadow-2xs disabled:opacity-40"
                title="স্থান পরিবর্তন করুন (A ↔ B)"
              >
                <ArrowLeftRight className="w-4 h-4" />
              </button>
            </div>

            {/* Person B Selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                দ্বিতীয় ব্যক্তি (উদ্দিষ্ট সদস্য)
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="খুঁজুন..."
                  value={searchB}
                  onChange={(e) => setSearchB(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg mb-1 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <select
                value={personBId}
                onChange={(e) => setPersonBId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">সদস্য নির্বাচন করুন...</option>
                {filteredPersonsB.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name_bn} (
                    {p.gender === "male"
                      ? "পুরুষ"
                      : p.gender === "female"
                      ? "মহিলা"
                      : "অন্যান্য"}
                    {!p.is_alive ? ", মরহুম" : ""})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Results Presentation */}
          {result && (
            <div className="space-y-4 animate-in fade-in duration-300">
              {result.samePerson ? (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-sm">একই ব্যক্তি</h4>
                    <p className="text-xs text-amber-700 mt-0.5">
                      উভয় স্থানে একই সদস্য নির্বাচন করা হয়েছে। অনুগ্রহ করে দুজন
                      ভিন্ন সদস্য নির্বাচন করুন।
                    </p>
                  </div>
                </div>
              ) : !result.found ? (
                <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-sm">
                      সরাসরি কোনো সংযোগ পাওয়া যায়নি
                    </h4>
                    <p className="text-xs text-rose-700 mt-1 leading-relaxed">
                      {personA?.full_name_bn} এবং {personB?.full_name_bn}-এর
                      মধ্যে বর্তমান বংশতালিকায় সরাসরি কোনো রক্তীয় বা বৈবাহিক সংযোগ
                      তালিকাভুক্ত নেই।
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Hero Relationship Banner */}
                  <div className="p-5 rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-md relative overflow-hidden">
                    <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />

                    <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-white/20 text-emerald-50">
                        <Sparkles className="w-3 h-3" />
                        নির্ণীত আত্মীয়তা
                      </span>
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-black/20 text-emerald-100">
                        {toBengaliDigits(result.stepsCount)} ধাপের সংযোগ
                      </span>
                    </div>

                    <h3 className="text-2xl sm:text-3xl font-black tracking-tight">
                      {result.title}
                    </h3>

                    {result.summaryNote && (
                      <p className="text-xs text-emerald-100/90 font-medium mt-1">
                        ({result.summaryNote})
                      </p>
                    )}

                    <div className="mt-4 pt-3 border-t border-white/20 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="bg-white/10 px-3 py-2 rounded-xl">
                        <span className="text-emerald-200 block text-[10px]">
                          {personA?.full_name_bn}-এর সাপেক্ষে:
                        </span>
                        <p className="font-semibold text-white mt-0.5">
                          {result.relationOfBtoA}
                        </p>
                      </div>
                      <div className="bg-white/10 px-3 py-2 rounded-xl">
                        <span className="text-emerald-200 block text-[10px]">
                          {personB?.full_name_bn}-এর সাপেক্ষে:
                        </span>
                        <p className="font-semibold text-white mt-0.5">
                          {result.relationOfAtoB}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Step-by-Step Shortest Path Flow */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-emerald-600" />
                        সম্পর্কের ধারাবাহিক পথ (Shortest Path)
                      </h4>
                      <span className="text-[11px] text-slate-500">
                        মোট {toBengaliDigits(result.steps.length)} টি ধাপ
                      </span>
                    </div>

                    <div className="flex flex-col gap-2 pt-1">
                      {result.steps.map((step, idx) => (
                        <div
                          key={`${step.fromPerson.id}-${step.toPerson.id}-${idx}`}
                          className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs text-xs"
                        >
                          {/* Step Index */}
                          <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center justify-center shrink-0">
                            {toBengaliDigits(idx + 1)}
                          </span>

                          {/* From Person */}
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 overflow-hidden text-[10px] font-bold">
                              {step.fromPerson.avatar_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={step.fromPerson.avatar_url}
                                  alt={step.fromPerson.full_name_bn}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <User className="w-3.5 h-3.5" />
                              )}
                            </div>
                            <span className="font-semibold text-slate-800 truncate">
                              {step.fromPerson.full_name_bn}
                            </span>
                          </div>

                          {/* Arrow & Edge Label */}
                          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0 font-semibold text-[11px]">
                            <ArrowRight className="w-3 h-3 text-emerald-600" />
                            <span>{step.stepLabel}</span>
                          </div>

                          {/* To Person */}
                          <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
                            <span className="font-semibold text-slate-800 truncate text-right">
                              {step.toPerson.full_name_bn}
                            </span>
                            <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 overflow-hidden text-[10px] font-bold">
                              {step.toPerson.avatar_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={step.toPerson.avatar_url}
                                  alt={step.toPerson.full_name_bn}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <User className="w-3.5 h-3.5" />
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            রক্তীয় ও বৈবাহিক সম্পর্ক সমর্থিত
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white cursor-pointer transition shadow-2xs"
          >
            বন্ধ করুন
          </button>
        </div>
      </div>
    </div>
  );
}
