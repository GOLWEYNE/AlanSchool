"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { getUserRole } from "./auth";
import { findMissingClerkIds } from "./clerkSync";
import { deleteStudentCascade, deleteTeacherCascade } from "./purge";

export type RemoveOrphansResult = {
  removed: number;
  failed: number;
  error: boolean;
};

const MAX_PER_RUN = 500;

// Removes the selected student/teacher records whose Clerk account is gone.
// `keys` look like "student:<id>" / "teacher:<id>". Admin-only, and the list
// is re-checked against Clerk at the moment of deletion - a stale page, or a
// hand-crafted request, can never delete someone who still has an account.
export async function removeOrphanRecords(
  keys: string[]
): Promise<RemoveOrphansResult> {
  const { userId, sessionClaims } = auth();
  if (!userId || getUserRole(sessionClaims) !== "admin") {
    return { removed: 0, failed: keys.length, error: true };
  }

  const picked = keys.slice(0, MAX_PER_RUN);
  const students = picked
    .filter((k) => k.startsWith("student:"))
    .map((k) => k.slice("student:".length));
  const teachers = picked
    .filter((k) => k.startsWith("teacher:"))
    .map((k) => k.slice("teacher:".length));

  let missing: Set<string>;
  try {
    missing = await findMissingClerkIds([...students, ...teachers]);
  } catch (err) {
    console.log("removeOrphanRecords: could not check Clerk:", err);
    return { removed: 0, failed: picked.length, error: true };
  }

  let removed = 0;
  let failed = 0;

  for (const id of students) {
    if (!missing.has(id)) {
      failed++;
      continue;
    }
    try {
      await deleteStudentCascade(id);
      removed++;
    } catch (err) {
      console.log("removeOrphanRecords: student", id, err);
      failed++;
    }
  }

  for (const id of teachers) {
    if (!missing.has(id)) {
      failed++;
      continue;
    }
    try {
      await deleteTeacherCascade(id);
      removed++;
    } catch (err) {
      console.log("removeOrphanRecords: teacher", id, err);
      failed++;
    }
  }

  revalidatePath("/dashboard/list/clerk-sync");
  revalidatePath("/dashboard/list/students");
  revalidatePath("/dashboard/list/teachers");

  return { removed, failed, error: false };
}
