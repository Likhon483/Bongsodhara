import type {
  PersonRecord,
  UnionRecord,
  ParentChildRecord,
} from "@/lib/treeGraph";

export type EdgeRelationType = "parent" | "child" | "spouse" | "sibling";

export interface PathStep {
  fromPerson: PersonRecord;
  toPerson: PersonRecord;
  edgeType: EdgeRelationType;
  stepLabel: string;
}

export interface RelationshipResult {
  found: boolean;
  samePerson: boolean;
  title: string;
  relationOfBtoA: string;
  relationOfAtoB: string;
  stepsCount: number;
  steps: PathStep[];
  pathPersons: PersonRecord[];
  summaryNote?: string;
}

interface Neighbor {
  person: PersonRecord;
  edgeType: EdgeRelationType;
  label: string;
}

function toBengaliDigits(num: number): string {
  const bn = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return String(num)
    .split("")
    .map((d) => (/\d/.test(d) ? bn[Number(d)] : d))
    .join("");
}

export function calculateRelationship(params: {
  personAId: string;
  personBId: string;
  persons: PersonRecord[];
  unions: UnionRecord[];
  parentChild: ParentChildRecord[];
}): RelationshipResult {
  const { personAId, personBId, persons, unions, parentChild } = params;

  if (personAId === personBId) {
    const person = persons.find((p) => p.id === personAId);
    const name = person?.full_name_bn || "নির্বাচিত সদস্য";
    return {
      found: true,
      samePerson: true,
      title: "একই ব্যক্তি",
      relationOfBtoA: `${name} ও তিনি একই ব্যক্তি।`,
      relationOfAtoB: `${name} ও তিনি একই ব্যক্তি।`,
      stepsCount: 0,
      steps: [],
      pathPersons: person ? [person] : [],
      summaryNote: "নিজের সাথে সম্পর্ক পরিমাপ প্রযোজ্য নয়।",
    };
  }

  const personMap = new Map<string, PersonRecord>();
  for (const p of persons) {
    personMap.set(p.id, p);
  }

  const personA = personMap.get(personAId);
  const personB = personMap.get(personBId);

  if (!personA || !personB) {
    return {
      found: false,
      samePerson: false,
      title: "সদস্য পাওয়া যায়নি",
      relationOfBtoA: "নির্বাচিত সদস্যদের তথ্য তালিকায় পাওয়া যায়নি।",
      relationOfAtoB: "নির্বাচিত সদস্যদের তথ্য তালিকায় পাওয়া যায়নি।",
      stepsCount: 0,
      steps: [],
      pathPersons: [],
    };
  }

  // Pre-index relationships
  const parentsMap = new Map<string, string[]>();
  const childrenMap = new Map<string, string[]>();

  for (const pc of parentChild) {
    const pList = parentsMap.get(pc.child_id) ?? [];
    pList.push(pc.parent_id);
    parentsMap.set(pc.child_id, pList);

    const cList = childrenMap.get(pc.parent_id) ?? [];
    cList.push(pc.child_id);
    childrenMap.set(pc.parent_id, cList);
  }

  const spousesMap = new Map<string, string[]>();
  for (const u of unions) {
    const s1 = spousesMap.get(u.partner_1_id) ?? [];
    if (!s1.includes(u.partner_2_id)) s1.push(u.partner_2_id);
    spousesMap.set(u.partner_1_id, s1);

    const s2 = spousesMap.get(u.partner_2_id) ?? [];
    if (!s2.includes(u.partner_1_id)) s2.push(u.partner_1_id);
    spousesMap.set(u.partner_2_id, s2);
  }

  // Build full graph adjacency
  const adj = new Map<string, Neighbor[]>();

  for (const p of persons) {
    const neighbors: Neighbor[] = [];
    const seenNeighborIds = new Set<string>();

    // 1. Parents
    const parentIds = parentsMap.get(p.id) ?? [];
    for (const prId of parentIds) {
      const pr = personMap.get(prId);
      if (pr && !seenNeighborIds.has(pr.id)) {
        seenNeighborIds.add(pr.id);
        neighbors.push({
          person: pr,
          edgeType: "parent",
          label: pr.gender === "female" ? "মাতা" : "পিতা",
        });
      }
    }

    // 2. Children
    const childIds = childrenMap.get(p.id) ?? [];
    for (const chId of childIds) {
      const ch = personMap.get(chId);
      if (ch && !seenNeighborIds.has(ch.id)) {
        seenNeighborIds.add(ch.id);
        neighbors.push({
          person: ch,
          edgeType: "child",
          label: ch.gender === "female" ? "কন্যা" : "পুত্র",
        });
      }
    }

    // 3. Spouses
    const spouseIds = spousesMap.get(p.id) ?? [];
    for (const spId of spouseIds) {
      const sp = personMap.get(spId);
      if (sp && !seenNeighborIds.has(sp.id)) {
        seenNeighborIds.add(sp.id);
        neighbors.push({
          person: sp,
          edgeType: "spouse",
          label: sp.gender === "female" ? "স্ত্রী" : "স্বামী",
        });
      }
    }

    // 4. Siblings (share at least one parent)
    const siblingIds = new Set<string>();
    for (const prId of parentIds) {
      const sIds = childrenMap.get(prId) ?? [];
      for (const sId of sIds) {
        if (sId !== p.id) {
          siblingIds.add(sId);
        }
      }
    }

    for (const sbId of siblingIds) {
      const sb = personMap.get(sbId);
      if (sb && !seenNeighborIds.has(sb.id)) {
        seenNeighborIds.add(sb.id);
        neighbors.push({
          person: sb,
          edgeType: "sibling",
          label: sb.gender === "female" ? "বোন" : "ভাই",
        });
      }
    }

    adj.set(p.id, neighbors);
  }

  // BFS search for shortest path from personAId to personBId
  const queue: string[] = [personAId];
  const visited = new Set<string>([personAId]);
  const parentStep = new Map<
    string,
    { prevId: string; step: PathStep }
  >();

  let found = false;

  while (queue.length > 0) {
    const currentId = queue.shift()!;

    if (currentId === personBId) {
      found = true;
      break;
    }

    const currentPerson = personMap.get(currentId)!;
    const neighbors = adj.get(currentId) ?? [];

    for (const nb of neighbors) {
      if (!visited.has(nb.person.id)) {
        visited.add(nb.person.id);
        parentStep.set(nb.person.id, {
          prevId: currentId,
          step: {
            fromPerson: currentPerson,
            toPerson: nb.person,
            edgeType: nb.edgeType,
            stepLabel: nb.label,
          },
        });
        queue.push(nb.person.id);
      }
    }
  }

  if (!found) {
    return {
      found: false,
      samePerson: false,
      title: "কোনো সরাসরি সংযোগ পাওয়া যায়নি",
      relationOfBtoA: `${personB.full_name_bn}-এর সাথে ${personA.full_name_bn}-এর সরাসরি কোনো পারিবারিক বা বৈবাহিক সংযোগ নেই।`,
      relationOfAtoB: `${personA.full_name_bn}-এর সাথে ${personB.full_name_bn}-এর সরাসরি কোনো পারিবারিক বা বৈবাহিক সংযোগ নেই।`,
      stepsCount: 0,
      steps: [],
      pathPersons: [personA, personB],
      summaryNote: "এই দুজনের মধ্যে কোনো রক্তীয় বা বৈবাহিক সংযোগ তালিকাভুক্ত নেই।",
    };
  }

  // Reconstruct path
  const steps: PathStep[] = [];
  let curr = personBId;
  while (curr !== personAId) {
    const record = parentStep.get(curr)!;
    steps.unshift(record.step);
    curr = record.prevId;
  }

  const pathPersons: PersonRecord[] = [personA];
  for (const step of steps) {
    pathPersons.push(step.toPerson);
  }

  // Determine Bengali relationship title and text
  const interpretation = interpretRelationship({
    personA,
    personB,
    steps,
  });

  return {
    found: true,
    samePerson: false,
    title: interpretation.title,
    relationOfBtoA: `${personB.full_name_bn} হলেন ${personA.full_name_bn}-এর ${interpretation.title}`,
    relationOfAtoB: `${personA.full_name_bn} হলেন ${personB.full_name_bn}-এর ${interpretation.reverseTitle}`,
    stepsCount: steps.length,
    steps,
    pathPersons,
    summaryNote: interpretation.summaryNote,
  };
}

function interpretRelationship(params: {
  personA: PersonRecord;
  personB: PersonRecord;
  steps: PathStep[];
}): { title: string; reverseTitle: string; summaryNote?: string } {
  const { personA, personB, steps } = params;
  const n = steps.length;

  const aIsMale = personA.gender === "male";
  const aIsFemale = personA.gender === "female";
  const bIsMale = personB.gender === "male";
  const bIsFemale = personB.gender === "female";

  // Length 1
  if (n === 1) {
    const edge = steps[0].edgeType;

    if (edge === "parent") {
      const title = bIsFemale ? "মা / মাতা" : "বাবা / পিতা";
      const reverseTitle = aIsFemale ? "মেয়ে / কন্যা" : "ছেলে / পুত্র";
      return { title, reverseTitle };
    }

    if (edge === "child") {
      const title = bIsFemale ? "মেয়ে / কন্যা" : "ছেলে / পুত্র";
      const reverseTitle = aIsFemale ? "মা" : "বাবা";
      return { title, reverseTitle };
    }

    if (edge === "spouse") {
      const title = bIsFemale ? "স্ত্রী" : "স্বামী";
      const reverseTitle = aIsFemale ? "স্ত্রী" : "স্বামী";
      return { title, reverseTitle };
    }

    if (edge === "sibling") {
      const title = bIsFemale ? "বোন" : "ভাই";
      const reverseTitle = aIsFemale ? "বোন" : "ভাই";
      return { title, reverseTitle };
    }
  }

  // Length 2
  if (n === 2) {
    const [e1, e2] = [steps[0].edgeType, steps[1].edgeType];
    const mid = steps[0].toPerson;
    const midIsMale = mid.gender === "male";
    const midIsFemale = mid.gender === "female";

    // parent -> parent (Grandparents)
    if (e1 === "parent" && e2 === "parent") {
      if (midIsMale) {
        // Paternal Grandparents
        const title = bIsFemale ? "দাদি" : "দাদা";
        const reverseTitle = aIsFemale ? "নাতনি (পৌত্রী)" : "নাতি (পৌত্র)";
        return { title, reverseTitle, summaryNote: "বাবার বাবা/মা (দাদা-দাদি)" };
      } else {
        // Maternal Grandparents
        const title = bIsFemale ? "নানি" : "নানা";
        const reverseTitle = aIsFemale ? "নাতনি (দৌহিত্রী)" : "নাতি (দৌহিত্র)";
        return { title, reverseTitle, summaryNote: "মায়ের বাবা/মা (নানা-নানি)" };
      }
    }

    // child -> child (Grandchildren)
    if (e1 === "child" && e2 === "child") {
      const title = bIsFemale ? "নাতনি" : "নাতি";
      let reverseTitle = "দাদা / নানা";
      if (midIsMale) {
        reverseTitle = aIsFemale ? "দাদি" : "দাদা";
      } else if (midIsFemale) {
        reverseTitle = aIsFemale ? "নানি" : "নানা";
      }
      return { title, reverseTitle };
    }

    // parent -> sibling (Uncle / Aunt)
    if (e1 === "parent" && e2 === "sibling") {
      if (midIsMale) {
        // Father's sibling: চাচা / ফুফু
        const title = bIsFemale ? "ফুফু" : "চাচা";
        const reverseTitle = aIsFemale ? "ভাতিজি" : "ভাতিজা";
        return {
          title,
          reverseTitle,
          summaryNote: bIsFemale ? "বাবার বোন (ফুফু)" : "বাবার ভাই (চাচা)",
        };
      } else {
        // Mother's sibling: মামা / খালা
        const title = bIsFemale ? "খালা" : "মামা";
        const reverseTitle = aIsFemale ? "ভাগ্নি" : "ভাগ্নে";
        return {
          title,
          reverseTitle,
          summaryNote: bIsFemale ? "মায়ের বোন (খালা)" : "মায়ের ভাই (মামা)",
        };
      }
    }

    // sibling -> child (Nephew / Niece)
    if (e1 === "sibling" && e2 === "child") {
      if (midIsMale) {
        // Brother's child: ভাতিজা / ভাতিজি
        const title = bIsFemale ? "ভাতিজি" : "ভাতিজা";
        const reverseTitle = aIsFemale ? "ফুফু" : "চাচা";
        return {
          title,
          reverseTitle,
          summaryNote: bIsFemale ? "ভাইয়ের মেয়ে (ভাতিজি)" : "ভাইয়ের ছেলে (ভাতিজা)",
        };
      } else {
        // Sister's child: ভাগ্নে / ভাগ্নি
        const title = bIsFemale ? "ভাগ্নি" : "ভাগ্নে";
        const reverseTitle = aIsFemale ? "খালা" : "মামা";
        return {
          title,
          reverseTitle,
          summaryNote: bIsFemale ? "বোনের মেয়ে (ভাগ্নি)" : "বোনের ছেলে (ভাগ্নে)",
        };
      }
    }

    // spouse -> parent (Parents-in-law)
    if (e1 === "spouse" && e2 === "parent") {
      const title = bIsFemale ? "শাশুড়ি" : "শ্বশুর";
      const reverseTitle = aIsFemale
        ? "পুত্রবধূ (ছেলের বউ)"
        : "জামাই (মেয়ের জামাই)";
      return { title, reverseTitle, summaryNote: "জীবনসঙ্গীর পিতা/মাতা" };
    }

    // child -> spouse (Children-in-law)
    if (e1 === "child" && e2 === "spouse") {
      const title = bIsFemale ? "পুত্রবধূ (ছেলের বউ)" : "জামাই (মেয়ের জামাই)";
      const reverseTitle = aIsFemale ? "শাশুড়ি" : "শ্বশুর";
      return { title, reverseTitle };
    }

    // sibling -> spouse (Brother/Sister-in-law)
    if (e1 === "sibling" && e2 === "spouse") {
      if (midIsMale) {
        // Brother's wife: ভাবি
        const title = "ভাবি";
        const reverseTitle = aIsFemale ? "ননদ" : "দেবর / ভাসুর";
        return { title, reverseTitle, summaryNote: "ভাইয়ের স্ত্রী" };
      } else {
        // Sister's husband: দুলাভাই
        const title = "দুলাভাই (ভগ্নিপতি)";
        const reverseTitle = aIsFemale ? "শ্যালিকা (শালী)" : "শ্যালক (শালা)";
        return { title, reverseTitle, summaryNote: "বোনের স্বামী" };
      }
    }

    // spouse -> sibling (Spouse's sibling)
    if (e1 === "spouse" && e2 === "sibling") {
      if (aIsMale) {
        // Wife's brother/sister: শ্যালক / শ্যালিকা
        const title = bIsFemale ? "শ্যালিকা (শালী)" : "শ্যালক (শালা)";
        const reverseTitle = "দুলাভাই";
        return {
          title,
          reverseTitle,
          summaryNote: bIsFemale ? "স্ত্রীর বোন (শালী)" : "স্ত্রীর ভাই (শালা)",
        };
      } else {
        // Husband's brother/sister: দেবর / ভাসুর / ননদ
        const title = bIsFemale ? "ননদ" : "দেবর / ভাসুর";
        const reverseTitle = "ভাবি";
        return {
          title,
          reverseTitle,
          summaryNote: bIsFemale ? "স্বামীর বোন (ননদ)" : "স্বামীর ভাই (দেবর/ভাসুর)",
        };
      }
    }
  }

  // Length 3
  if (n === 3) {
    const [e1, e2, e3] = [
      steps[0].edgeType,
      steps[1].edgeType,
      steps[2].edgeType,
    ];

    // parent -> parent -> parent (Great-grandparent)
    if (e1 === "parent" && e2 === "parent" && e3 === "parent") {
      const isPaternal = steps[0].toPerson.gender === "male";
      const title = isPaternal
        ? bIsFemale
          ? "পরদাদি"
          : "পরদাদা"
        : bIsFemale
        ? "পরনানি"
        : "পরনানা";
      const reverseTitle = aIsFemale
        ? "পুতি / পুতনি (প্রপৌত্রী)"
        : "পুতি (প্রপৌত্র)";
      return { title, reverseTitle, summaryNote: "৩য় প্রজন্মের পূর্বপুরুষ" };
    }

    // child -> child -> child (Great-grandchild)
    if (e1 === "child" && e2 === "child" && e3 === "child") {
      const title = bIsFemale ? "পুতনি (প্রপৌত্রী)" : "পুতি (প্রপৌত্র)";
      const reverseTitle = aIsFemale ? "পরদাদি / পরনানি" : "পরদাদা / পরনানা";
      return { title, reverseTitle, summaryNote: "৩য় প্রজন্মের বংশধর" };
    }

    // parent -> sibling -> child (COUSIN)
    if (e1 === "parent" && e2 === "sibling" && e3 === "child") {
      const p = steps[0].toPerson;
      const u = steps[1].toPerson;

      if (p.gender === "male") {
        if (u.gender === "male") {
          // চাচাতো ভাই/বোন
          const title = bIsFemale ? "চাচাতো বোন" : "চাচাতো ভাই";
          const reverseTitle = aIsFemale ? "চাচাতো বোন" : "চাচাতো ভাই";
          return { title, reverseTitle, summaryNote: "বাবার ভাইয়ের সন্তান" };
        } else {
          // ফুফাতো ভাই/বোন
          const title = bIsFemale ? "ফুফাতো বোন" : "ফুফাতো ভাই";
          const reverseTitle = aIsFemale ? "মামাতো বোন" : "মামাতো ভাই";
          return { title, reverseTitle, summaryNote: "বাবার বোনের সন্তান" };
        }
      } else {
        if (u.gender === "male") {
          // মামাতো ভাই/বোন
          const title = bIsFemale ? "মামাতো বোন" : "মামাতো ভাই";
          const reverseTitle = aIsFemale ? "ফুফাতো বোন" : "ফুফাতো ভাই";
          return { title, reverseTitle, summaryNote: "মায়ের ভাইয়ের সন্তান" };
        } else {
          // খালাতো ভাই/বোন
          const title = bIsFemale ? "খালাতো বোন" : "খালাতো ভাই";
          const reverseTitle = aIsFemale ? "খালাতো বোন" : "খালাতো ভাই";
          return { title, reverseTitle, summaryNote: "মায়ের বোনের সন্তান" };
        }
      }
    }

    // parent -> sibling -> spouse (Uncle/Aunt's spouse: চাচি, ফুফা, মামি, খালু)
    if (e1 === "parent" && e2 === "sibling" && e3 === "spouse") {
      const p = steps[0].toPerson;
      const u = steps[1].toPerson;

      if (p.gender === "male") {
        if (u.gender === "male") {
          return {
            title: "চাচি",
            reverseTitle: aIsFemale ? "ভাতিজি" : "ভাতিজা",
            summaryNote: "চাচা (বাবার ভাই)-এর স্ত্রী",
          };
        } else {
          return {
            title: "ফুফা",
            reverseTitle: aIsFemale ? "ভাগ্নি" : "ভাগ্নে",
            summaryNote: "ফুফু (বাবার বোন)-এর স্বামী",
          };
        }
      } else {
        if (u.gender === "male") {
          return {
            title: "মামি",
            reverseTitle: aIsFemale ? "ভাগ্নি" : "ভাগ্নে",
            summaryNote: "মামা (মায়ের ভাই)-এর স্ত্রী",
          };
        } else {
          return {
            title: "খালু",
            reverseTitle: aIsFemale ? "খালাতো সন্তান" : "ভাগ্নে-তুল্য",
            summaryNote: "খালা (মায়ের বোন)-এর স্বামী",
          };
        }
      }
    }

    // spouse -> sibling -> spouse (ভায়রা / জা)
    if (e1 === "spouse" && e2 === "sibling" && e3 === "spouse") {
      if (aIsMale && bIsMale) {
        return {
          title: "ভায়রা (ভায়রাভাই)",
          reverseTitle: "ভায়রা (ভায়রাভাই)",
          summaryNote: "স্ত্রীর বোনের স্বামী",
        };
      }
      if (aIsFemale && bIsFemale) {
        return {
          title: "জা",
          reverseTitle: "জা",
          summaryNote: "স্বামীর ভাইয়ের স্ত্রী",
        };
      }
    }

    // parent -> parent -> sibling (Grandparent's sibling: দাদা/নানার ভাই/বোন)
    if (e1 === "parent" && e2 === "parent" && e3 === "sibling") {
      const title = bIsFemale
        ? "দাদি / নানি (দাদা/নানার বোন)"
        : "দাদা / নানা (দাদা/নানার ভাই)";
      const reverseTitle = aIsFemale ? "নাতনি" : "নাতি";
      return { title, reverseTitle, summaryNote: "দাদা বা নানার ভাই/বোন" };
    }
  }

  // Length 4: Cousin's child or Great-uncle
  if (n === 4) {
    if (
      steps[0].edgeType === "parent" &&
      steps[1].edgeType === "sibling" &&
      steps[2].edgeType === "child" &&
      steps[3].edgeType === "child"
    ) {
      const title = bIsFemale
        ? "চাচাতো/খালাতো ভাইয়ের মেয়ে (ভাতিজি-তুল্য)"
        : "চাচাতো/খালাতো ভাইয়ের ছেলে (ভাতিজা-তুল্য)";
      const reverseTitle = aIsFemale ? "ফুফু/খালা-তুল্য" : "চাচা/মামা-তুল্য";
      return { title, reverseTitle, summaryNote: "৪ ধাপের রক্তীয় আত্মীয়তা" };
    }
  }

  // Fallback: Descriptive step chain
  const title = `পারিবারিক আত্মীয় (${toBengaliDigits(n)} ধাপ)`;
  const reverseTitle = `পারিবারিক আত্মীয় (${toBengaliDigits(n)} ধাপ)`;

  return {
    title,
    reverseTitle,
    summaryNote: `${toBengaliDigits(n)} ধাপের পারিবারিক সংযোগ`,
  };
}
