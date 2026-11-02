"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { getUserRole } from "@/lib/auth";
import { teacherCanAccessStudent } from "@/lib/teacherScope";
import { ensureOlympiads, isLevel, isResult } from "@/lib/olympiads";

// Only an admin, or a teacher whose class the student is in, may edit olympiad records.
async function canEdit(studentId: string): Promise<boolean> {
  const { userId, sessionClaims } = auth();
  if (!userId) return false;
  const role = getUserRole(sessionClaims);
  if (role === "admin") return true;
  if (role === "teacher") return teacherCanAccessStudent(userId, studentId);
  return false;
}

const text = (value: FormDataEntryValue | null, max: number): string =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

export async function addOlympiad(formData: FormData): Promise<void> {
  const studentId = text(formData.get("studentId"), 100);
  const name = text(formData.get("name"), 160);
  const subject = text(formData.get("subject"), 80);
  const level = text(formData.get("level"), 20);
  const result = text(formData.get("result"), 20);
  const heldOnRaw = text(formData.get("heldOn"), 10);
  const note = text(formData.get("note"), 300);

  if (!studentId || name.length < 2 || !isLevel(level) || !isResult(result)) return;
  if (!(await canEdit(studentId))) return;
  if (!(await ensureOlympiads())) return;

  const heldOn = /^\d{4}-\d{2}-\d{2}$/.test(heldOnRaw) ? heldOnRaw : null;

  await prisma.$executeRaw`
    INSERT INTO "StudentOlympiad" ("studentId", "name", "subject", "level", "result", "heldOn", "note")
    VALUES (${studentId}, ${name}, ${subject || null}, ${level}, ${result}, ${heldOn}::date, ${note || null})
  `;
  revalidatePath(`/dashboard/list/student-insights/${studentId}`);
  revalidatePath("/dashboard/list/student-insights");
}

export async function deleteOlympiad(formData: FormData): Promise<void> {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;
  if (!(await ensureOlympiads())) return;

  const rows = await prisma.$queryRaw<{ studentId: string }[]>`
    SELECT "studentId" FROM "StudentOlympiad" WHERE "id" = ${id}
  `;
  const studentId = rows[0]?.studentId;
  if (!studentId || !(await canEdit(studentId))) return;

  await prisma.$executeRaw`DELETE FROM "StudentOlympiad" WHERE "id" = ${id}`;
  revalidatePath(`/dashboard/list/student-insights/${studentId}`);
  revalidatePath("/dashboard/list/student-insights");
}
