"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getUserRole } from "@/lib/auth";
import { getTeacherClassIds } from "@/lib/teacherScope";
import { ensureMockTests } from "@/lib/mockTests";
import { schoolDayRange } from "@/lib/schoolTime";
import {
  isMockKind,
  resolveScore,
  validScore,
  validSection,
  type MockKind,
} from "@/lib/mockTestsShared";

type TFn = (key: string, values?: Record<string, string | number>) => string;
export type MockResult = { ok: boolean; error?: string; saved?: number };

const PATH = "/dashboard/list/mock-tests";
const HOUR = 3600_000;

const translator = async () => (await getTranslations("MockTests")) as unknown as TFn;

async function caller() {
  const { userId, sessionClaims } = await auth();
  return { userId, role: userId ? getUserRole(sessionClaims) : "" };
}

const rowSchema = z.object({
  studentId: z.string().min(1).max(100),
  score: z.number().finite().nullable().optional(),
  sections: z.record(z.string(), z.number().finite().nullable().optional()).nullable().optional(),
});

const saveSchema = z.object({
  kind: z.enum(["IELTS", "SAT"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rows: z.array(rowSchema).min(1).max(300),
});

export type SaveMockScoresInput = z.infer<typeof saveSchema>;

// Which students may this caller enter scores for? Admins: everyone. Teachers: students in their own classes.
async function allowedStudentIds(role: string, userId: string, ids: string[]): Promise<Set<string>> {
  if (role === "admin") {
    const rows = await prisma.student.findMany({ where: { id: { in: ids } }, select: { id: true } });
    return new Set(rows.map((r) => r.id));
  }
  const classIds = await getTeacherClassIds(userId);
  const rows = await prisma.student.findMany({
    where: { id: { in: ids }, classId: { in: classIds } },
    select: { id: true },
  });
  return new Set(rows.map((r) => r.id));
}

/**
 * Saves one test day's scores for many students. One score per student, test type and school day:
 * a re-save replaces what was entered for that day. Rows left blank are ignored (nothing is deleted).
 */
export async function saveMockScores(input: SaveMockScoresInput): Promise<MockResult> {
  const t = await translator();
  const { userId, role } = await caller();
  if (!userId || (role !== "admin" && role !== "teacher")) return { ok: false, error: t("errors.notAllowed") };

  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: t("errors.invalid") };
  const { kind, date, rows } = parsed.data;
  const k: MockKind = kind;

  // Resolve + validate every row before writing anything.
  const clean: { studentId: string; score: number; sections: Record<string, number> | null }[] = [];
  for (const row of rows) {
    const sections: Record<string, number> = {};
    for (const [key, value] of Object.entries(row.sections ?? {})) {
      if (value === null || value === undefined) continue;
      if (!validSection(k, key, value)) return { ok: false, error: t("errors.invalidSection") };
      sections[key] = value;
    }
    const score = resolveScore(k, { studentId: row.studentId, score: row.score ?? null, sections });
    if (score === null) continue; // blank row
    if (!validScore(k, score)) return { ok: false, error: t(k === "IELTS" ? "errors.invalidBand" : "errors.invalidTotal") };
    clean.push({ studentId: row.studentId, score, sections: Object.keys(sections).length ? sections : null });
  }
  if (!clean.length) return { ok: false, error: t("errors.nothingToSave") };

  const allowed = await allowedStudentIds(role, userId, clean.map((c) => c.studentId));
  if (clean.some((c) => !allowed.has(c.studentId))) return { ok: false, error: t("errors.notAllowed") };

  if (!(await ensureMockTests())) return { ok: false, error: t("errors.unavailable") };

  const [dayStart, dayEnd] = schoolDayRange(date);
  const takenAt = new Date(dayStart.getTime() + 12 * HOUR); // midday school time on that date
  try {
    await prisma.$transaction([
      prisma.mockTestScore.deleteMany({
        where: { studentId: { in: clean.map((c) => c.studentId) }, kind: k, takenAt: { gte: dayStart, lt: dayEnd } },
      }),
      prisma.mockTestScore.createMany({
        data: clean.map((c) => ({
          studentId: c.studentId,
          kind: k,
          score: c.score,
          sections: c.sections ?? undefined,
          takenAt,
        })),
      }),
    ]);
  } catch (error) {
    console.error("[mockTests] save failed", error);
    return { ok: false, error: t("errors.unavailable") };
  }

  revalidatePath(PATH);
  return { ok: true, saved: clean.length };
}

export async function deleteMockScore(id: number): Promise<MockResult> {
  const t = await translator();
  const { userId, role } = await caller();
  if (!userId || (role !== "admin" && role !== "teacher")) return { ok: false, error: t("errors.notAllowed") };
  if (!Number.isInteger(id)) return { ok: false, error: t("errors.invalid") };
  if (!(await ensureMockTests())) return { ok: false, error: t("errors.unavailable") };

  const row = await prisma.mockTestScore.findUnique({ where: { id }, select: { studentId: true, kind: true } });
  if (!row || !isMockKind(row.kind)) return { ok: false, error: t("errors.invalid") };
  const allowed = await allowedStudentIds(role, userId, [row.studentId]);
  if (!allowed.has(row.studentId)) return { ok: false, error: t("errors.notAllowed") };

  await prisma.mockTestScore.delete({ where: { id } });
  revalidatePath(PATH);
  return { ok: true };
}
