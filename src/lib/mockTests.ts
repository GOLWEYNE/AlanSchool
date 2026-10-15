import prisma from "@/lib/prisma";
import { MOCK_TEST_DDL } from "@/lib/mockTestDdl";

// Table bootstrap, same pattern as ensureHallPass(): create the table if it is missing
// (idempotent) so the report card works right after deploy; `prisma migrate deploy` stays safe.
let ready = false;
let pending: Promise<boolean> | null = null;

async function prepare(): Promise<boolean> {
  try {
    await prisma.mockTestScore.count();
    return true;
  } catch {
    try {
      for (const statement of MOCK_TEST_DDL) {
        await prisma.$executeRawUnsafe(statement);
      }
      await prisma.mockTestScore.count();
      return true;
    } catch (error) {
      console.error("[mockTests] could not prepare table", error);
      return false;
    }
  }
}

export async function ensureMockTests(): Promise<boolean> {
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

export type MockKind = "IELTS" | "SAT";

export type MockTestRow = {
  kind: MockKind;
  score: number;
  sections: Record<string, number> | null;
  takenAt: Date;
};

/** All IELTS/SAT mock scores of a student, oldest first. Empty when the table is unavailable. */
export async function loadMockTests(studentId: string): Promise<MockTestRow[]> {
  if (!(await ensureMockTests())) return [];
  const rows = await prisma.mockTestScore.findMany({
    where: { studentId, kind: { in: ["IELTS", "SAT"] } },
    orderBy: { takenAt: "asc" },
  });
  return rows.map((r) => ({
    kind: r.kind as MockKind,
    score: r.score,
    sections:
      r.sections && typeof r.sections === "object" && !Array.isArray(r.sections)
        ? (r.sections as Record<string, number>)
        : null,
    takenAt: r.takenAt,
  }));
}
