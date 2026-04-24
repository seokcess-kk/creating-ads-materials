// 오퍼 입력 글자수 가이드 + 금기어 검출.

export const OFFER_LIMITS = {
  titleSoft: 16,
  titleHard: 40,
  uspSoft: 40,
  uspHard: 80,
  benefitItem: 28,
  urgencySoft: 28,
} as const;

export interface CharCounterState {
  count: number;
  soft: number;
  hard: number;
  level: "ok" | "warn" | "over";
}

export function countChars(value: string, soft: number, hard: number): CharCounterState {
  const count = [...value].length;
  let level: CharCounterState["level"] = "ok";
  if (count > hard) level = "over";
  else if (count > soft) level = "warn";
  return { count, soft, hard, level };
}

export interface TabooHit {
  term: string;
  field: "title" | "usp" | "benefit" | "urgency" | "evidence";
  index?: number;
}

const COMMON_TABOOS = [
  "100% 보장",
  "100% 확실",
  "절대 보장",
  "최저가 보장",
  "1등",
  "유일한",
  "최고의",
];

function findTaboos(text: string, taboos: string[]): string[] {
  const all = Array.from(new Set([...COMMON_TABOOS, ...taboos]));
  const hits: string[] = [];
  for (const t of all) {
    if (!t.trim()) continue;
    if (text.includes(t)) hits.push(t);
  }
  return hits;
}

export interface OfferDraftLike {
  title: string;
  usp: string | null;
  benefits: string[];
  urgency: string | null;
  evidence: string[];
}

export function detectTabooHits(draft: OfferDraftLike, brandTaboos: string[]): TabooHit[] {
  const hits: TabooHit[] = [];
  for (const t of findTaboos(draft.title, brandTaboos)) {
    hits.push({ term: t, field: "title" });
  }
  if (draft.usp) {
    for (const t of findTaboos(draft.usp, brandTaboos)) {
      hits.push({ term: t, field: "usp" });
    }
  }
  draft.benefits.forEach((b, i) => {
    for (const t of findTaboos(b, brandTaboos)) {
      hits.push({ term: t, field: "benefit", index: i });
    }
  });
  if (draft.urgency) {
    for (const t of findTaboos(draft.urgency, brandTaboos)) {
      hits.push({ term: t, field: "urgency" });
    }
  }
  draft.evidence.forEach((e, i) => {
    for (const t of findTaboos(e, brandTaboos)) {
      hits.push({ term: t, field: "evidence", index: i });
    }
  });
  return hits;
}
