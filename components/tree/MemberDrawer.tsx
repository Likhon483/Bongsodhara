"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  updateGuestPerson,
  addGuestPerson,
  deleteGuestPerson,
} from "@/lib/guest-tree";
import type {
  PersonRecord,
  UnionRecord,
  ParentChildRecord,
} from "@/lib/tree-layout";
import {
  X,
  UserPlus,
  Heart,
  Users,
  Save,
  Trash2,
  UserCheck,
  Camera,
  Loader2,
  User,
  MapPin,
  Briefcase,
  Calendar,
  Info,
} from "lucide-react";
import { formatErrorMessage } from "@/lib/error-utils";
import { formatLifeDates } from "@/lib/dateUtils";

type RelationMode = "child" | "spouse" | "parent" | "edit";

function toBengaliDigits(num: number): string {
  const bn = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return String(num)
    .split("")
    .map((d) => (/\d/.test(d) ? bn[Number(d)] : d))
    .join("");
}

export interface MemberDrawerProps {
  treeId: string;
  selectedPerson: PersonRecord | null;
  allPersons: PersonRecord[];
  unions: UnionRecord[];
  parentChild: ParentChildRecord[];
  onClose: () => void;
  onUpdated?: () => Promise<void> | void;
  readOnly?: boolean;
  onSelectPerson?: (person: PersonRecord) => void;
}

interface DrawerContentProps {
  treeId: string;
  selectedPerson: PersonRecord;
  allPersons: PersonRecord[];
  unions: UnionRecord[];
  parentChild: ParentChildRecord[];
  mode: RelationMode;
  onChangeMode: (mode: RelationMode) => void;
  onClose: () => void;
  onUpdated: () => Promise<void> | void;
}

function getAvatarFilePath(treeId: string, personId: string, ext: string): string {
  const timestamp = Date.now();
  return `${treeId}/${personId}-${timestamp}.${ext}`;
}

function MemberDrawerContent({
  treeId,
  selectedPerson,
  allPersons,
  unions,
  parentChild,
  mode,
  onChangeMode,
  onClose,
  onUpdated,
}: DrawerContentProps) {
  const supabase = createClient();
  const isGuest = treeId === "guest";

  const existingSpouses = unions
    .filter(
      (u) =>
        u.partner_1_id === selectedPerson.id ||
        u.partner_2_id === selectedPerson.id
    )
    .map((u) => {
      const spouseId =
        u.partner_1_id === selectedPerson.id
          ? u.partner_2_id
          : u.partner_1_id;
      return {
        unionId: u.id,
        person: allPersons.find((p) => p.id === spouseId),
      };
    })
    .filter((item) => Boolean(item.person));

  // Editable details of the currently selected person
  const [memberNameBn, setMemberNameBn] = useState(
    selectedPerson.full_name_bn
  );
  const [memberGender, setMemberGender] = useState<"male" | "female" | "other">(
    selectedPerson.gender
  );
  const [memberHometownBn, setMemberHometownBn] = useState(
    selectedPerson.hometown_bn ?? ""
  );
  const [memberIsAlive, setMemberIsAlive] = useState(selectedPerson.is_alive);
  const [memberBirthDateAd, setMemberBirthDateAd] = useState(
    selectedPerson.birth_date_ad ?? ""
  );
  const [memberBirthDateBs, setMemberBirthDateBs] = useState(
    selectedPerson.birth_date_bs ?? ""
  );
  const [memberDeathDateAd, setMemberDeathDateAd] = useState(
    selectedPerson.death_date_ad ?? ""
  );
  const [memberAvatarUrl, setMemberAvatarUrl] = useState(
    selectedPerson.avatar_url ?? ""
  );
  const [savingMemberInfo, setSavingMemberInfo] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedPerson) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg("ছবির সাইজ সর্বোচ্চ ৫ মেগাবাইট হতে পারবে।");
      return;
    }

    setUploadingAvatar(true);
    setErrorMsg(null);
    setStatusMsg(null);

    if (isGuest) {
      try {
        const reader = new FileReader();
        reader.onload = async (event) => {
          const dataUrl = event.target?.result as string;
          if (!dataUrl) return;
          updateGuestPerson(selectedPerson.id, { avatar_url: dataUrl });
          setMemberAvatarUrl(dataUrl);
          await onUpdated();
          setStatusMsg("ছবি সফলভাবে যুক্ত হয়েছে।");
          setUploadingAvatar(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
        };
        reader.onerror = () => {
          setErrorMsg("ছবি লোড করতে সমস্যা হয়েছে।");
          setUploadingAvatar(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
        };
        reader.readAsDataURL(file);
        return;
      } catch (err: unknown) {
        console.error("handleAvatarUpload guest error:", err);
        setErrorMsg(formatErrorMessage(err));
        setUploadingAvatar(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
    }

    try {
      const ext = file.name.split(".").pop() || "png";
      const filePath = getAvatarFilePath(treeId, selectedPerson.id, ext);

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const publicUrl = publicData.publicUrl;

      const { error: updateError } = await supabase
        .from("persons")
        .update({ avatar_url: publicUrl })
        .eq("id", selectedPerson.id);

      if (updateError) throw updateError;

      setMemberAvatarUrl(publicUrl);
      await onUpdated();
      setStatusMsg("ছবি সফলভাবে আপলোড হয়েছে।");
    } catch (err: unknown) {
      console.error("handleAvatarUpload error:", err);
      setErrorMsg(formatErrorMessage(err));
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handleRemoveAvatar() {
    if (!selectedPerson || !memberAvatarUrl) return;
    setUploadingAvatar(true);
    setErrorMsg(null);
    setStatusMsg(null);

    if (isGuest) {
      try {
        updateGuestPerson(selectedPerson.id, { avatar_url: null });
        setMemberAvatarUrl("");
        await onUpdated();
        setStatusMsg("ছবি সফলভাবে মুছে ফেলা হয়েছে।");
      } catch (err: unknown) {
        console.error("handleRemoveAvatar guest error:", err);
        setErrorMsg(formatErrorMessage(err));
      } finally {
        setUploadingAvatar(false);
      }
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from("persons")
        .update({ avatar_url: null })
        .eq("id", selectedPerson.id);

      if (updateError) throw updateError;
      setMemberAvatarUrl("");
      await onUpdated();
      setStatusMsg("ছবি সফলভাবে মুছে ফেলা হয়েছে।");
    } catch (err: unknown) {
      console.error("handleRemoveAvatar error:", err);
      setErrorMsg(formatErrorMessage(err));
    } finally {
      setUploadingAvatar(false);
    }
  }

  // New related person form state (for child / spouse / parent)
  const [newNameBn, setNewNameBn] = useState("");
  const [newGender, setNewGender] = useState<"male" | "female" | "other">(() => {
    if (mode === "spouse") {
      return selectedPerson.gender === "male" ? "female" : "male";
    }
    return "male";
  });
  const [newHometownBn, setNewHometownBn] = useState(
    selectedPerson.hometown_bn ?? ""
  );
  const [newIsAlive, setNewIsAlive] = useState(true);
  const [selectedSpouseId, setSelectedSpouseId] = useState<string>(
    () => existingSpouses[0]?.person?.id ?? ""
  );
  const [savingRelation, setSavingRelation] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  async function handleSaveSelectedMemberInfo(e: React.FormEvent) {
    e.preventDefault();
    if (!memberNameBn.trim()) return;

    setSavingMemberInfo(true);
    setErrorMsg(null);
    setStatusMsg(null);

    if (isGuest) {
      try {
        updateGuestPerson(selectedPerson.id, {
          full_name_bn: memberNameBn.trim(),
          gender: memberGender,
          hometown_bn: memberHometownBn.trim() || null,
          is_alive: memberIsAlive,
          birth_date_ad: memberBirthDateAd.trim() || null,
          birth_date_bs: memberBirthDateBs.trim() || null,
          death_date_ad: memberIsAlive ? null : (memberDeathDateAd.trim() || null),
          avatar_url: memberAvatarUrl || null,
        });
        await onUpdated();
        setStatusMsg("সদস্যের তথ্য সফলভাবে আপডেট হয়েছে।");
      } catch (err: unknown) {
        console.error("handleSaveSelectedMemberInfo guest error:", err);
        setErrorMsg(formatErrorMessage(err));
      } finally {
        setSavingMemberInfo(false);
      }
      return;
    }

    try {
      const { error } = await supabase
        .from("persons")
        .update({
          full_name_bn: memberNameBn.trim(),
          gender: memberGender,
          hometown_bn: memberHometownBn.trim() || null,
          is_alive: memberIsAlive,
          birth_date_ad: memberBirthDateAd.trim() || null,
          birth_date_bs: memberBirthDateBs.trim() || null,
          death_date_ad: memberIsAlive ? null : (memberDeathDateAd.trim() || null),
        })
        .eq("id", selectedPerson.id);

      if (error) throw error;

      await onUpdated();
      setStatusMsg("সদস্যের তথ্য সফলভাবে আপডেট হয়েছে।");
    } catch (err: unknown) {
      console.error("handleSaveSelectedMemberInfo error:", err);
      setErrorMsg(formatErrorMessage(err));
    } finally {
      setSavingMemberInfo(false);
    }
  }

  async function handleAddRelatedPerson(e: React.FormEvent) {
    e.preventDefault();
    if (!newNameBn.trim() || mode === "edit") return;

    setSavingRelation(true);
    setErrorMsg(null);
    setStatusMsg(null);

    if (isGuest) {
      try {
        addGuestPerson({
          treeId: "guest",
          mode,
          targetPersonId: selectedPerson.id,
          spouseId: selectedSpouseId || null,
          personData: {
            full_name_bn: newNameBn.trim(),
            gender: newGender,
            hometown_bn: newHometownBn.trim() || null,
            is_alive: newIsAlive,
          },
        });
        await onUpdated();
        setNewNameBn("");
        onClose();
      } catch (err: unknown) {
        console.error("handleAddRelatedPerson guest error:", err);
        setErrorMsg(formatErrorMessage(err));
      } finally {
        setSavingRelation(false);
      }
      return;
    }

    try {
      const { data: newPerson, error: personError } = await supabase
        .from("persons")
        .insert({
          tree_id: treeId,
          full_name_bn: newNameBn.trim(),
          gender: newGender,
          hometown_bn: newHometownBn.trim() || null,
          is_alive: newIsAlive,
        })
        .select()
        .single();

      if (personError || !newPerson) throw personError;

      if (mode === "spouse") {
        const { error: unionError } = await supabase.from("unions").insert({
          tree_id: treeId,
          partner_1_id: selectedPerson.id,
          partner_2_id: newPerson.id,
          status: "married",
        });
        if (unionError) throw unionError;
      }

      if (mode === "child") {
        let activeUnionId: string | null = null;
        if (selectedSpouseId) {
          const foundUnion = unions.find(
            (u) =>
              (u.partner_1_id === selectedPerson.id &&
                u.partner_2_id === selectedSpouseId) ||
              (u.partner_2_id === selectedPerson.id &&
                u.partner_1_id === selectedSpouseId)
          );
          activeUnionId = foundUnion?.id ?? null;
        }

        const { error: pcError1 } = await supabase.from("parent_child").insert({
          tree_id: treeId,
          union_id: activeUnionId,
          parent_id: selectedPerson.id,
          child_id: newPerson.id,
          relation_type: "biological",
        });
        if (pcError1) throw pcError1;

        if (selectedSpouseId) {
          const { error: pcError2 } = await supabase
            .from("parent_child")
            .insert({
              tree_id: treeId,
              union_id: activeUnionId,
              parent_id: selectedSpouseId,
              child_id: newPerson.id,
              relation_type: "biological",
            });
          if (pcError2) throw pcError2;
        }
      }

      if (mode === "parent") {
        const { error: pcParentError } = await supabase
          .from("parent_child")
          .insert({
            tree_id: treeId,
            parent_id: newPerson.id,
            child_id: selectedPerson.id,
            relation_type: "biological",
          });
        if (pcParentError) throw pcParentError;
      }

      await onUpdated();
      setNewNameBn("");
      onClose();
    } catch (err: unknown) {
      console.error("handleAddRelatedPerson error:", err);
      setErrorMsg(formatErrorMessage(err));
    } finally {
      setSavingRelation(false);
    }
  }

  async function handleDeletePerson() {
    const confirmed = window.confirm(
      `"${selectedPerson.full_name_bn}"-কে এই বংশতালিকা থেকে মুছে ফেলতে চান?`
    );
    if (!confirmed) return;

    setSavingMemberInfo(true);
    setErrorMsg(null);

    if (isGuest) {
      try {
        deleteGuestPerson(selectedPerson.id);
        await onUpdated();
        onClose();
      } catch (err: unknown) {
        console.error("handleDeletePerson guest error:", err);
        setErrorMsg(formatErrorMessage(err));
      } finally {
        setSavingMemberInfo(false);
      }
      return;
    }

    try {
      const { error } = await supabase
        .from("persons")
        .delete()
        .eq("id", selectedPerson.id);
      if (error) throw error;
      await onUpdated();
      onClose();
    } catch (err: unknown) {
      console.error("handleDeletePerson error:", err);
      setErrorMsg(formatErrorMessage(err));
    } finally {
      setSavingMemberInfo(false);
    }
  }

  const childCount = parentChild.filter(
    (pc) => pc.parent_id === selectedPerson.id
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-stretch justify-center sm:justify-end bg-slate-900/40 backdrop-blur-xs transition-all">
      <div className="w-full sm:max-w-md bg-white h-[92vh] sm:h-full rounded-t-3xl sm:rounded-none shadow-2xl border-t sm:border-t-0 sm:border-l border-slate-200 flex flex-col justify-between overflow-y-auto">
        <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mt-2.5 sm:hidden shrink-0" />
        <div className="p-5 sm:p-6 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                নির্বাচিত সদস্য
              </span>
              <h2 className="text-xl font-bold text-slate-900 mt-1.5">
                {selectedPerson.full_name_bn}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                জীবনসঙ্গী: {existingSpouses.length} জন • সন্তান: {childCount} জন
              </p>
              {(() => {
                const { lifeSpanSummary } = formatLifeDates({
                  birthDateAd: selectedPerson.birth_date_ad,
                  birthDateBs: selectedPerson.birth_date_bs,
                  deathDateAd: selectedPerson.death_date_ad,
                  isAlive: selectedPerson.is_alive,
                });
                if (!lifeSpanSummary) return null;
                return (
                  <p className="text-xs text-slate-600 mt-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{lifeSpanSummary}</span>
                  </p>
                );
              })()}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Always-editable section for selected member (Name, Gender, Alive/Deceased, Hometown) */}
          <form
            onSubmit={handleSaveSelectedMemberInfo}
            className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                এই সদস্যের তথ্য এডিট করুন
              </span>
              <button
                type="button"
                onClick={handleDeletePerson}
                disabled={savingMemberInfo}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 hover:bg-red-100 px-2 py-1 rounded-lg transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                মুছুন
              </button>
            </div>

            {/* Avatar Preview & Upload */}
            <div className="flex items-center gap-3.5 py-1">
              <div className="relative w-14 h-14 rounded-2xl border-2 border-slate-200 overflow-hidden bg-white flex items-center justify-center shrink-0 shadow-2xs">
                {memberAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={memberAvatarUrl}
                    alt={memberNameBn}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-6 h-6 text-slate-400" />
                )}
                {uploadingAvatar && (
                  <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                  id="avatar-file-input"
                  disabled={uploadingAvatar}
                />
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="avatar-file-input"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 transition cursor-pointer shadow-2xs"
                  >
                    <Camera className="w-3.5 h-3.5 text-emerald-600" />
                    {uploadingAvatar
                      ? "আপলোড হচ্ছে..."
                      : memberAvatarUrl
                      ? "ছবি পরিবর্তন করুন"
                      : "ছবি আপলোড করুন"}
                  </label>
                  {memberAvatarUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      disabled={uploadingAvatar}
                      className="text-[11px] font-medium text-red-600 hover:underline cursor-pointer"
                    >
                      ছবি মুছুন
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  JPG, PNG বা WEBP (সর্বোচ্চ ৫ MB)
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                নাম (বাংলায়) *
              </label>
              <input
                type="text"
                required
                value={memberNameBn}
                onChange={(e) => setMemberNameBn(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  লিঙ্গ
                </label>
                <select
                  value={memberGender}
                  onChange={(e) =>
                    setMemberGender(
                      e.target.value as "male" | "female" | "other"
                    )
                  }
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm"
                >
                  <option value="male">পুরুষ</option>
                  <option value="female">মহিলা</option>
                  <option value="other">অন্যান্য</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  জীবিত / মরহুম
                </label>
                <select
                  value={memberIsAlive ? "alive" : "deceased"}
                  onChange={(e) => setMemberIsAlive(e.target.value === "alive")}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium"
                >
                  <option value="alive">জীবিত আছেন</option>
                  <option value="deceased">মরহুম / প্রয়াত</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                গ্রাম / ঠিকানা
              </label>
              <input
                type="text"
                value={memberHometownBn}
                onChange={(e) => setMemberHometownBn(e.target.value)}
                placeholder="যেমন: কালীগঞ্জ, গাজীপুর"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm"
              />
            </div>

            {/* Birth Date (AD & BS) */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  জন্ম (খ্রিস্টাব্দ)
                </label>
                <input
                  type="text"
                  value={memberBirthDateAd}
                  onChange={(e) => setMemberBirthDateAd(e.target.value)}
                  placeholder="যেমন: 1950 বা 1950-01-15"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  জন্ম সাল (বঙ্গাব্দ)
                </label>
                <input
                  type="text"
                  value={memberBirthDateBs}
                  onChange={(e) => setMemberBirthDateBs(e.target.value)}
                  placeholder="যেমন: 1356"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm"
                />
              </div>
            </div>

            {/* Death Date (AD, if deceased) */}
            {!memberIsAlive && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  মৃত্যু তারিখ/সাল (খ্রিস্টাব্দ)
                </label>
                <input
                  type="text"
                  value={memberDeathDateAd}
                  onChange={(e) => setMemberDeathDateAd(e.target.value)}
                  placeholder="যেমন: 2020 বা 2020-05-10"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={savingMemberInfo}
              className="w-full py-2 px-4 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white inline-flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-60"
            >
              <Save className="w-3.5 h-3.5" />
              {savingMemberInfo ? "আপডেট হচ্ছে..." : "সদস্যের তথ্য সেভ করুন"}
            </button>
          </form>

          {/* Relationship tabs to add new member */}
          <div>
            <h3 className="text-xs font-bold text-slate-700 mb-2">
              নতুন সম্পর্ক যুক্ত করুন
            </h3>
            <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1.5 rounded-xl mb-4">
              <button
                type="button"
                onClick={() => onChangeMode("child")}
                className={`py-2 px-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 transition cursor-pointer ${
                  mode === "child"
                    ? "bg-white text-emerald-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                সন্তান
              </button>
              <button
                type="button"
                onClick={() => onChangeMode("spouse")}
                className={`py-2 px-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 transition cursor-pointer ${
                  mode === "spouse"
                    ? "bg-white text-rose-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Heart className="w-3.5 h-3.5" />
                স্বামী/স্ত্রী
              </button>
              <button
                type="button"
                onClick={() => onChangeMode("parent")}
                className={`py-2 px-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 transition cursor-pointer ${
                  mode === "parent"
                    ? "bg-white text-sky-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                বাবা/মা
              </button>
            </div>

            <form onSubmit={handleAddRelatedPerson} className="space-y-3">
              {mode === "child" && existingSpouses.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    অন্য অভিভাবক (ঐচ্ছিক)
                  </label>
                  <select
                    value={selectedSpouseId}
                    onChange={(e) => setSelectedSpouseId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-sm"
                  >
                    <option value="">শুধু {selectedPerson.full_name_bn}</option>
                    {existingSpouses.map((sp) =>
                      sp.person ? (
                        <option key={sp.person.id} value={sp.person.id}>
                          {sp.person.full_name_bn}
                        </option>
                      ) : null
                    )}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  নতুন সদস্যের নাম (বাংলায়) *
                </label>
                <input
                  type="text"
                  required
                  value={newNameBn}
                  onChange={(e) => setNewNameBn(e.target.value)}
                  placeholder="যেমন: মো: রফিকুল ইসলাম"
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    লিঙ্গ
                  </label>
                  <select
                    value={newGender}
                    onChange={(e) =>
                      setNewGender(
                        e.target.value as "male" | "female" | "other"
                      )
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-sm"
                  >
                    <option value="male">পুরুষ</option>
                    <option value="female">মহিলা</option>
                    <option value="other">অন্যান্য</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    অবস্থা
                  </label>
                  <select
                    value={newIsAlive ? "alive" : "deceased"}
                    onChange={(e) => setNewIsAlive(e.target.value === "alive")}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-sm"
                  >
                    <option value="alive">জীবিত আছেন</option>
                    <option value="deceased">মরহুম / প্রয়াত</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  গ্রাম / ঠিকানা
                </label>
                <input
                  type="text"
                  value={newHometownBn}
                  onChange={(e) => setNewHometownBn(e.target.value)}
                  placeholder="যেমন: কালীগঞ্জ, গাজীপুর"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={savingRelation}
                className="w-full py-2.5 px-5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60 cursor-pointer transition"
              >
                {savingRelation ? "যুক্ত হচ্ছে..." : "নতুন সদস্য যুক্ত করুন"}
              </button>
            </form>
          </div>

          {statusMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800">
              {statusMsg}
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 whitespace-pre-line">
              {errorMsg}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-200/70 cursor-pointer"
          >
            বন্ধ করুন
          </button>
        </div>
      </div>
    </div>
  );
}

interface ReadOnlyDrawerContentProps {
  selectedPerson: PersonRecord;
  allPersons: PersonRecord[];
  unions: UnionRecord[];
  parentChild: ParentChildRecord[];
  onClose: () => void;
  onSelectPerson?: (person: PersonRecord) => void;
}

function ReadOnlyMemberDrawerContent({
  selectedPerson,
  allPersons,
  unions,
  parentChild,
  onClose,
  onSelectPerson,
}: ReadOnlyDrawerContentProps) {
  const existingSpouses = unions
    .filter(
      (u) =>
        u.partner_1_id === selectedPerson.id ||
        u.partner_2_id === selectedPerson.id
    )
    .map((u) => {
      const spouseId =
        u.partner_1_id === selectedPerson.id
          ? u.partner_2_id
          : u.partner_1_id;
      return allPersons.find((p) => p.id === spouseId);
    })
    .filter((p): p is PersonRecord => Boolean(p));

  const parents = parentChild
    .filter((pc) => pc.child_id === selectedPerson.id)
    .map((pc) => allPersons.find((p) => p.id === pc.parent_id))
    .filter((p): p is PersonRecord => Boolean(p));
  const uniqueParents = Array.from(
    new Map(parents.map((p) => [p.id, p])).values()
  );

  const children = parentChild
    .filter((pc) => pc.parent_id === selectedPerson.id)
    .map((pc) => allPersons.find((p) => p.id === pc.child_id))
    .filter((p): p is PersonRecord => Boolean(p));
  const uniqueChildren = Array.from(
    new Map(children.map((p) => [p.id, p])).values()
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-stretch justify-center sm:justify-end bg-slate-900/40 backdrop-blur-xs transition-all">
      <div className="w-full sm:max-w-md bg-white h-[92vh] sm:h-full rounded-t-3xl sm:rounded-none shadow-2xl border-t sm:border-t-0 sm:border-l border-slate-200 flex flex-col justify-between overflow-y-auto">
        <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mt-2.5 sm:hidden shrink-0" />
        <div className="p-5 sm:p-6 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                সদস্যের তথ্য (ভিউ-অনলি)
              </span>
              <h2 className="text-xl font-bold text-slate-900 mt-1.5">
                {selectedPerson.full_name_bn}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                জীবনসঙ্গী: {toBengaliDigits(existingSpouses.length)} জন • সন্তান: {toBengaliDigits(uniqueChildren.length)} জন
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Profile Card */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative w-16 h-16 rounded-2xl border-2 border-white shadow-sm overflow-hidden bg-white flex items-center justify-center shrink-0">
                {selectedPerson.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedPerson.avatar_url}
                    alt={selectedPerson.full_name_bn}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-8 h-8 text-slate-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                      selectedPerson.gender === "male"
                        ? "bg-sky-50 text-sky-700 border-sky-200"
                        : selectedPerson.gender === "female"
                        ? "bg-rose-50 text-rose-700 border-rose-200"
                        : "bg-slate-100 text-slate-700 border-slate-200"
                    }`}
                  >
                    {selectedPerson.gender === "male"
                      ? "পুরুষ"
                      : selectedPerson.gender === "female"
                      ? "মহিলা"
                      : "অন্যান্য"}
                  </span>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                      selectedPerson.is_alive
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-slate-200 text-slate-700 border-slate-300"
                    }`}
                  >
                    {selectedPerson.is_alive ? "জীবিত আছেন" : "মরহুম / প্রয়াত"}
                  </span>
                </div>
                <h3 className="font-bold text-base text-slate-900 mt-1 truncate">
                  {selectedPerson.full_name_bn}
                </h3>
                {selectedPerson.nickname_bn && (
                  <p className="text-xs text-slate-500">
                    ডাকনাম: {selectedPerson.nickname_bn}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-200/60 text-xs">
              {selectedPerson.hometown_bn && (
                <div className="flex items-start gap-2 text-slate-700">
                  <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-900">গ্রাম / ঠিকানা:</span>{" "}
                    {selectedPerson.hometown_bn}
                  </div>
                </div>
              )}

              {selectedPerson.occupation_bn && (
                <div className="flex items-start gap-2 text-slate-700">
                  <Briefcase className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-900">পেশা:</span>{" "}
                    {selectedPerson.occupation_bn}
                  </div>
                </div>
              )}

              {(() => {
                const { birthText, deathText } = formatLifeDates({
                  birthDateAd: selectedPerson.birth_date_ad,
                  birthDateBs: selectedPerson.birth_date_bs,
                  deathDateAd: selectedPerson.death_date_ad,
                  isAlive: selectedPerson.is_alive,
                });
                return (
                  <>
                    {birthText && (
                      <div className="flex items-start gap-2 text-slate-700">
                        <Calendar className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-slate-900">জন্ম:</span>{" "}
                          <span>{birthText}</span>
                        </div>
                      </div>
                    )}
                    {deathText && (
                      <div className="flex items-start gap-2 text-slate-700">
                        <Calendar className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-slate-900">মৃত্যু:</span>{" "}
                          <span>{deathText}</span>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

              {selectedPerson.bio_bn && (
                <div className="flex items-start gap-2 text-slate-700 pt-1">
                  <Info className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-900">পরিচিতি:</span>{" "}
                    <p className="mt-0.5 whitespace-pre-line text-slate-600 leading-relaxed">
                      {selectedPerson.bio_bn}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Relations Sections */}
          <div className="space-y-4">
            {/* Parents */}
            <div>
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-2">
                <Users className="w-3.5 h-3.5 text-sky-600" />
                বাবা / মা ({toBengaliDigits(uniqueParents.length)})
              </h4>
              {uniqueParents.length === 0 ? (
                <p className="text-xs text-slate-400 italic bg-slate-50 p-2.5 rounded-xl border border-dashed border-slate-200">
                  কোনো অভিভাবক তালিকাভুক্ত নেই
                </p>
              ) : (
                <div className="space-y-1.5">
                  {uniqueParents.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onSelectPerson?.(p)}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-left transition ${
                        onSelectPerson ? "cursor-pointer" : "cursor-default"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-700 border border-sky-200 flex items-center justify-center shrink-0 overflow-hidden">
                          {p.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.avatar_url}
                              alt={p.full_name_bn}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User className="w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate">
                            {p.full_name_bn}
                          </p>
                          <span className="text-[10px] text-slate-500">
                            {p.gender === "male"
                              ? "পিতা"
                              : p.gender === "female"
                              ? "মাতা"
                              : "অভিভাবক"}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          p.is_alive
                            ? "text-emerald-700 bg-emerald-50"
                            : "text-slate-500 bg-slate-100"
                        }`}
                      >
                        {p.is_alive ? "জীবিত" : "মরহুম"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Spouses */}
            <div>
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-2">
                <Heart className="w-3.5 h-3.5 text-rose-600" />
                জীবনসঙ্গী ({toBengaliDigits(existingSpouses.length)})
              </h4>
              {existingSpouses.length === 0 ? (
                <p className="text-xs text-slate-400 italic bg-slate-50 p-2.5 rounded-xl border border-dashed border-slate-200">
                  কোনো জীবনসঙ্গী তালিকাভুক্ত নেই
                </p>
              ) : (
                <div className="space-y-1.5">
                  {existingSpouses.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onSelectPerson?.(s)}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-left transition ${
                        onSelectPerson ? "cursor-pointer" : "cursor-default"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center shrink-0 overflow-hidden">
                          {s.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={s.avatar_url}
                              alt={s.full_name_bn}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User className="w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate">
                            {s.full_name_bn}
                          </p>
                          <span className="text-[10px] text-slate-500">
                            {s.gender === "male"
                              ? "স্বামী"
                              : s.gender === "female"
                              ? "স্ত্রী"
                              : "জীবনসঙ্গী"}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          s.is_alive
                            ? "text-emerald-700 bg-emerald-50"
                            : "text-slate-500 bg-slate-100"
                        }`}
                      >
                        {s.is_alive ? "জীবিত" : "মরহুম"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Children */}
            <div>
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-2">
                <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                সন্তানাদি ({toBengaliDigits(uniqueChildren.length)})
              </h4>
              {uniqueChildren.length === 0 ? (
                <p className="text-xs text-slate-400 italic bg-slate-50 p-2.5 rounded-xl border border-dashed border-slate-200">
                  কোনো সন্তান তালিকাভুক্ত নেই
                </p>
              ) : (
                <div className="space-y-1.5">
                  {uniqueChildren.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onSelectPerson?.(c)}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-left transition ${
                        onSelectPerson ? "cursor-pointer" : "cursor-default"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 overflow-hidden ${
                            c.gender === "male"
                              ? "bg-sky-50 text-sky-700 border border-sky-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          {c.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={c.avatar_url}
                              alt={c.full_name_bn}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User className="w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate">
                            {c.full_name_bn}
                          </p>
                          <span className="text-[10px] text-slate-500">
                            {c.gender === "male"
                              ? "ছেলে"
                              : c.gender === "female"
                              ? "মেয়ে"
                              : "সন্তান"}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          c.is_alive
                            ? "text-emerald-700 bg-emerald-50"
                            : "text-slate-500 bg-slate-100"
                        }`}
                      >
                        {c.is_alive ? "জীবিত" : "মরহুম"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">ভিউ-অনলি মোড</span>
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

export default function MemberDrawer({
  treeId,
  selectedPerson,
  allPersons,
  unions,
  parentChild,
  onClose,
  onUpdated = () => {},
  readOnly = false,
  onSelectPerson,
}: MemberDrawerProps) {
  const [mode, setMode] = useState<RelationMode>("child");

  if (!selectedPerson) return null;

  if (readOnly) {
    return (
      <ReadOnlyMemberDrawerContent
        selectedPerson={selectedPerson}
        allPersons={allPersons}
        unions={unions}
        parentChild={parentChild}
        onClose={onClose}
        onSelectPerson={onSelectPerson}
      />
    );
  }

  return (
    <MemberDrawerContent
      key={`${selectedPerson.id}-${mode}`}
      treeId={treeId}
      selectedPerson={selectedPerson}
      allPersons={allPersons}
      unions={unions}
      parentChild={parentChild}
      mode={mode}
      onChangeMode={setMode}
      onClose={onClose}
      onUpdated={onUpdated}
    />
  );
}
