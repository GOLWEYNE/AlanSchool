import prisma from "@/lib/prisma";

// Olympiad records: school / city / region / republic / international contests a
// student took part in, with the placing. Kept in its own table that is created
// on first use (same bootstrap pattern as ensureMockTests), so the feature works
// right after deploy without a separate migration step.

export const OLYMPIAD_LEVELS = ["SCHOOL", "CITY", "REGION", "REPUBLIC", "INTERNATIONAL"] as const;
export type OlympiadLevel = (typeof OLYMPIAD_LEVELS)[number];

export const OLYMPIAD_RESULTS = ["FIRST", "SECOND", "THIRD", "SPECIAL", "PARTICIPANT"] as const;
export type OlympiadResult = (typeof OLYMPIAD_RESULTS)[number];

const LEVEL_WEIGHT: Record<OlympiadLevel, number> = {
  SCHOOL: 1,
  CITY: 2,
  REGION: 3,
  REPUBLIC: 4,
  INTERNATIONAL: 5,
};

const RESULT_WEIGHT: Record<OlympiadResult, number> = {
  FIRST: 5,
  SECOND: 4,
  THIRD: 3,
  SPECIAL: 2,
  PARTICIPANT: 1,
};

export const isLevel = (v: unknown): v is OlympiadLevel =>
  typeof v === "string" && (OLYMPIAD_LEVELS as readonly string[]).includes(v);
export const isResult = (v: unknown): v is OlympiadResult =>
  typeof v === "string" && (OLYMPIAD_RESULTS as readonly string[]).includes(v);

export const isPrize = (result: string) => result !== "PARTICIPANT";

export type OlympiadRow = {
  id: number;
  studentId: string;
  name: string;
  subject: string | null;
  level: OlympiadLevel;
  result: OlympiadResult;
  heldOn: Date | null;
  note: string | null;
};

export type OlympiadSummary = {
  entries: number;
  prizes: number;
  best: { level: OlympiadLevel; result: OlympiadResult } | null;
  byLevel: Record<OlympiadLevel, number>;
};

export const emptyOlympiadSummary = (): OlympiadSummary => ({
  entries: 0,
  prizes: 0,
  best: null,
  byLevel: { SCHOOL: 0, CITY: 0, REGION: 0, REPUBLIC: 0, INTERNATIONAL: 0 },
});

export function summarizeOlympiads(rows: OlympiadRow[]): OlympiadSummary {
  const s = emptyOlympiadSummary();
  let bestScore = -1;
  for (const r of rows) {
    s.entries += 1;
    if (isPrize(r.result)) s.prizes += 1;
    s.byLevel[r.level] += 1;
    const score = LEVEL_WEIGHT[r.level] * 10 + RESULT_WEIGHT[r.result];
    if (score > bestScore) {
      bestScore = score;
      s.best = { level: r.level, result: r.result };
    }
  }
  return s;
}

const DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS "StudentOlympiad" (
    "id" SERIAL NOT NULL,
    "studentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT,
    "level" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "heldOn" DATE,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentOlympiad_pkey" PRIMARY KEY ("id")
)`,
  `CREATE INDEX IF NOT EXISTS "StudentOlympiad_studentId_idx" ON "StudentOlympiad"("studentId")`,
];

let ready = false;
let pending: Promise<boolean> | null = null;

async function prepare(): Promise<boolean> {
  try {
    await prisma.$queryRawUnsafe(`SELECT 1 FROM "StudentOlympiad" LIMIT 1`);
    return true;
  } catch {
    try {
      for (const statement of DDL) {
        await prisma.$executeRawUnsafe(statement);
      }
      await prisma.$queryRawUnsafe(`SELECT 1 FROM "StudentOlympiad" LIMIT 1`);
      return true;
    } catch (error) {
      console.error("[olympiads] could not prepare table", error);
      return false;
    }
  }
}

export async function ensureOlympiads(): Promise<boolean> {
  if (ready) return true;
  if (!pending) {
    pending = prepare().finally(() => {
      pending = null;
    });
  }
  const ok = await pending;
  if (ok) ready = true;
  return ok;
}

type RawRow = {
  id: number;
  studentId: string;
  name: string;
  subject: string | null;
  level: string;
  result: string;
  heldOn: Date | null;
  note: string | null;
};

// Olympiad records of the given students, newest first. Empty when the table is unavailable.
export async function loadOlympiads(studentIds: string[]): Promise<OlympiadRow[]> {
  if (studentIds.length === 0) return [];
  if (!(await ensureOlympiads())) return [];
  try {
    const rows = await prisma.$queryRawUnsafe<RawRow[]>(
      `SELECT "id", "studentId", "name", "subject", "level", "result", "heldOn", "note"
       FROM "StudentOlympiad"
       WHERE "studentId" = ANY($1::text[])
       ORDER BY "heldOn" DESC NULLS LAST, "id" DESC`,
      studentIds
    );
    return rows
      .filter((r) => isLevel(r.level) && isResult(r.result))
      .map((r) => ({
        id: Number(r.id),
        studentId: r.studentId,
        name: r.name,
        subject: r.subject,
        level: r.level as OlympiadLevel,
        result: r.result as OlympiadResult,
        heldOn: r.heldOn ? new Date(r.heldOn) : null,
        note: r.note,
      }));
  } catch (error) {
    console.error("[olympiads] could not load", error);
    return [];
  }
}
