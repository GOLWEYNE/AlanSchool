// Pure helpers shared by the mock test entry page, its server actions and the report card.
// (No server-only imports: client components use this file too.)

export type MockKind = "IELTS" | "SAT";

export const IELTS_SECTIONS = ["listening", "reading", "writing", "speaking"] as const;
export const SAT_SECTIONS = ["readingWriting", "math"] as const;

export const isMockKind = (v: unknown): v is MockKind => v === "IELTS" || v === "SAT";

/** IELTS overall band = average of the four sections, rounded to the nearest half band. */
export const ieltsOverall = (sections: Record<string, number | null | undefined>): number | null => {
  const vals = IELTS_SECTIONS.map((k) => sections[k]);
  if (vals.some((v) => typeof v !== "number" || Number.isNaN(v))) return null;
  const avg = (vals as number[]).reduce((a, b) => a + b, 0) / vals.length;
  return Math.round(avg * 2) / 2;
};

/** SAT total = Reading & Writing + Math (each 200-800). */
export const satTotal = (sections: Record<string, number | null | undefined>): number | null => {
  const rw = sections.readingWriting;
  const m = sections.math;
  if (typeof rw !== "number" || typeof m !== "number" || Number.isNaN(rw) || Number.isNaN(m)) return null;
  return rw + m;
};

export type MockScoreInput = {
  studentId: string;
  score?: number | null;
  sections?: Record<string, number | null | undefined> | null;
};

/** Resolves the stored score for one row (explicit total/overall wins, otherwise computed from sections). */
export const resolveScore = (kind: MockKind, row: MockScoreInput): number | null => {
  if (typeof row.score === "number" && !Number.isNaN(row.score)) return row.score;
  const sections = row.sections ?? {};
  return kind === "IELTS" ? ieltsOverall(sections) : satTotal(sections);
};

export const validScore = (kind: MockKind, score: number): boolean =>
  kind === "IELTS"
    ? score >= 0 && score <= 9 && Math.round(score * 2) === score * 2
    : score >= 400 && score <= 1600 && Number.isInteger(score);

export const validSection = (kind: MockKind, key: string, value: number): boolean => {
  if (kind === "IELTS") {
    return (IELTS_SECTIONS as readonly string[]).includes(key) && value >= 0 && value <= 9 && Math.round(value * 2) === value * 2;
  }
  return (SAT_SECTIONS as readonly string[]).includes(key) && value >= 200 && value <= 800 && Number.isInteger(value);
};
