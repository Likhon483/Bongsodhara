import type { Node, Edge } from "@xyflow/react";

export interface PersonRecord {
  id: string;
  tree_id: string;
  full_name_bn: string;
  nickname_bn: string | null;
  gender: "male" | "female" | "other";
  birth_date_ad: string | null;
  birth_date_bs: string | null;
  death_date_ad: string | null;
  is_alive: boolean;
  hometown_bn: string | null;
  occupation_bn: string | null;
  bio_bn: string | null;
  avatar_url: string | null;
}

export interface UnionRecord {
  id: string;
  tree_id: string;
  partner_1_id: string;
  partner_2_id: string;
  marriage_date_ad: string | null;
  status: string;
}

export interface ParentChildRecord {
  id: string;
  tree_id: string;
  union_id: string | null;
  parent_id: string;
  child_id: string;
  relation_type: string;
}

export interface PersonNodeData extends Record<string, unknown> {
  person: PersonRecord;
  generation: number;
  isRoot: boolean;
  onSelectPerson: (person: PersonRecord) => void;
  hasChildren?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: (personId: string) => void;
}

const NODE_WIDTH = 220;
const NODE_HEIGHT = 110;
const HORIZONTAL_GAP = 48;
const SPOUSE_GAP = 28;
const VERTICAL_GAP = 145;
const SUB_ROW_GAP = 125;
const GREEN_EDGE = "#059669";

export function buildTreeGraph(params: {
  persons: PersonRecord[];
  unions: UnionRecord[];
  parentChild: ParentChildRecord[];
  rootPersonId: string | null;
  onSelectPerson: (person: PersonRecord) => void;
}): { nodes: Node<PersonNodeData>[]; edges: Edge[] } {
  const { persons, unions, parentChild, rootPersonId, onSelectPerson } = params;

  if (persons.length === 0) {
    return { nodes: [], edges: [] };
  }

  const personMap = new Map<string, PersonRecord>();
  for (const p of persons) {
    personMap.set(p.id, p);
  }

  // Identify primary husband & wives per union
  const wivesOfHusband = new Map<string, string[]>();
  const husbandsOfWife = new Map<string, string[]>();
  const unionByPair = new Map<string, UnionRecord>();

  const pairKey = (a: string, b: string) => `${a}__${b}`;

  const pushUnique = (map: Map<string, string[]>, key: string, val: string) => {
    if (!personMap.has(key) || !personMap.has(val)) return;
    const arr = map.get(key) ?? [];
    if (!arr.includes(val)) arr.push(val);
    map.set(key, arr);
  };

  for (const u of unions) {
    const p1 = personMap.get(u.partner_1_id);
    const p2 = personMap.get(u.partner_2_id);
    if (!p1 || !p2) continue;

    unionByPair.set(pairKey(p1.id, p2.id), u);
    unionByPair.set(pairKey(p2.id, p1.id), u);

    if (p1.gender === "male" && p2.gender !== "male") {
      pushUnique(wivesOfHusband, p1.id, p2.id);
      pushUnique(husbandsOfWife, p2.id, p1.id);
    } else if (p2.gender === "male" && p1.gender !== "male") {
      pushUnique(wivesOfHusband, p2.id, p1.id);
      pushUnique(husbandsOfWife, p1.id, p2.id);
    } else {
      pushUnique(wivesOfHusband, p1.id, p2.id);
      pushUnique(husbandsOfWife, p2.id, p1.id);
    }
  }

  // Parent-child maps
  const childrenOfParent = new Map<string, string[]>();
  const parentsOfChild = new Map<string, string[]>();

  for (const pc of parentChild) {
    if (!personMap.has(pc.parent_id) || !personMap.has(pc.child_id)) continue;
    const chList = childrenOfParent.get(pc.parent_id) ?? [];
    if (!chList.includes(pc.child_id)) chList.push(pc.child_id);
    childrenOfParent.set(pc.parent_id, chList);

    const paList = parentsOfChild.get(pc.child_id) ?? [];
    if (!paList.includes(pc.parent_id)) paList.push(pc.parent_id);
    parentsOfChild.set(pc.child_id, paList);
  }

  // Assign generation tiers:
  // Husband -> tier G (sub-row 0)
  // Wife of husband -> tier G (sub-row 1, below husband)
  // Child -> tier G + 1
  // Parent -> tier G - 1
  const startId =
    rootPersonId && personMap.has(rootPersonId) ? rootPersonId : persons[0].id;

  const genMap = new Map<string, number>();
  const subRowMap = new Map<string, number>();
  const queue: string[] = [startId];
  genMap.set(startId, 0);
  subRowMap.set(startId, 0);

  while (queue.length > 0) {
    const currId = queue.shift()!;
    const currGen = genMap.get(currId) ?? 0;

    // Wives placed in sub-row 1 below husband in same generation
    for (const wifeId of wivesOfHusband.get(currId) ?? []) {
      if (!genMap.has(wifeId)) {
        genMap.set(wifeId, currGen);
        subRowMap.set(wifeId, 1);
        queue.push(wifeId);
      }
    }

    // Husband placed in sub-row 0 above wife
    for (const husbandId of husbandsOfWife.get(currId) ?? []) {
      if (!genMap.has(husbandId)) {
        genMap.set(husbandId, currGen);
        subRowMap.set(husbandId, 0);
        queue.push(husbandId);
      }
    }

    // Children go to next generation
    for (const childId of childrenOfParent.get(currId) ?? []) {
      if (!genMap.has(childId)) {
        genMap.set(childId, currGen + 1);
        subRowMap.set(childId, 0);
        queue.push(childId);
      }
    }

    // Parents go to previous generation
    for (const parentId of parentsOfChild.get(currId) ?? []) {
      if (!genMap.has(parentId)) {
        genMap.set(parentId, currGen - 1);
        subRowMap.set(parentId, 0);
        queue.push(parentId);
      }
    }
  }

  let fallbackGen = 0;
  for (const p of persons) {
    if (!genMap.has(p.id)) {
      genMap.set(p.id, fallbackGen);
      subRowMap.set(p.id, 0);
      fallbackGen += 1;
    }
  }

  // Normalize min generation to 0
  let minGen = Infinity;
  for (const g of genMap.values()) {
    if (g < minGen) minGen = g;
  }
  const genShift = minGen === Infinity ? 0 : -minGen;
  for (const [id, g] of genMap.entries()) {
    genMap.set(id, g + genShift);
  }

  // Group into generation blocks and place husband on top row, wives on row below,
  // and children directly underneath the mother/wife row
  const byGen = new Map<number, PersonRecord[]>();
  for (const p of persons) {
    const g = genMap.get(p.id) ?? 0;
    if (!byGen.has(g)) byGen.set(g, []);
    byGen.get(g)!.push(p);
  }

  const sortedGens = Array.from(byGen.keys()).sort((a, b) => a - b);
  const placed = new Set<string>();
  const positions = new Map<string, { x: number; y: number }>();

  let currentBaseY = 0;

  for (const gen of sortedGens) {
    const genPersons = byGen.get(gen) ?? [];
    const remaining = genPersons.filter((p) => !placed.has(p.id));
    if (remaining.length === 0) continue;

    // Build family clusters inside this generation:
    // A husband + his wives form a cluster where husband is top row (0) and wives are row (1).
    interface Cluster {
      topIds: string[];
      bottomIds: string[];
      width: number;
    }

    const clusters: Cluster[] = [];
    const localSeen = new Set<string>();

    for (const p of remaining) {
      if (localSeen.has(p.id)) continue;

      const wives = (wivesOfHusband.get(p.id) ?? []).filter(
        (wid) => (genMap.get(wid) ?? 0) === gen && !localSeen.has(wid)
      );

      if (wives.length > 0) {
        localSeen.add(p.id);
        wives.forEach((wid) => localSeen.add(wid));

        const bottomWidth =
          wives.length * NODE_WIDTH + Math.max(0, wives.length - 1) * SPOUSE_GAP;
        const clusterWidth = Math.max(NODE_WIDTH, bottomWidth);

        clusters.push({
          topIds: [p.id],
          bottomIds: wives,
          width: clusterWidth,
        });
      } else {
        localSeen.add(p.id);
        clusters.push({
          topIds: [p.id],
          bottomIds: [],
          width: NODE_WIDTH,
        });
      }
    }

    const hasAnyBottomRow = clusters.some((c) => c.bottomIds.length > 0);
    const totalRowWidth =
      clusters.reduce((sum, c) => sum + c.width, 0) +
      Math.max(0, clusters.length - 1) * HORIZONTAL_GAP;

    let cursorX = -totalRowWidth / 2;

    for (const cl of clusters) {
      const clusterCenterX = cursorX + cl.width / 2;

      // Top row (husband or single person)
      const topTotalW =
        cl.topIds.length * NODE_WIDTH + Math.max(0, cl.topIds.length - 1) * SPOUSE_GAP;
      let topX = clusterCenterX - topTotalW / 2;
      for (const tid of cl.topIds) {
        positions.set(tid, { x: topX, y: currentBaseY });
        placed.add(tid);
        topX += NODE_WIDTH + SPOUSE_GAP;
      }

      // Bottom row (wives under husband)
      if (cl.bottomIds.length > 0) {
        const botTotalW =
          cl.bottomIds.length * NODE_WIDTH +
          Math.max(0, cl.bottomIds.length - 1) * SPOUSE_GAP;
        let botX = clusterCenterX - botTotalW / 2;
        const botY = currentBaseY + SUB_ROW_GAP;
        for (const bid of cl.bottomIds) {
          positions.set(bid, { x: botX, y: botY });
          placed.add(bid);
          botX += NODE_WIDTH + SPOUSE_GAP;
        }
      }

      cursorX += cl.width + HORIZONTAL_GAP;
    }

    currentBaseY += hasAnyBottomRow
      ? SUB_ROW_GAP + NODE_HEIGHT + VERTICAL_GAP
      : NODE_HEIGHT + VERTICAL_GAP;
  }

  // Any remaining fallback positions
  for (const p of persons) {
    if (!positions.has(p.id)) {
      positions.set(p.id, { x: 0, y: currentBaseY });
      currentBaseY += NODE_HEIGHT + VERTICAL_GAP;
    }
  }

  // Build React Flow nodes
  const nodes: Node<PersonNodeData>[] = persons.map((person) => {
    const pos = positions.get(person.id) ?? { x: 0, y: 0 };
    const gen = genMap.get(person.id) ?? 0;

    return {
      id: person.id,
      type: "personNode",
      position: pos,
      data: {
        person,
        generation: gen,
        isRoot: person.id === startId,
        onSelectPerson,
      },
    };
  });

  // Build all edges in green (#059669)
  const edges: Edge[] = [];

  // Spouse union edges (green)
  for (const u of unions) {
    if (personMap.has(u.partner_1_id) && personMap.has(u.partner_2_id)) {
      edges.push({
        id: `union-${u.id}`,
        source: u.partner_1_id,
        target: u.partner_2_id,
        type: "smoothstep",
        style: {
          stroke: GREEN_EDGE,
          strokeWidth: 2,
          strokeDasharray: u.status === "divorced" ? "4 4" : undefined,
        },
      });
    }
  }

  // Parent-child edges (green)
  // If a child has both a mother (wife) and father (husband) in the same generation,
  // connect from the mother/wife below so each wife's children sit directly beneath her.
  for (const pc of parentChild) {
    if (!personMap.has(pc.parent_id) || !personMap.has(pc.child_id)) continue;

    const childParents = parentsOfChild.get(pc.child_id) ?? [];
    const parentPerson = personMap.get(pc.parent_id);

    // Avoid duplicate edge if child belongs to a husband+wife pair and we attach to wife
    if (parentPerson?.gender === "male") {
      const wives = wivesOfHusband.get(pc.parent_id) ?? [];
      const childHasWifeParent = wives.some((wid) => childParents.includes(wid));
      if (childHasWifeParent) {
        continue;
      }
    }

    edges.push({
      id: `pc-${pc.id}`,
      source: pc.parent_id,
      target: pc.child_id,
      type: "smoothstep",
      style: {
        stroke: GREEN_EDGE,
        strokeWidth: 2,
      },
    });
  }

  return { nodes, edges };
}
