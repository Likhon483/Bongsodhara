"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
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
import MemberDrawer from "@/components/tree/MemberDrawer";
import RelationshipModal from "@/components/tree/RelationshipModal";
import GenealogyReportModal from "@/components/tree/GenealogyReportModal";
import {
  buildTreeGraph,
  type PersonRecord,
  type UnionRecord,
  type ParentChildRecord,
  type PersonNodeData,
} from "@/lib/treeGraph";
import {
  Download,
  Search,
  Share2,
  Users,
  Check,
  Sparkles,
  TreePine,
  AlertCircle,
  Home,
  LogIn,
  Eye,
  HeartHandshake,
  FileText,
  Maximize2,
} from "lucide-react";

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

export default function PublicShareTreePage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const supabase = createClient();

  const exportStageRef = useRef<HTMLDivElement | null>(null);

  const [tree, setTree] = useState<TreeRecord | null>(null);
  const [persons, setPersons] = useState<PersonRecord[]>([]);
  const [unions, setUnions] = useState<UnionRecord[]>([]);
  const [parentChild, setParentChild] = useState<ParentChildRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);

  // Search, collapse & export states
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [frameTheme, setFrameTheme] = useState<FrameTheme>("emerald");
  const [exporting, setExporting] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
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

  useEffect(() => {
    let ignore = false;

    async function fetchPublicTree() {
      if (!slug) return;
      try {
        const { data: treeData, error: treeError } = await supabase
          .from("trees")
          .select("*")
          .eq("share_slug", slug)
          .eq("is_public", true)
          .maybeSingle();

        if (ignore) return;

        if (treeError || !treeData) {
          setNotFound(true);
          return;
        }

        const currentTree = treeData as TreeRecord;
        setTree(currentTree);

        const [personsRes, unionsRes, pcRes] = await Promise.all([
          supabase.from("persons").select("*").eq("tree_id", currentTree.id),
          supabase.from("unions").select("*").eq("tree_id", currentTree.id),
          supabase.from("parent_child").select("*").eq("tree_id", currentTree.id),
        ]);

        if (ignore) return;

        setPersons((personsRes.data as PersonRecord[]) ?? []);
        setUnions((unionsRes.data as UnionRecord[]) ?? []);
        setParentChild((pcRes.data as ParentChildRecord[]) ?? []);
      } catch (err) {
        if (!ignore) {
          console.error("fetchPublicTree error:", err);
          setNotFound(true);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    fetchPublicTree();

    return () => {
      ignore = true;
    };
  }, [slug, supabase]);

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

  async function handleCopyShareLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2500);
    } catch (err) {
      console.error("Failed to copy link:", err);
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-700">
        <div className="w-10 h-10 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm font-semibold">পাবলিক বংশধারা লোড হচ্ছে...</p>
      </div>
    );
  }

  if (notFound || !tree) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 shadow-xl p-8 text-center space-y-5">
          <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto border border-red-100 shadow-xs">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              বংশধারাটি পাওয়া যায়নি অথবা এটি পাবলিক নয়
            </h2>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
              যে বংশধারাটি আপনি খুঁজছেন সেটি হয়তো এখনও পাবলিক করা হয়নি অথবা শেয়ার
              লিংকটি সঠিক নয়। অনুগ্রহ করে লিংকটি পুনর্যাচাই করুন।
            </p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
            >
              <Home className="w-4 h-4" />
              হোম পেজ
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs transition"
            >
              <LogIn className="w-4 h-4" />
              লগইন করুন
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-100 text-slate-900 overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-emerald-800 hover:opacity-80 transition"
            title="বংশধারা হোম"
          >
            <div className="relative w-8 h-8 rounded-xl overflow-hidden shadow-xs ring-1 ring-emerald-600/30 shrink-0 bg-emerald-950">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/bongshodhara-logo.gif"
                alt="বংশধারা লোগো"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="hidden md:block">
              <span className="text-xs font-black tracking-wide text-emerald-900 block leading-tight font-serif">
                বংশধারা
              </span>
              <span className="text-[10px] text-slate-500 block leading-tight">
                পাবলিক ভিউ
              </span>
            </div>
          </Link>

          <div className="h-6 w-px bg-slate-200 mx-1 hidden md:block" />

          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-sm sm:text-base text-slate-900 leading-tight">
                {tree.title_bn}
              </h1>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                <Eye className="w-3 h-3" />
                পাবলিক
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
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
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition cursor-pointer disabled:opacity-60 shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            PNG
          </button>

          <button
            type="button"
            onClick={() => handleExportGraphic("pdf")}
            disabled={exporting}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition cursor-pointer disabled:opacity-60 shadow-2xs"
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
            onClick={handleCopyShareLink}
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
                শেয়ার
              </>
            )}
          </button>

          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-800 hover:bg-emerald-900 text-white transition shadow-2xs"
          >
            <TreePine className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">নিজের বংশধারা তৈরি করুন</span>
            <span className="sm:hidden">তৈরি করুন</span>
          </Link>
        </div>
      </header>

      {/* Stats & Search Strip */}
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
        <span className="text-slate-500">
          যেকোনো কার্ডে ক্লিক করে বিস্তারিত প্রোফাইল ও সম্পর্ক দেখুন
        </span>
      </div>

      {/* Framed Export Stage */}
      <div className="flex-1 w-full p-3 sm:p-5 flex flex-col min-h-0">
        <div
          id="bangla-family-tree-public-stage"
          ref={exportStageRef}
          className={`flex-1 w-full h-full min-h-[560px] rounded-2xl flex flex-col overflow-hidden shadow-sm ${themeClasses}`}
        >
          {/* Decorative Header Banner */}
          <div className="px-6 py-3.5 border-b border-slate-200/70 flex items-center justify-between bg-white/70 shrink-0">
            <div>
              <p className="text-[11px] font-bold tracking-wide text-emerald-700">
                পারিবারিক বংশপঞ্জি ও বংশধারা
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
              তৈরি: বংশধারা (bangla-family-tree)
            </span>
          </div>
        </div>
      </div>

      {/* Member Drawer in Read-Only Mode */}
      <MemberDrawer
        treeId={tree.id}
        selectedPerson={selectedPerson}
        allPersons={persons}
        unions={unions}
        parentChild={parentChild}
        readOnly={true}
        onClose={() => setSelectedPersonId(null)}
        onSelectPerson={(p) => setSelectedPersonId(p.id)}
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
