"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PersonRecord,
  UnionRecord,
  ParentChildRecord,
} from "./tree-layout";

export const GUEST_TREE_STORAGE_KEY = "bongshodhara_guest_tree";

export interface GuestTreeRecord {
  id: string; // "guest"
  title_bn: string;
  description_bn: string | null;
  root_person_id: string | null;
  is_public: boolean;
  share_slug: string | null;
}

export interface GuestTreeData {
  tree: GuestTreeRecord;
  persons: PersonRecord[];
  unions: UnionRecord[];
  parentChild: ParentChildRecord[];
  updatedAt: string;
}

export function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function createInitialGuestTree(): GuestTreeData {
  const rootId = generateUUID();
  return {
    tree: {
      id: "guest",
      title_bn: "আমাদের পারিবারিক বংশধারা",
      description_bn: "গেস্ট মোডে তৈরি ড্রাফট",
      root_person_id: rootId,
      is_public: false,
      share_slug: null,
    },
    persons: [
      {
        id: rootId,
        tree_id: "guest",
        full_name_bn: "পরিবারের প্রধান / পূর্বপুরুষ",
        nickname_bn: null,
        gender: "male",
        birth_date_ad: null,
        birth_date_bs: null,
        death_date_ad: null,
        is_alive: true,
        hometown_bn: null,
        occupation_bn: null,
        bio_bn: "সদস্যের তথ্য ও ছবি পরিবর্তন করতে ক্লিক করুন।",
        avatar_url: null,
      },
    ],
    unions: [],
    parentChild: [],
    updatedAt: new Date().toISOString(),
  };
}

export function getGuestTree(): GuestTreeData {
  if (typeof window === "undefined") {
    return createInitialGuestTree();
  }

  try {
    const raw = localStorage.getItem(GUEST_TREE_STORAGE_KEY);
    if (!raw) {
      const initial = createInitialGuestTree();
      saveGuestTree(initial);
      return initial;
    }

    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !Array.isArray(parsed.persons) ||
      parsed.persons.length === 0
    ) {
      const initial = createInitialGuestTree();
      saveGuestTree(initial);
      return initial;
    }

    return {
      tree: {
        id: "guest",
        title_bn: parsed.tree?.title_bn || "আমাদের পারিবারিক বংশধারা",
        description_bn: parsed.tree?.description_bn ?? null,
        root_person_id: parsed.tree?.root_person_id ?? parsed.persons[0]?.id ?? null,
        is_public: false,
        share_slug: null,
      },
      persons: parsed.persons ?? [],
      unions: parsed.unions ?? [],
      parentChild: parsed.parentChild ?? [],
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    };
  } catch (err) {
    console.error("Error reading guest tree from localStorage:", err);
    const initial = createInitialGuestTree();
    saveGuestTree(initial);
    return initial;
  }
}

export function saveGuestTree(data: GuestTreeData): void {
  if (typeof window === "undefined") return;
  try {
    data.updatedAt = new Date().toISOString();
    localStorage.setItem(GUEST_TREE_STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error("Error saving guest tree to localStorage:", err);
  }
}

export function hasGuestTree(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(GUEST_TREE_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Boolean(parsed && Array.isArray(parsed.persons) && parsed.persons.length > 0);
  } catch {
    return false;
  }
}

export function clearGuestTree(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(GUEST_TREE_STORAGE_KEY);
  } catch (err) {
    console.error("Error clearing guest tree:", err);
  }
}

export function updateGuestTreeMetadata(
  titleBn: string,
  descriptionBn?: string | null
): GuestTreeData {
  const data = getGuestTree();
  data.tree.title_bn = titleBn.trim() || "আমাদের পারিবারিক বংশধারা";
  data.tree.description_bn = descriptionBn?.trim() || null;
  saveGuestTree(data);
  return data;
}

export function updateGuestPerson(
  personId: string,
  updates: Partial<PersonRecord>
): GuestTreeData {
  const data = getGuestTree();
  const index = data.persons.findIndex((p) => p.id === personId);
  if (index !== -1) {
    data.persons[index] = {
      ...data.persons[index],
      ...updates,
      id: personId,
      tree_id: "guest",
    };
    saveGuestTree(data);
  }
  return data;
}

export interface AddGuestPersonParams {
  treeId?: string;
  mode: "child" | "spouse" | "parent";
  targetPersonId: string;
  spouseId?: string | null;
  personData: Partial<PersonRecord>;
}

export function addGuestPerson(params: AddGuestPersonParams): {
  data: GuestTreeData;
  newPerson: PersonRecord;
} {
  const data = getGuestTree();
  const newPersonId = generateUUID();

  const newPerson: PersonRecord = {
    id: newPersonId,
    tree_id: "guest",
    full_name_bn: params.personData.full_name_bn?.trim() || "নতুন সদস্য",
    nickname_bn: params.personData.nickname_bn?.trim() || null,
    gender: params.personData.gender || "male",
    birth_date_ad: params.personData.birth_date_ad?.trim() || null,
    birth_date_bs: params.personData.birth_date_bs?.trim() || null,
    death_date_ad: params.personData.is_alive
      ? null
      : params.personData.death_date_ad?.trim() || null,
    is_alive: params.personData.is_alive ?? true,
    hometown_bn: params.personData.hometown_bn?.trim() || null,
    occupation_bn: params.personData.occupation_bn?.trim() || null,
    bio_bn: params.personData.bio_bn?.trim() || null,
    avatar_url: params.personData.avatar_url || null,
  };

  data.persons.push(newPerson);

  if (params.mode === "spouse") {
    const unionId = generateUUID();
    data.unions.push({
      id: unionId,
      tree_id: "guest",
      partner_1_id: params.targetPersonId,
      partner_2_id: newPersonId,
      marriage_date_ad: null,
      status: "married",
    });
  } else if (params.mode === "child") {
    let activeUnionId: string | null = null;
    if (params.spouseId) {
      const existingUnion = data.unions.find(
        (u) =>
          (u.partner_1_id === params.targetPersonId &&
            u.partner_2_id === params.spouseId) ||
          (u.partner_2_id === params.targetPersonId &&
            u.partner_1_id === params.spouseId)
      );
      if (existingUnion) {
        activeUnionId = existingUnion.id;
      } else {
        activeUnionId = generateUUID();
        data.unions.push({
          id: activeUnionId,
          tree_id: "guest",
          partner_1_id: params.targetPersonId,
          partner_2_id: params.spouseId,
          marriage_date_ad: null,
          status: "married",
        });
      }
    }

    data.parentChild.push({
      id: generateUUID(),
      tree_id: "guest",
      union_id: activeUnionId,
      parent_id: params.targetPersonId,
      child_id: newPersonId,
      relation_type: "biological",
    });

    if (params.spouseId) {
      data.parentChild.push({
        id: generateUUID(),
        tree_id: "guest",
        union_id: activeUnionId,
        parent_id: params.spouseId,
        child_id: newPersonId,
        relation_type: "biological",
      });
    }
  } else if (params.mode === "parent") {
    data.parentChild.push({
      id: generateUUID(),
      tree_id: "guest",
      union_id: null,
      parent_id: newPersonId,
      child_id: params.targetPersonId,
      relation_type: "biological",
    });

    // If target was root, make this parent the new root
    if (data.tree.root_person_id === params.targetPersonId) {
      data.tree.root_person_id = newPersonId;
    }
  }

  saveGuestTree(data);
  return { data, newPerson };
}

export function deleteGuestPerson(personId: string): GuestTreeData {
  const data = getGuestTree();
  data.persons = data.persons.filter((p) => p.id !== personId);
  data.unions = data.unions.filter(
    (u) => u.partner_1_id !== personId && u.partner_2_id !== personId
  );
  data.parentChild = data.parentChild.filter(
    (pc) => pc.parent_id !== personId && pc.child_id !== personId
  );

  if (data.tree.root_person_id === personId) {
    data.tree.root_person_id = data.persons[0]?.id ?? null;
  }

  saveGuestTree(data);
  return data;
}

/**
 * Syncs the local guest tree into the authenticated user's Supabase account.
 * Re-maps all local temporary IDs to fresh UUIDs in Supabase, inserts tree,
 * persons, unions, and parent_child records, and clears the localStorage draft.
 */
export async function syncGuestTreeToSupabase(
  supabase: SupabaseClient,
  customGuestData?: GuestTreeData
): Promise<{ treeId: string }> {
  const guestData = customGuestData || getGuestTree();

  if (!guestData || !guestData.persons || guestData.persons.length === 0) {
    throw new Error("সংরক্ষণ করার মতো কোনো সদস্য বংশধারায় পাওয়া যায়নি।");
  }

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    throw new Error("লগইন সেশন পাওয়া যায়নি। অনুগ্রহ করে লগইন বা রেজিস্ট্রেশন করুন।");
  }

  // 1. Create Tree Record
  const { data: treeRecord, error: treeErr } = await supabase
    .from("trees")
    .insert({
      owner_id: user.id,
      title_bn: guestData.tree.title_bn || "পারিবারিক বংশধারা",
      description_bn: guestData.tree.description_bn || null,
      is_public: false,
    })
    .select()
    .single();

  if (treeErr || !treeRecord) {
    throw new Error(treeErr?.message || "বংশধারা তৈরি করা যায়নি।");
  }

  const newTreeId = treeRecord.id;

  // 2. Map IDs for persons and unions
  const personIdMap = new Map<string, string>();
  for (const p of guestData.persons) {
    personIdMap.set(p.id, generateUUID());
  }

  const unionIdMap = new Map<string, string>();
  for (const u of guestData.unions) {
    unionIdMap.set(u.id, generateUUID());
  }

  // 3. Insert Persons
  const personsToInsert = guestData.persons.map((p) => ({
    id: personIdMap.get(p.id)!,
    tree_id: newTreeId,
    full_name_bn: p.full_name_bn,
    nickname_bn: p.nickname_bn,
    gender: p.gender,
    birth_date_ad: p.birth_date_ad,
    birth_date_bs: p.birth_date_bs,
    death_date_ad: p.death_date_ad,
    is_alive: p.is_alive,
    hometown_bn: p.hometown_bn,
    occupation_bn: p.occupation_bn,
    bio_bn: p.bio_bn,
    avatar_url: p.avatar_url,
  }));

  const { error: personsErr } = await supabase
    .from("persons")
    .insert(personsToInsert);

  if (personsErr) {
    throw new Error(`সদস্যদের তথ্য সংরক্ষণে সমস্যা হয়েছে: ${personsErr.message}`);
  }

  // 4. Insert Unions
  const unionsToInsert = guestData.unions
    .filter(
      (u) => personIdMap.has(u.partner_1_id) && personIdMap.has(u.partner_2_id)
    )
    .map((u) => ({
      id: unionIdMap.get(u.id)!,
      tree_id: newTreeId,
      partner_1_id: personIdMap.get(u.partner_1_id)!,
      partner_2_id: personIdMap.get(u.partner_2_id)!,
      marriage_date_ad: u.marriage_date_ad,
      status: u.status || "married",
    }));

  if (unionsToInsert.length > 0) {
    const { error: unionsErr } = await supabase
      .from("unions")
      .insert(unionsToInsert);

    if (unionsErr) {
      console.warn("Unions insert warning:", unionsErr);
    }
  }

  // 5. Insert Parent-Child relations
  const parentChildToInsert = guestData.parentChild
    .filter(
      (pc) => personIdMap.has(pc.parent_id) && personIdMap.has(pc.child_id)
    )
    .map((pc) => ({
      id: generateUUID(),
      tree_id: newTreeId,
      parent_id: personIdMap.get(pc.parent_id)!,
      child_id: personIdMap.get(pc.child_id)!,
      union_id: pc.union_id && unionIdMap.has(pc.union_id) ? unionIdMap.get(pc.union_id)! : null,
      relation_type: pc.relation_type || "biological",
    }));

  if (parentChildToInsert.length > 0) {
    const { error: pcErr } = await supabase
      .from("parent_child")
      .insert(parentChildToInsert);

    if (pcErr) {
      console.warn("ParentChild insert warning:", pcErr);
    }
  }

  // 6. Update root person
  const newRootId = guestData.tree.root_person_id
    ? personIdMap.get(guestData.tree.root_person_id)
    : personsToInsert[0]?.id;

  if (newRootId) {
    await supabase
      .from("trees")
      .update({ root_person_id: newRootId })
      .eq("id", newTreeId);
  }

  // 7. Clear guest tree from localStorage
  clearGuestTree();

  return { treeId: newTreeId };
}
