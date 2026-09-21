"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { getUserRole } from "./auth";
import { applyLessonTimeRepair, undoLessonTimeRepair } from "./lessonTimeRepair";

export type LessonTimeRepairResult =
  | { ok: true; count: number }
  | { ok: false; error: "unauthorized" | "failed" };

const isAdmin = () => {
  const { userId, sessionClaims } = auth();
  return Boolean(userId) && getUserRole(sessionClaims) === "admin";
};

// Timetables are read on many pages (admin lessons, student and teacher
// schedules, dashboards); refresh them all after the times change.
const refresh = () => {
  revalidatePath("/dashboard", "layout");
};

export async function applyLessonTimeRepairAction(): Promise<LessonTimeRepairResult> {
  if (!isAdmin()) return { ok: false, error: "unauthorized" };
  try {
    const count = await applyLessonTimeRepair();
    refresh();
    return { ok: true, count };
  } catch (error) {
    console.error("Lesson time repair failed", error);
    return { ok: false, error: "failed" };
  }
}

export async function undoLessonTimeRepairAction(): Promise<LessonTimeRepairResult> {
  if (!isAdmin()) return { ok: false, error: "unauthorized" };
  try {
    const count = await undoLessonTimeRepair();
    refresh();
    return { ok: true, count };
  } catch (error) {
    console.error("Lesson time repair undo failed", error);
    return { ok: false, error: "failed" };
  }
}
