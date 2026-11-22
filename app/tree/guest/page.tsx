"use client";

import { useEffect, useState, useCallback, useMemo, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { exportTreeGraphics } from "@/lib/export-tree";
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
  getGuestTree,
  saveGuestTree,
  clearGuestTree,
  updateGuestTreeMetadata,
  syncGuestTreeToSupabase,
  generateUUID,
  type GuestTreeData,
} from "@/lib/guest-tree";
import {
  ArrowLeft,
  Download,
  Search,
  FileJson,
  Users,
  Sparkles,
  Upload,
  Loader2,
  HeartHandshake,
  FileText,
  Maximize2,
  Cloud,
  Edit2,
  Check,
  X,
  Lock,
  Mail,
  UserCheck,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { formatErrorMessage } from "@/lib/error-utils";

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

function GuestTreeEditor() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const exportStageRef = useRef<HTMLDivElement | null>(null);
  const restoreFileInputRef = useRef<HTMLInputElement | null>(null);

  const [guestData, setGuestData] = useState<GuestTreeData | null>(() => {
    if (typeof window !== "undefined") {
      return getGuestTree();
    }
    return null;
  });
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);

  // Search, collapse & export states
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [frameTheme, setFrameTheme] = useState<FrameTheme>("emerald");
  const [exporting, setExporting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [isRelationshipModalOpen, setIsRelationshipModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance<
    Node<PersonNodeData>,
    Edge
  > | null>(null);

  // Sync / Save to account modal state
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isTitleModalOpen, setIsTitleModalOpen] = useState(false);
  const [tempTitleBn, setTempTitleBn] = useState("");
  const [tempDescBn, setTempDescBn] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<PersonNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // 1. Storage reload helper
  const reloadFromStorage = useCallback(() => {
    const data = getGuestTree();
    setGuestData(data);
  }, []);

  useEffect(() => {
    if (!guestData) {
      const timer = setTimeout(() => {
        setGuestData(getGuestTree());
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [guestData]);

  // Check auth status for modal
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) {
        setCurrentUserEmail(user.email);
      }
    });
  }, [supabase]);

  // 2. Handle auto-sync if user returns from login with ?action=sync
  const handledAutoSyncRef = useRef(false);
  useEffect(() => {
    const action = searchParams.get("action");
    if (action === "sync" && !handledAutoSyncRef.current) {
      handledAutoSyncRef.current = true;
      (async () => {
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (user) {
            setSyncing(true);
            const res = await syncGuestTreeToSupabase(supabase);
            alert("আপনার বংশধারা সফলভাবে অ্যাকাউন্টে সংরক্ষিত হয়েছে!");
            router.push(`/tree/${res.treeId}`);
          }
        } catch (err) {
          console.error("Auto sync error:", err);
          setSyncError(formatErrorMessage(err));
        } finally {
          setSyncing(false);
        }
      })();
    }
  }, [searchParams, supabase, router]);

  const persons = useMemo(() => guestData?.persons ?? [], [guestData?.persons]);
  const unions = useMemo(() => guestData?.unions ?? [], [guestData?.unions]);
  const parentChild = useMemo(() => guestData?.parentChild ?? [], [guestData?.parentChild]);
  const tree = guestData?.tree ?? null;

  const handleResetView = useCallback(() => {
    if (rfInstance) {
      rfInstance.fitView({ padding: 0.2, duration: 400 });
    }
  }, [rfInstance]);

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

  // Statistics
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
    a.download = `${tree?.title_bn || "bongshodhara"}-backup.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleRestoreJsonBackup(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (!file.name.toLowerCase().endsWith(".json") && file.type !== "application/json") {
      alert("অনুগ্রহ করে একটি বৈধ .json ব্যাকআপ ফাইল নির্বাচন করুন।");
      return;
    }

    try {
      setRestoring(true);
      const fileText = await file.text();
      const json = JSON.parse(fileText);

      const rawPersons = Array.isArray(json.persons)
        ? json.persons
        : Array.isArray(json.members)
        ? json.members
        : null;

      if (!rawPersons || rawPersons.length === 0) {
        alert("ব্যাকআপ ফাইলে কোনো সদস্যের তথ্য খুঁজে পাওয়া যায়নি।");
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

      const personIdMap = new Map<string, string>();
      const restoredPersons: PersonRecord[] = rawPersons.map((raw: Record<string, unknown>) => {
        const oldId = String(raw.id || "");
        const newId = generateUUID();
        personIdMap.set(oldId, newId);
        return {
          id: newId,
          tree_id: "guest",
          full_name_bn: String(raw.full_name_bn || raw.name_bn || "সদস্য"),
          nickname_bn: raw.nickname_bn ? String(raw.nickname_bn) : null,
          gender:
            raw.gender === "female" || raw.gender === "other"
              ? (raw.gender as "female" | "other")
              : "male",
          birth_date_ad: raw.birth_date_ad ? String(raw.birth_date_ad) : null,
          birth_date_bs: raw.birth_date_bs ? String(raw.birth_date_bs) : null,
          death_date_ad: raw.death_date_ad ? String(raw.death_date_ad) : null,
          is_alive: typeof raw.is_alive === "boolean" ? raw.is_alive : true,
          hometown_bn: raw.hometown_bn ? String(raw.hometown_bn) : null,
          occupation_bn: raw.occupation_bn ? String(raw.occupation_bn) : null,
          bio_bn: raw.bio_bn ? String(raw.bio_bn) : null,
          avatar_url: raw.avatar_url ? String(raw.avatar_url) : null,
        };
      });

      const unionIdMap = new Map<string, string>();
      const restoredUnions: UnionRecord[] = [];
      for (const raw of rawUnions) {
        const u = raw as Record<string, unknown>;
        const oldUId = String(u.id || "");
        const oldP1 = String(u.partner_1_id || "");
        const oldP2 = String(u.partner_2_id || "");
        const newP1 = personIdMap.get(oldP1);
        const newP2 = personIdMap.get(oldP2);
        if (newP1 && newP2) {
          const newUId = generateUUID();
          unionIdMap.set(oldUId, newUId);
          restoredUnions.push({
            id: newUId,
            tree_id: "guest",
            partner_1_id: newP1,
            partner_2_id: newP2,
            marriage_date_ad: u.marriage_date_ad ? String(u.marriage_date_ad) : null,
            status: String(u.status || "married"),
          });
        }
      }

      const restoredParentChild: ParentChildRecord[] = [];
      for (const raw of rawParentChild) {
        const pc = raw as Record<string, unknown>;
        const newP = personIdMap.get(String(pc.parent_id || ""));
        const newC = personIdMap.get(String(pc.child_id || ""));
        if (newP && newC && newP !== newC) {
          const oldUId = pc.union_id ? String(pc.union_id) : null;
          const newUId = oldUId ? unionIdMap.get(oldUId) ?? null : null;
          restoredParentChild.push({
            id: generateUUID(),
            tree_id: "guest",
            parent_id: newP,
            child_id: newC,
            union_id: newUId,
            relation_type: String(pc.relation_type || "biological"),
          });
        }
      }

      const rootId = json.tree?.root_person_id
        ? personIdMap.get(String(json.tree.root_person_id)) ?? restoredPersons[0]?.id
        : restoredPersons[0]?.id;

      const newGuestData: GuestTreeData = {
        tree: {
          id: "guest",
          title_bn: String(json.tree?.title_bn || "রিস্টোর করা বংশধারা"),
          description_bn: json.tree?.description_bn ? String(json.tree.description_bn) : null,
          root_person_id: rootId ?? null,
          is_public: false,
          share_slug: null,
        },
        persons: restoredPersons,
        unions: restoredUnions,
        parentChild: restoredParentChild,
        updatedAt: new Date().toISOString(),
      };

      saveGuestTree(newGuestData);
      setGuestData(newGuestData);
      alert(
        `সফলভাবে ${toBengaliDigits(restoredPersons.length)} জন সদস্যের ব্যাকআপ গেস্ট মোডে রিস্টোর করা হয়েছে!`
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
      await exportTreeGraphics({
        element: exportStageRef.current,
        fileNameBase: tree.title_bn || "bongshodhara-guest",
        format,
        orientation: "landscape",
        backgroundColor:
          frameTheme === "emerald"
            ? "#f0fdf4"
            : frameTheme === "royal"
            ? "#fffbeb"
            : "#ffffff",
      });
    } catch (err: unknown) {
      console.error("handleExportGraphic error:", err);
      alert("এক্সপোর্ট করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।");
    } finally {
      setExporting(false);
    }
  }

  function handleSaveTreeTitle(e: React.FormEvent) {
    e.preventDefault();
    if (!tempTitleBn.trim()) return;
    const updated = updateGuestTreeMetadata(tempTitleBn, tempDescBn);
    setGuestData(updated);
    setIsTitleModalOpen(false);
  }

  // Handle Cloud Sync Modal Actions
  async function handleSyncWithCurrentSession() {
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await syncGuestTreeToSupabase(supabase);
      setIsSaveModalOpen(false);
      alert("আপনার বংশধারা সফলভাবে অ্যাকাউন্টে সংরক্ষিত হয়েছে!");
      router.push(`/tree/${res.treeId}`);
    } catch (err: unknown) {
      console.error("handleSyncWithCurrentSession error:", err);
      setSyncError(formatErrorMessage(err));
    } finally {
      setSyncing(false);
    }
  }

  async function handleAuthAndSync(e: React.FormEvent) {
    e.preventDefault();
    if (!authEmail.trim() || !authPassword.trim()) {
      setSyncError("অনুগ্রহ করে ইমেইল ও পাসওয়ার্ড প্রদান করুন।");
      return;
    }

    setSyncing(true);
    setSyncError(null);

    try {
      if (authMode === "signup") {
        const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
          email: authEmail.trim(),
          password: authPassword.trim(),
        });
        if (signUpErr) throw signUpErr;

        // If session returned immediately:
        if (signUpData.session) {
          const res = await syncGuestTreeToSupabase(supabase);
          setIsSaveModalOpen(false);
          alert("অ্যাকাউন্ট তৈরি ও বংশধারা সফলভাবে সংরক্ষিত হয়েছে!");
          router.push(`/tree/${res.treeId}`);
          return;
        }

        // Try direct sign in if auto-confirm:
        const { data: signInData, error: signInErr } =
          await supabase.auth.signInWithPassword({
            email: authEmail.trim(),
            password: authPassword.trim(),
          });

        if (!signInErr && signInData.session) {
          const res = await syncGuestTreeToSupabase(supabase);
          setIsSaveModalOpen(false);
          alert("অ্যাকাউন্ট তৈরি ও বংশধারা সফলভাবে সংরক্ষিত হয়েছে!");
          router.push(`/tree/${res.treeId}`);
          return;
        }

        // If email confirmation is strictly enforced:
        alert(
          "অ্যাকাউন্ট তৈরি হয়েছে! অনুগ্রহ করে ইনবক্স ভেরিফাই করুন অথবা সরাসরি লগইন করে বংশধারা সিঙ্ক করুন।"
        );
        router.push("/login?redirect=/tree/guest&action=sync");
      } else {
        const { data: signInData, error: signInErr } =
          await supabase.auth.signInWithPassword({
            email: authEmail.trim(),
            password: authPassword.trim(),
          });
        if (signInErr) throw signInErr;

        if (signInData.session) {
          const res = await syncGuestTreeToSupabase(supabase);
          setIsSaveModalOpen(false);
          alert("লগইন ও বংশধারা সফলভাবে সংরক্ষিত হয়েছে!");
          router.push(`/tree/${res.treeId}`);
        }
      }
    } catch (err: unknown) {
      console.error("handleAuthAndSync error:", err);
      setSyncError(formatErrorMessage(err));
    } finally {
      setSyncing(false);
    }
  }

  function handleResetTreeDraft() {
    const confirmed = window.confirm(
      "আপনি কি নিশ্চিত যে সম্পূর্ণ নতুন করে বংশধারা শুরু করতে চান? বর্তমান লোকাল ড্রাফটের সব সদস্য মুছে যাবে।"
    );
    if (!confirmed) return;
    clearGuestTree();
    reloadFromStorage();
  }

  const themeClasses =
    frameTheme === "emerald"
      ? "border-4 border-double border-emerald-600 bg-gradient-to-b from-emerald-50/40 via-white to-emerald-50/30"
      : frameTheme === "royal"
      ? "border-4 border-double border-amber-500 bg-gradient-to-b from-amber-50/50 via-white to-amber-50/30"
      : "border-2 border-slate-300 bg-white";

  if (!guestData || !tree) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 text-stone-600 text-sm">
        <Loader2 className="w-5 h-5 animate-spin text-emerald-600 mr-2" />
        গেস্ট বংশধারা প্রস্তুত হচ্ছে...
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-100 text-slate-900 overflow-hidden font-sans">
      {/* 1. Guest Mode Prominent Top Notice Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 text-white px-3 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2 shadow-sm z-40 text-xs">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-300/30 font-bold text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            গেস্ট মোড
          </span>
          <span className="text-emerald-100 hidden sm:inline">
            লগইন ছাড়াই বংশধারা তৈরি করছেন • ব্রাউজারে ড্রাফট স্বয়ংক্রিয় সেভ হচ্ছে
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setSyncError(null);
              setIsSaveModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1 sm:px-4 sm:py-1.5 rounded-xl font-bold bg-amber-400 hover:bg-amber-300 text-emerald-950 shadow-md shadow-amber-950/20 transition cursor-pointer text-xs"
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>অ্যাকাউন্টে সংরক্ষণ করুন</span>
          </button>
        </div>
      </div>

      {/* 2. Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            হোম
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
            <div className="flex items-center gap-1.5">
              <h1 className="font-bold text-sm sm:text-base text-slate-900 leading-tight">
                {tree.title_bn}
              </h1>
              <button
                type="button"
                onClick={() => {
                  setTempTitleBn(tree.title_bn);
                  setTempDescBn(tree.description_bn || "");
                  setIsTitleModalOpen(true);
                }}
                className="p-1 text-slate-400 hover:text-emerald-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                title="বংশধারার নাম পরিবর্তন করুন"
              >
                <Edit2 className="w-3 h-3" />
              </button>
            </div>
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
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white transition cursor-pointer disabled:opacity-60 shadow-2xs"
            title="হাই-রেজোলিউশন বাংলা PNG ডাউনলোড"
          >
            <Download className="w-3.5 h-3.5" />
            PNG
          </button>

          <button
            type="button"
            onClick={() => handleExportGraphic("pdf")}
            disabled={exporting}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition cursor-pointer disabled:opacity-60 shadow-2xs"
            title="হাই-রেজোলিউশন বাংলা PDF ডাউনলোড"
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition cursor-pointer shadow-2xs"
            title="প্রজন্মভিত্তিক বংশপঞ্জি রিপোর্ট ও প্রিন্ট লিস্ট"
          >
            <FileText className="w-3.5 h-3.5 text-emerald-600" />
            রিপোর্ট
          </button>

          <button
            type="button"
            onClick={() => setIsRelationshipModalOpen(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition cursor-pointer shadow-2xs"
            title="যেকোনো দুজন সদস্যের মধ্যকার সম্পর্ক নির্ণয় করুন"
          >
            <HeartHandshake className="w-3.5 h-3.5 text-emerald-600" />
            সম্পর্ক খুঁজুন
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
                রিস্টোর
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

          <button
            type="button"
            onClick={handleResetTreeDraft}
            className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition cursor-pointer"
            title="সম্পূর্ণ নতুন ড্রাফট শুরু করুন"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
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
        <span className="text-emerald-800 font-medium">
          যেকোনো কার্ডে ক্লিক করে তথ্য, ছবি, সন্তান, জীবনসঙ্গী বা অভিভাবক যুক্ত করুন
        </span>
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
            <div className="text-right flex items-center gap-2">
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
        treeId="guest"
        selectedPerson={selectedPerson}
        allPersons={persons}
        unions={unions}
        parentChild={parentChild}
        onClose={() => setSelectedPersonId(null)}
        onUpdated={reloadFromStorage}
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

      {/* Tree Title Edit Modal */}
      {isTitleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">
                বংশধারার শিরোনাম পরিবর্তন
              </h3>
              <button
                onClick={() => setIsTitleModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveTreeTitle} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  বংশধারার নাম *
                </label>
                <input
                  type="text"
                  required
                  value={tempTitleBn}
                  onChange={(e) => setTempTitleBn(e.target.value)}
                  placeholder="যেমন: মজুমদার পরিবারের বংশধারা"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  সংক্ষিপ্ত বিবরণ (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  value={tempDescBn}
                  onChange={(e) => setTempDescBn(e.target.value)}
                  placeholder="যেমন: আমাদের পূর্বপুরুষ ও বংশপরম্পরা"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsTitleModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-800 hover:bg-emerald-900 text-white shadow-md shadow-emerald-900/15"
                >
                  সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Save To Account Modal */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-7 w-full max-w-md shadow-2xl border border-slate-100 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-600 via-amber-400 to-teal-600" />
            
            <div className="flex items-start justify-between pb-3 pt-1">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold mb-1">
                  <Cloud className="w-3.5 h-3.5 text-emerald-600" />
                  ক্লাউড সংরক্ষণ
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  অ্যাকাউন্টে সংরক্ষণ করুন
                </h3>
              </div>
              <button
                onClick={() => setIsSaveModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              আপনার বংশধারা স্থায়ীভাবে ক্লাউডে নিরাপদ রাখতে, শেয়ারযোগ্য পাবলিক লিংক তৈরি করতে এবং যেকোনো ডিভাইস থেকে পরিচালনা করতে অ্যাকাউন্টে সংরক্ষণ করুন।
            </p>

            {syncError && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{syncError}</span>
              </div>
            )}

            {currentUserEmail ? (
              <div className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 text-xs text-emerald-950 flex items-center gap-3">
                  <UserCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <p className="font-semibold">আপনি লগইন আছেন:</p>
                    <p className="text-emerald-800 font-mono text-[11px] truncate">
                      {currentUserEmail}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSyncWithCurrentSession}
                  disabled={syncing}
                  className="w-full py-3 rounded-2xl font-bold bg-emerald-800 hover:bg-emerald-900 text-white shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2 text-sm transition cursor-pointer disabled:opacity-60"
                >
                  {syncing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                      সংরক্ষিত হচ্ছে...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 text-amber-300" />
                      এই অ্যাকাউন্টে সেভ করুন
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div>
                {/* Tabs */}
                <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-2xl mb-4 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("signup");
                      setSyncError(null);
                    }}
                    className={`py-2 rounded-xl transition ${
                      authMode === "signup"
                        ? "bg-white text-emerald-900 shadow-xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    নতুন অ্যাকাউন্ট
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("login");
                      setSyncError(null);
                    }}
                    className={`py-2 rounded-xl transition ${
                      authMode === "login"
                        ? "bg-white text-emerald-900 shadow-xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    লগইন করুন
                  </button>
                </div>

                <form onSubmit={handleAuthAndSync} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      ইমেইল ঠিকানা
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        placeholder="yourname@gmail.com"
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      পাসওয়ার্ড
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        placeholder="কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড"
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={syncing}
                    className="w-full py-3 rounded-2xl font-bold bg-emerald-800 hover:bg-emerald-900 text-white shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2 text-xs sm:text-sm transition cursor-pointer disabled:opacity-60"
                  >
                    {syncing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                        সংরক্ষণ হচ্ছে...
                      </>
                    ) : authMode === "signup" ? (
                      <>
                        <Cloud className="w-4 h-4 text-amber-300" />
                        অ্যাকাউন্ট তৈরি ও সংরক্ষণ করুন
                      </>
                    ) : (
                      <>
                        <Cloud className="w-4 h-4 text-amber-300" />
                        লগইন ও সংরক্ষণ করুন
                      </>
                    )}
                  </button>
                </form>

                <div className="mt-3 text-center">
                  <Link
                    href="/login?redirect=/tree/guest&action=sync"
                    className="text-[11px] font-semibold text-emerald-700 hover:underline inline-flex items-center gap-1"
                  >
                    অথবা মূল লগইন পেজে যান
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function GuestTreePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-stone-50 text-stone-600 text-sm">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-600 mr-2" />
          বংশধারা লোড হচ্ছে...
        </div>
      }
    >
      <GuestTreeEditor />
    </Suspense>
  );
}
