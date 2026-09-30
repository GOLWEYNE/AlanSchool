"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { getUserRole } from "@/lib/auth";
import type { UniformStatus } from "@/generated/prisma/client";
import {
  UNIFORM_ITEM_KEYS,
  UNIFORM_STATUSES,
  addDays,
  isValidDateStr,
  schoolToday,
  toDbDate,
} from "@/lib/uniform";

export type UniformEntry = {
  studentId: string;
  status: "FULL" | "PARTIAL" | "NONE";
  missingItems: string[];
  note?: string;
};

export type SaveUniformResult = { ok: boolean; error?: string; saved?: number };

// Saves (creates or overwrites) one day's uniform check for a whole class.
// Only the class supervisor - or an admin - may do this, and supervisors can
// only record today or the last 7 days so old records can't be rewritten.
export async function saveUniformChecks(
  classId: number,
  date: string,
  entries: UniformEntry[]
): Promise<SaveUniformResult> {
  const { userId, sessionClaims } = await auth();
  if (!userId) return { ok: false, error: "You are not signed in." };

  const role = getUserRole(sessionClaims);
  if (role !== "admin" && role !== "teacher") {
    return { ok: false, error: "You are not allowed to record uniform checks." };
  }
  if (!isValidDateStr(date)) return { ok: false, error: "Invalid date." };

  const today = schoolToday();
  if (date > today) return { ok: false, error: "You cannot check uniform for a future date." };
  if (role === "teacher" && date < addDays(today, -7)) {
    return { ok: false, error: "Supervisors can only edit the last 7 days." };
  }

  const cls = await prisma.class.findUnique({
    where: { id: classId },
    select: { supervisorId: true, students: { select: { id: true } } },
  });
  if (!cls) return { ok: false, error: "Class not found." };
  if (role === "teacher" && cls.supervisorId !== userId) {
    return { ok: false, error: "Only the class supervisor can record uniform for this class." };
  }

  const allowed = new Set(cls.students.map((s) => s.id));
  const clean = entries.filter(
    (e) => allowed.has(e.studentId) && (UNIFORM_STATUSES as readonly string[]).includes(e.status)
  );
  if (clean.length === 0) return { ok: false, error: "Nothing to save." };

  const day = toDbDate(date);
  const checkedById = role === "teacher" ? userId : null;

  await prisma.$transaction(
    clean.map((e) => {
      const missingItems =
        e.status === "FULL"
          ? []
          : Array.from(new Set((e.missingItems ?? []).filter((k) => UNIFORM_ITEM_KEYS.includes(k))));
      const note = e.note ? e.note.trim().slice(0, 200) || null : null;
      const status = e.status as UniformStatus;
      return prisma.uniformCheck.upsert({
        where: { studentId_date: { studentId: e.studentId, date: day } },
        create: { studentId: e.studentId, classId, date: day, status, missingItems, note, checkedById },
        update: { status, missingItems, note, classId, ...(checkedById ? { checkedById } : {}) },
      });
    })
  );

  revalidatePath("/dashboard/list/uniform");
  return { ok: true, saved: clean.length };
}
