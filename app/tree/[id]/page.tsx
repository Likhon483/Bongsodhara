"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  type Node,
  type Edge,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import PersonNodeComponent from "@/components/tree/PersonNode";
import MemberDrawer from "@/components/forms/MemberDrawer";
import RelationshipModal from "@/components/tree/RelationshipModal";
import GenealogyReportModal from "@/components/tree/GenealogyReportModal";
import {
  buildTreeGraph,
  type PersonRecord,
  type UnionRecord,
  type ParentChildRecord,
  type PersonNodeData,
} from "@/lib/tree-layout";
import {
  ArrowLeft,
  Download,
  Search,
  Share2,
  FileJson,
  Users,
  Check,
  Sparkles,
  Upload,
  Loader2,
  HeartHandshake,
  FileText,
  Maximize2,
} from "lucide-react";
import { formatErrorMessage } from "@/lib/error-utils";

interface TreeRecord {
  id: string;
  owner_id: string;
  title_bn: string;
  description_bn: string | null;
  root_person_id: string | null;
  is_public: boolean;
  share_slug: string | null;
  editor_token?: string | null;
}

type FrameTheme = "emerald" | "royal" | "minimal";

const nodeTypes = {
  personNode: PersonNodeComponent,
};

function toBengaliDigits(num: number): string {
  const bn = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return String(num)
    .split("")
    .map((d) => (/\d/.test(d) ? bn[Number(d)] : d))
    .join("");
}

function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function TreeDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const treeId = params.id;
  const supabase = createClient();

  const exportStageRef = useRef<HTMLDivElement | null>(null);
  const restoreFileInputRef = useRef<HTMLInputElement | null>(null);

  const [tree, setTree] = useState<TreeRecord | null>(null);
  const [persons, setPersons] = useState<PersonRecord[]>([]);
  const [unions, setUnions] = useState<UnionRecord[]>([]);
  const [parentChild, setParentChild] = useState<ParentChildRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);

  // Search, collapse & export states
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [frameTheme, setFrameTheme] = useState<FrameTheme>("emerald");
  const [exporting, setExporting] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [isRelationshipModalOpen, setIsRelationshipModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance<
    Node<PersonNodeData>,
    Edge
  > | null>(null);

  const handleResetView = useCallback(() => {
    if (rfInstance) {
      rfInstance.fitView({ padding: 0.2, duration: 400 });
    }
  }, [rfInstance]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<PersonNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const fetchTreeData = useCallback(async () => {
    if (!treeId) return;
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const [treeRes, personsRes, unionsRes, pcRes] = await Promise.all([
        supabase.from("trees").select("*").eq("id", treeId).single(),
        supabase.from("persons").select("*").eq("tree_id", treeId),
        supabase.from("unions").select("*").eq("tree_id", treeId),
        supabase.from("parent_child").select("*").eq("tree_id", treeId),
      ]);

      if (treeRes.error || !treeRes.data) {
        router.push("/dashboard");
        return;
      }

      setTree(treeRes.data as TreeRecord);
      setPersons((personsRes.data as PersonRecord[]) ?? []);
      setUnions((unionsRes.data as UnionRecord[]) ?? []);
      setParentChild((pcRes.data as ParentChildRecord[]) ?? []);
    } finally {
      setLoading(false);
    }
  }, [treeId, supabase, router]);

  useEffect(() => {
    fetchTreeData();
  }, [fetchTreeData]);

  const handleToggleCollapse = useCallback((personId: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(personId)) {
        next.delete(personId);
      } else {
        next.add(personId);
      }
      return next;
    });
  }, []);

  // Filter out descendants of collapsed nodes
  const visibleData = useMemo(() => {
    if (collapsedIds.size === 0) {
      return {
        visiblePersons: persons,
        visibleUnions: unions,
        visibleParentChild: parentChild,
      };
    }

    const childrenMap = new Map<string, string[]>();
    for (const pc of parentChild) {
      const list = childrenMap.get(pc.parent_id) ?? [];
      list.push(pc.child_id);
      childrenMap.set(pc.parent_id, list);
    }

    const hiddenIds = new Set<string>();
    const queue = Array.from(collapsedIds);
    while (queue.length > 0) {
      const curr = queue.shift()!;
      for (const ch of childrenMap.get(curr) ?? []) {
        if (!hiddenIds.has(ch)) {
          hiddenIds.add(ch);
          queue.push(ch);
        }
      }
    }

    const visiblePersons = persons.filter((p) => !hiddenIds.has(p.id));
    const visibleIds = new Set(visiblePersons.map((p) => p.id));
    const visibleUnions = unions.filter(
      (u) => visibleIds.has(u.partner_1_id) && visibleIds.has(u.partner_2_id)
    );
    const visibleParentChild = parentChild.filter(
      (pc) => visibleIds.has(pc.parent_id) && visibleIds.has(pc.child_id)
    );

    return { visiblePersons, visibleUnions, visibleParentChild };
  }, [persons, unions, parentChild, collapsedIds]);

  const parentSet = useMemo(() => {
    const s = new Set<string>();
    for (const pc of parentChild) s.add(pc.parent_id);
    return s;
  }, [parentChild]);

  // Search match focus
  const matchedPerson = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    return (
      persons.find((p) => p.full_name_bn.toLowerCase().includes(q)) ?? null
    );
  }, [searchQuery, persons]);

  useEffect(() => {
    const { nodes: builtNodes, edges: builtEdges } = buildTreeGraph({
      persons: visibleData.visiblePersons,
      unions: visibleData.visibleUnions,
      parentChild: visibleData.visibleParentChild,
      rootPersonId: tree?.root_person_id ?? null,
      onSelectPerson: (person) => setSelectedPersonId(person.id),
    });

    const enhancedNodes = builtNodes.map((n) => {
      const isMatched = matchedPerson?.id === n.id;
      return {
        ...n,
        style: isMatched
          ? {
              boxShadow: "0 0 0 4px rgba(16, 185, 129, 0.45)",
              borderRadius: "16px",
            }
          : undefined,
        data: {
          ...n.data,
          hasChildren: parentSet.has(n.id),
          isCollapsed: collapsedIds.has(n.id),
          onToggleCollapse: handleToggleCollapse,
        },
      };
    });

    setNodes(enhancedNodes);
    setEdges(builtEdges);
  }, [
    visibleData,
    tree?.root_person_id,
    matchedPerson,
    parentSet,
    collapsedIds,
    handleToggleCollapse,
    setNodes,
    setEdges,
  ]);

  const selectedPerson = useMemo(
    () => persons.find((p) => p.id === selectedPersonId) ?? null,
    [persons, selectedPersonId]
  );

  // Family statistics
  const stats = useMemo(() => {
    const aliveCount = persons.filter((p) => p.is_alive).length;
    const deceasedCount = persons.length - aliveCount;
    const maleCount = persons.filter((p) => p.gender === "male").length;
    const femaleCount = persons.filter((p) => p.gender === "female").length;
    const maxGen =
      nodes.length > 0
        ? Math.max(...nodes.map((n) => (n.data?.generation as number) ?? 0)) + 1
        : 0;

    return {
      total: persons.length,
      alive: aliveCount,
      deceased: deceasedCount,
      male: maleCount,
      female: femaleCount,
      generations: maxGen,
    };
  }, [persons, nodes]);

  async function handleShareToggleAndCopy() {
    if (!tree) return;
    let slug = tree.share_slug;
    if (!slug) {
      slug = `${tree.id.slice(0, 8)}-${Math.random().toString(36).slice(2, 6)}`;
    }

    const { data, error } = await supabase
      .from("trees")
      .update({ is_public: true, share_slug: slug })
      .eq("id", tree.id)
      .select()
      .single();

    if (!error && data) {
      setTree(data as TreeRecord);
      const shareUrl = `${window.location.origin}/share/${slug}`;
      await navigator.clipboard.writeText(shareUrl);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2500);
    }
  }

  function handleExportJsonBackup() {
    const payload = {
      exported_at: new Date().toISOString(),
      tree,
      persons,
      unions,
      parentChild,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tree?.title_bn || "bangla-bongshodhara"}-backup.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleRestoreJsonBackup(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !treeId) return;

    // Reset file input so user can pick the same file again if desired
    e.target.value = "";

    if (!file.name.toLowerCase().endsWith(".json") && file.type !== "application/json") {
      alert("অনুগ্রহ করে একটি বৈধ .json ব্যাকআপ ফাইল নির্বাচন করুন।");
      return;
    }

    try {
      const fileText = await file.text();
      let json: {
        tree?: Partial<TreeRecord>;
        persons?: unknown[];
        members?: unknown[];
        unions?: unknown[];
        partnerships?: unknown[];
        parentChild?: unknown[];
        parent_child?: unknown[];
      };

      try {
        json = JSON.parse(fileText);
      } catch {
        alert("ফাইলটি সঠিক JSON ফরম্যাটে নেই। অনুগ্রহ করে একটি ক্ষতিগ্রস্তহীন JSON ফাইল নির্বাচন করুন।");
        return;
      }

      if (!json || typeof json !== "object") {
        alert("ভুল JSON ফাইল। এটি বংশধারার বৈধ ব্যাকআপ ফাইল নয়।");
        return;
      }

      const rawPersons = Array.isArray(json.persons)
        ? json.persons
        : Array.isArray(json.members)
        ? json.members
        : null;

      if (!rawPersons || rawPersons.length === 0) {
        alert("এই ব্যাকআপ ফাইলে কোনো সদস্যের তথ্য (persons) পাওয়া যায়নি। অনুগ্রহ করে সঠিক ফাইল যাচাই করুন।");
        return;
      }

      const rawUnions = Array.isArray(json.unions)
        ? json.unions
        : Array.isArray(json.partnerships)
        ? json.partnerships
        : [];

      const rawParentChild = Array.isArray(json.parentChild)
        ? json.parentChild
        : Array.isArray(json.parent_child)
        ? json.parent_child
        : [];

      const confirmed = window.confirm(
        `এই ব্যাকআপ ফাইলটিতে মোট ${toBengaliDigits(rawPersons.length)} জন সদস্যের তথ্য পাওয়া গেছে। আপনি কি বর্তমান বংশতালিকায় এই তথ্য রিস্টোর করতে চান?`
      );
      if (!confirmed) return;

      setRestoring(true);

      // 1. Generate new UUIDs and create oldId -> newId mapping for persons
      const personIdMap = new Map<string, string>();
      const personsToInsert = rawPersons.map((raw) => {
        const p = raw as Record<string, unknown>;
        const oldId = String(p.id || "");
        const newId = generateUUID();
        if (oldId) {
          personIdMap.set(oldId, newId);
        }

        const rawGender = String(p.gender || "male");
        const gender: "male" | "female" | "other" =
          rawGender === "female" ? "female" : rawGender === "other" ? "other" : "male";

        return {
          id: newId,
          tree_id: treeId,
          full_name_bn: String(p.full_name_bn || "নামহীন সদস্য").trim(),
          nickname_bn: p.nickname_bn ? String(p.nickname_bn).trim() : null,
          gender,
          birth_date_ad: p.birth_date_ad ? String(p.birth_date_ad) : null,
          birth_date_bs: p.birth_date_bs ? String(p.birth_date_bs) : null,
          death_date_ad: p.death_date_ad ? String(p.death_date_ad) : null,
          is_alive: typeof p.is_alive === "boolean" ? p.is_alive : true,
          hometown_bn: p.hometown_bn ? String(p.hometown_bn).trim() : null,
          occupation_bn: p.occupation_bn ? String(p.occupation_bn).trim() : null,
          bio_bn: p.bio_bn ? String(p.bio_bn).trim() : null,
          avatar_url: p.avatar_url ? String(p.avatar_url) : null,
        };
      });

      // 2. Generate new UUIDs and create oldId -> newId mapping for unions
      const unionIdMap = new Map<string, string>();
      const unionsToInsert: {
        id: string;
        tree_id: string;
        partner_1_id: string;
        partner_2_id: string;
        marriage_date_ad: string | null;
        status: string;
      }[] = [];

      for (const raw of rawUnions) {
        const u = raw as Record<string, unknown>;
        const oldUId = String(u.id || "");
        const oldP1 = String(u.partner_1_id || "");
        const oldP2 = String(u.partner_2_id || "");

        const newP1 = personIdMap.get(oldP1);
        const newP2 = personIdMap.get(oldP2);

        if (newP1 && newP2) {
          const newUnionId = generateUUID();
          if (oldUId) {
            unionIdMap.set(oldUId, newUnionId);
          }
          unionsToInsert.push({
            id: newUnionId,
            tree_id: treeId,
            partner_1_id: newP1,
            partner_2_id: newP2,
            marriage_date_ad: u.marriage_date_ad ? String(u.marriage_date_ad) : null,
            status: String(u.status || "married"),
          });
        }
      }

      // 3. Map parent-child relationships using mapped person and union IDs
      const parentChildToInsert: {
        id: string;
        tree_id: string;
        parent_id: string;
        child_id: string;
        union_id: string | null;
        relation_type: string;
      }[] = [];

      for (const raw of rawParentChild) {
        const pc = raw as Record<string, unknown>;
        const oldParentId = String(pc.parent_id || "");
        const oldChildId = String(pc.child_id || "");
        const oldUnionId = pc.union_id ? String(pc.union_id) : null;

        const newParentId = personIdMap.get(oldParentId);
        const newChildId = personIdMap.get(oldChildId);

        if (newParentId && newChildId && newParentId !== newChildId) {
          const newUnionId = oldUnionId ? unionIdMap.get(oldUnionId) ?? null : null;
          parentChildToInsert.push({
            id: generateUUID(),
            tree_id: treeId,
            parent_id: newParentId,
            child_id: newChildId,
            union_id: newUnionId,
            relation_type: String(pc.relation_type || "biological"),
          });
        }
      }

      // Insert persons into Supabase
      const { error: personsError } = await supabase
        .from("persons")
        .insert(personsToInsert);

      if (personsError) throw personsError;

      // Insert unions if any
      if (unionsToInsert.length > 0) {
        const { error: unionsError } = await supabase
          .from("unions")
          .insert(unionsToInsert);

        if (unionsError) throw unionsError;
      }

      // Insert parent_child relations if any
      if (parentChildToInsert.length > 0) {
        const { error: pcError } = await supabase
          .from("parent_child")
          .insert(parentChildToInsert);

        if (pcError) throw pcError;
      }

      // Update tree's root_person_id if current tree has no root
      const backupRootId = json.tree?.root_person_id
        ? personIdMap.get(String(json.tree.root_person_id))
        : personsToInsert[0]?.id;

      if (!tree?.root_person_id && backupRootId) {
        await supabase
          .from("trees")
          .update({ root_person_id: backupRootId })
          .eq("id", treeId);
      }

      await fetchTreeData();
      alert(
        `সফলভাবে ${toBengaliDigits(personsToInsert.length)} জন সদস্য ও তাদের সম্পর্ক বর্তমান বংশধারায় রিস্টোর করা হয়েছে।`
      );
    } catch (err: unknown) {
      console.error("handleRestoreJsonBackup error:", err);
      alert(`রিস্টোর করার সময় সমস্যা হয়েছে:\n${formatErrorMessage(err)}`);
    } finally {
      setRestoring(false);
    }
  }

  async function handleExportGraphic(format: "png" | "pdf") {
    if (!exportStageRef.current || !tree) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(exportStageRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });

      if (format === "png") {
        const link = document.createElement("a");
        link.download = `${tree.title_bn || "bongshodhara"}.png`;
        link.href = dataUrl;
        link.click();
      } else {
        const img = new Image();
        img.src = dataUrl;
        await new Promise((resolve) => {
          img.onload = resolve;
        });
        const orientation = img.width >= img.height ? "l" : "p";
        const pdf = new jsPDF({
          orientation,
          unit: "px",
          format: [img.width, img.height],
        });
        pdf.addImage(dataUrl, "PNG", 0, 0, img.width, img.height);
        pdf.save(`${tree.title_bn || "bongshodhara"}.pdf`);
      }
    } finally {
      setExporting(false);
    }
  }

  const themeClasses =
    frameTheme === "emerald"
      ? "border-4 border-double border-emerald-600 bg-gradient-to-b from-emerald-50/40 via-white to-emerald-50/30"
      : frameTheme === "royal"
      ? "border-4 border-double border-amber-500 bg-gradient-to-b from-amber-50/50 via-white to-amber-50/30"
      : "border-2 border-slate-300 bg-white";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600 text-sm">
        বংশধারা লোড হচ্ছে...
      </div>
    );
  }

  if (!tree) return null;

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-100 text-slate-900 overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            ড্যাশবোর্ড
          </Link>

          <div className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-xl overflow-hidden shadow-xs ring-1 ring-emerald-600/30 shrink-0 bg-emerald-950 hidden xs:block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/bongshodhara-logo.gif"
              alt="বংশধারা লোগো"
              className="w-full h-full object-cover"
            />
          </div>

          <div>
            <h1 className="font-bold text-sm sm:text-base text-slate-900 leading-tight">
              {tree.title_bn}
            </h1>
            <p className="text-[11px] text-slate-500">
              মোট {toBengaliDigits(stats.total)} জন •{" "}
              {toBengaliDigits(stats.generations)} প্রজন্ম • জীবিত{" "}
              {toBengaliDigits(stats.alive)} • মরহুম{" "}
              {toBengaliDigits(stats.deceased)}
            </p>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-56 order-3 sm:order-2">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="সদস্যের নাম খুঁজুন..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 flex-wrap order-2 sm:order-3">
          <select
            value={frameTheme}
            onChange={(e) => setFrameTheme(e.target.value as FrameTheme)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700"
            title="ফ্রেম থিম নির্বাচন"
          >
            <option value="emerald">পান্না ফ্রেম</option>
            <option value="royal">রয়্যাল গোল্ড</option>
            <option value="minimal">ক্লিন মডার্ন</option>
          </select>

          <button
            type="button"
            onClick={() => handleExportGraphic("png")}
            disabled={exporting}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition cursor-pointer disabled:opacity-60"
          >
            <Download className="w-3.5 h-3.5" />
            PNG
          </button>

          <button
            type="button"
            onClick={() => handleExportGraphic("pdf")}
            disabled={exporting}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition cursor-pointer disabled:opacity-60"
          >
            <Download className="w-3.5 h-3.5" />
            PDF
          </button>

          <button
            type="button"
            onClick={handleResetView}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition cursor-pointer shadow-2xs"
            title="চার্ট রিসেট করে সব নোড স্ক্রিনে ফিট করুন"
          >
            <Maximize2 className="w-3.5 h-3.5 text-emerald-600" />
            ফিট ভিউ
          </button>

          <button
            type="button"
            onClick={() => setIsReportModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white transition cursor-pointer shadow-2xs"
            title="প্রজন্মভিত্তিক বংশপঞ্জি রিপোর্ট ও প্রিন্ট লিস্ট"
          >
            <FileText className="w-3.5 h-3.5" />
            বংশপঞ্জি রিপোর্ট
          </button>

          <button
            type="button"
            onClick={() => setIsRelationshipModalOpen(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition cursor-pointer shadow-2xs"
            title="যেকোনো দুজন সদস্যের মধ্যকার সম্পর্ক ও শর্টেস্ট পাথ নির্ণয় করুন"
          >
            <HeartHandshake className="w-3.5 h-3.5 text-emerald-600" />
            সম্পর্ক খুঁজুন
          </button>

          <button
            type="button"
            onClick={handleShareToggleAndCopy}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition cursor-pointer"
          >
            {copiedShare ? (
              <>
                <Check className="w-3.5 h-3.5" />
                লিংক কপিড
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5" />
                শেয়ার লিংক
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleExportJsonBackup}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition cursor-pointer"
            title="JSON ব্যাকআপ ডাউনলোড"
          >
            <FileJson className="w-3.5 h-3.5" />
            ব্যাকআপ
          </button>

          <button
            type="button"
            onClick={() => restoreFileInputRef.current?.click()}
            disabled={restoring}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition cursor-pointer disabled:opacity-60"
            title="JSON ব্যাকআপ ফাইল থেকে তথ্য রিস্টোর করুন"
          >
            {restoring ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                রিস্টোর হচ্ছে...
              </>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5 text-emerald-600" />
                রিস্টোর (JSON)
              </>
            )}
          </button>
          <input
            ref={restoreFileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleRestoreJsonBackup}
            className="hidden"
          />
        </div>
      </header>

      {/* Stats Strip */}
      <div className="bg-white/80 border-b border-slate-200/80 px-4 sm:px-6 py-1.5 flex items-center justify-between text-[11px] text-slate-600 flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1 font-medium">
            <Users className="w-3.5 h-3.5 text-emerald-600" />
            পুরুষ: {toBengaliDigits(stats.male)} জন
          </span>
          <span>•</span>
          <span>মহিলা: {toBengaliDigits(stats.female)} জন</span>
          {matchedPerson && (
            <span className="text-emerald-700 font-semibold inline-flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              পাওয়া গেছে: {matchedPerson.full_name_bn}
            </span>
          )}
        </div>
        <span>যেকোনো কার্ডে ক্লিক করে ছবি, তথ্য বা সম্পর্ক আপডেট করুন</span>
      </div>

      {/* Framed Export Stage */}
      <div className="flex-1 w-full p-3 sm:p-5 flex flex-col min-h-0">
        <div
          id="bangla-family-tree-export-stage"
          ref={exportStageRef}
          className={`flex-1 w-full h-full min-h-[560px] rounded-2xl flex flex-col overflow-hidden shadow-sm ${themeClasses}`}
        >
          {/* Decorative Header Banner */}
          <div className="px-6 py-3.5 border-b border-slate-200/70 flex items-center justify-between bg-white/70 shrink-0">
            <div>
              <p className="text-[11px] font-bold tracking-wide text-emerald-700">
                বংশপঞ্জি ও বংশধারা
              </p>
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
                {tree.title_bn}
              </h2>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-100/80 text-emerald-900">
                মোট সদস্য: {toBengaliDigits(stats.total)} জন
              </span>
            </div>
          </div>

          {/* React Flow Interactive Canvas */}
          <div className="flex-1 w-full h-full min-h-0 relative">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onInit={setRfInstance}
              fitView
              minZoom={0.25}
              maxZoom={1.8}
            >
              <Background
                variant={BackgroundVariant.Dots}
                gap={18}
                size={1.2}
                color="#cbd5e1"
              />
              <Controls />
              <MiniMap pannable zoomable />
            </ReactFlow>
          </div>

          {/* Decorative Footer Banner */}
          <div className="px-6 py-2.5 border-t border-slate-200/70 flex items-center justify-between text-xs text-slate-600 bg-white/70 shrink-0">
            <span className="truncate max-w-md">
              {tree.description_bn || "পারিবারিক বংশতালিকা ও বংশপঞ্জি"}
            </span>
            <span className="font-semibold text-slate-700 shrink-0">
              তৈরি: বংশধারা
            </span>
          </div>
        </div>
      </div>

      {/* Member Drawer */}
      <MemberDrawer
        treeId={tree.id}
        selectedPerson={selectedPerson}
        allPersons={persons}
        unions={unions}
        parentChild={parentChild}
        onClose={() => setSelectedPersonId(null)}
        onUpdated={fetchTreeData}
      />

      {/* Relationship Calculator Modal */}
      {isRelationshipModalOpen && (
        <RelationshipModal
          isOpen={isRelationshipModalOpen}
          onClose={() => setIsRelationshipModalOpen(false)}
          persons={persons}
          unions={unions}
          parentChild={parentChild}
          initialPersonAId={selectedPersonId}
        />
      )}

      {/* Genealogy Report Modal */}
      {isReportModalOpen && (
        <GenealogyReportModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          treeTitle={tree.title_bn}
          treeDescription={tree.description_bn}
          rootPersonId={tree.root_person_id}
          persons={persons}
          unions={unions}
          parentChild={parentChild}
        />
      )}
    </div>
  );
}
