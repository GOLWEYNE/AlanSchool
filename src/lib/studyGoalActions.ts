"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import prisma from "./prisma";
import { getUserRole } from "./auth";
import { fromWallClock } from "./schoolTime";
import { MAX_STUDY_GOALS, withStudyGoalTable } from "./studyGoals";

export type StudyGoalActionResult =
  | { ok: true }
  | { ok: false; error: "unauthorized" | "invalid" | "limit" | "notFound" | "unavailable" };

const PAGE = "/dashboard/list/study-planner";

// Only a student manages their own goals; the goal's studentId is always the
// signed-in user, never something the client sends.
const currentStudentId = () => {
  const { userId, sessionClaims } = auth();
  if (!userId || getUserRole(sessionClaims) !== "student") return null;
  return userId;
};

const CreateGoalSchema = z.object({
  title: z.string().trim().min(1).max(120),
  subjectId: z.number().int().positive().nullable().optional(),
  // "YYYY-MM-DD" from an <input type="date">
  targetDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

export async function createStudyGoal(input: {
  title: string;
  subjectId?: number | null;
  targetDate?: string | null;
}): Promise<StudyGoalActionResult> {
  const studentId = currentStudentId();
  if (!studentId) return { ok: false, error: "unauthorized" };

  const parsed = CreateGoalSchema.safeParse({
    ...input,
    targetDate: input.targetDate || null,
  });
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { title, subjectId, targetDate } = parsed.data;

  let target: Date | null = null;
  if (targetDate) {
    const [year, month, day] = targetDate.split("-").map(Number);
    const check = new Date(Date.UTC(year, month - 1, day));
    if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
      return { ok: false, error: "invalid" };
    }
    // Stored as school-time midnight of that day (same clock as the timetable).
    target = fromWallClock({ year, month, day });
  }

  try {
    const existing = await withStudyGoalTable(() =>
      prisma.studyGoal.count({ where: { studentId } })
    );
    if (existing >= MAX_STUDY_GOALS) return { ok: false, error: "limit" };

    await withStudyGoalTable(() =>
      prisma.studyGoal.create({
        data: { studentId, title, subjectId: subjectId ?? null, targetDate: target },
      })
    );
  } catch (error) {
    console.error("createStudyGoal failed", error);
    return { ok: false, error: "unavailable" };
  }

  revalidatePath(PAGE);
  return { ok: true };
}

/**
 * Sets a goal's progress (0-100). Reaching 100 completes the goal; going back
 * below 100 reopens it.
 */
export async function setStudyGoalProgress(
  id: number,
  progress: number
): Promise<StudyGoalActionResult> {
  const studentId = currentStudentId();
  if (!studentId) return { ok: false, error: "unauthorized" };
  if (!Number.isInteger(id) || !Number.isInteger(progress) || progress < 0 || progress > 100) {
    return { ok: false, error: "invalid" };
  }

  try {
    const current = await withStudyGoalTable(() =>
      prisma.studyGoal.findFirst({
        where: { id, studentId },
        select: { completedAt: true },
      })
    );
    if (!current) return { ok: false, error: "notFound" };

    await withStudyGoalTable(() =>
      prisma.studyGoal.updateMany({
        where: { id, studentId },
        data: {
          progress,
          completedAt: progress === 100 ? current.completedAt ?? new Date() : null,
        },
      })
    );
  } catch (error) {
    console.error("setStudyGoalProgress failed", error);
    return { ok: false, error: "unavailable" };
  }

  revalidatePath(PAGE);
  return { ok: true };
}

export async function deleteStudyGoal(id: number): Promise<StudyGoalActionResult> {
  const studentId = currentStudentId();
  if (!studentId) return { ok: false, error: "unauthorized" };
  if (!Number.isInteger(id)) return { ok: false, error: "invalid" };

  try {
    const result = await withStudyGoalTable(() =>
      prisma.studyGoal.deleteMany({ where: { id, studentId } })
    );
    if (result.count === 0) return { ok: false, error: "notFound" };
  } catch (error) {
    console.error("deleteStudyGoal failed", error);
    return { ok: false, error: "unavailable" };
  }

  revalidatePath(PAGE);
  return { ok: true };
}
