"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getUserRole } from "@/lib/auth";
import { teacherCanAccessClass } from "@/lib/teacherScope";
import {
  LOCK_NS_DESTINATION,
  LOCK_NS_GROUP,
  MAX_MINUTES_LIMIT,
  closeStalePasses,
  ensureHallPass,
} from "@/lib/hallPass";

type TFn = (key: string, values?: Record<string, string | number>) => string;

export type PassResult = { ok: boolean; error?: string };
export type RequestPassResult = PassResult & { passId?: number };
export type StudentHit = { id: string; name: string; username: string; className: string };

const HALL_PASS_PATH = "/dashboard/list/hall-pass";

const translator = async () => (await getTranslations("HallPass")) as unknown as TFn;

async function caller() {
  const { userId, sessionClaims } = await auth();
  return { userId, role: userId ? getUserRole(sessionClaims) : "" };
}

// A Prisma unique-violation, either as a typed error or as the raw Postgres message
// (our one-active-pass-per-student rule is a partial index Prisma doesn't know about).
const isUniqueViolation = (error: unknown) => {
  const e = error as { code?: string; message?: string } | null;
  return e?.code === "P2002" || /HallPass_one_active_per_student|duplicate key/i.test(e?.message ?? "");
};

// ---------------------------------------------------------------------------
// Students: request / end a pass
// ---------------------------------------------------------------------------

// Opens a pass for the signed-in student. All checks and the insert run in one
// transaction guarded by advisory locks (one per restricted group and one for the
// destination), so two members of a restricted group - or two students racing for
// the last place at a destination - can never both get through.
export async function requestPass(destinationId: number): Promise<RequestPassResult> {
  const t = await translator();
  const { userId, role } = await caller();
  if (!userId) return { ok: false, error: t("errors.notSignedIn") };
  if (role !== "student") return { ok: false, error: t("errors.studentsOnly") };
  if (!Number.isInteger(destinationId)) return { ok: false, error: t("errors.destinationInvalid") };
  if (!(await ensureHallPass())) return { ok: false, error: t("errors.unavailable") };
  await closeStalePasses();

  const student = await prisma.student.findUnique({
    where: { id: userId },
    select: { classId: true, grade: { select: { level: true } } },
  });
  if (!student) return { ok: false, error: t("errors.studentNotFound") };

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Groups first (ascending), then the destination - the same order every time,
      // so concurrent requests cannot deadlock each other.
      const groups = await tx.groupMember.findMany({
        where: { studentId: userId, group: { active: true } },
        select: { groupId: true },
        orderBy: { groupId: "asc" },
      });
      for (const g of groups) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NS_GROUP}::int, ${g.groupId}::int)`;
      }
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NS_DESTINATION}::int, ${destinationId}::int)`;

      const destination = await tx.passDestination.findUnique({ where: { id: destinationId } });
      if (!destination || !destination.active) return { ok: false as const, error: "destinationInactive" };

      const alreadyOut = await tx.hallPass.findFirst({
        where: { studentId: userId, status: "ACTIVE" },
        select: { id: true },
      });
      if (alreadyOut) return { ok: false as const, error: "alreadyOut" };

      if (destination.maxConcurrent !== null) {
        const there = await tx.hallPass.count({ where: { destinationId, status: "ACTIVE" } });
        if (there >= destination.maxConcurrent) return { ok: false as const, error: "destinationFull" };
      }

      if (groups.length > 0) {
        const blocking = await tx.hallPass.findFirst({
          where: {
            status: "ACTIVE",
            studentId: { not: userId },
            student: { groupMemberships: { some: { groupId: { in: groups.map((g) => g.groupId) } } } },
          },
          select: { id: true },
        });
        if (blocking) return { ok: false as const, error: "groupBusy" };
      }

      const pass = await tx.hallPass.create({
        data: {
          studentId: userId,
          destinationId,
          classId: student.classId,
          gradeLevel: student.grade.level,
          maxMinutes: destination.maxMinutes,
        },
        select: { id: true },
      });
      return { ok: true as const, passId: pass.id };
    });

    if (!result.ok) return { ok: false, error: t("errors." + result.error) };
    revalidatePath(HALL_PASS_PATH);
    return { ok: true, passId: result.passId };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: t("errors.alreadyOut") };
    console.error("[hallPass] requestPass failed", error);
    return { ok: false, error: t("errors.generic") };
  }
}

// Ends a pass. A student may end their own; an admin any; a teacher the passes of
// students in their own classes.
export async function endPass(passId: number): Promise<PassResult> {
  const t = await translator();
  const { userId, role } = await caller();
  if (!userId) return { ok: false, error: t("errors.notSignedIn") };
  if (role !== "student" && role !== "teacher" && role !== "admin") {
    return { ok: false, error: t("errors.notAllowed") };
  }
  if (!Number.isInteger(passId)) return { ok: false, error: t("errors.passNotFound") };
  if (!(await ensureHallPass())) return { ok: false, error: t("errors.unavailable") };

  const pass = await prisma.hallPass.findUnique({
    where: { id: passId },
    select: { studentId: true, classId: true, status: true },
  });
  if (!pass) return { ok: false, error: t("errors.passNotFound") };

  if (role === "student" && pass.studentId !== userId) return { ok: false, error: t("errors.notAllowed") };
  if (role === "teacher" && !(await teacherCanAccessClass(userId, pass.classId))) {
    return { ok: false, error: t("errors.notAllowed") };
  }

  // Only an ACTIVE pass can be ended, and only once (a double tap is harmless).
  const done = await prisma.hallPass.updateMany({
    where: { id: passId, status: "ACTIVE" },
    data: { status: "RETURNED", returnedAt: new Date(), endedById: userId, endedByRole: role },
  });
  if (done.count === 0) return { ok: false, error: t("errors.alreadyEnded") };

  revalidatePath(HALL_PASS_PATH);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Admin: destinations
// ---------------------------------------------------------------------------
const destinationSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(1).max(60),
  maxMinutes: z.number().int().min(1).max(MAX_MINUTES_LIMIT),
  maxConcurrent: z.number().int().min(1).max(100).nullable(),
  active: z.boolean(),
  sortOrder: z.number().int().min(0).max(999),
});

export type DestinationInput = z.input<typeof destinationSchema>;

async function adminGuard(): Promise<{ t: TFn; error?: string }> {
  const t = await translator();
  const { userId, role } = await caller();
  if (!userId) return { t, error: t("errors.notSignedIn") };
  if (role !== "admin") return { t, error: t("errors.adminOnly") };
  if (!(await ensureHallPass())) return { t, error: t("errors.unavailable") };
  return { t };
}

export async function saveDestination(input: DestinationInput): Promise<PassResult> {
  const { t, error } = await adminGuard();
  if (error) return { ok: false, error };
  const parsed = destinationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: t("errors.invalidInput") };
  const { id, ...data } = parsed.data;

  try {
    if (id) {
      await prisma.passDestination.update({ where: { id }, data });
    } else {
      await prisma.passDestination.create({ data });
    }
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, error: t("errors.nameTaken") };
    console.error("[hallPass] saveDestination failed", e);
    return { ok: false, error: t("errors.generic") };
  }
  revalidatePath(HALL_PASS_PATH, "layout");
  return { ok: true };
}

export async function setDestinationActive(id: number, active: boolean): Promise<PassResult> {
  const { t, error } = await adminGuard();
  if (error) return { ok: false, error };
  try {
    await prisma.passDestination.update({ where: { id }, data: { active } });
  } catch {
    return { ok: false, error: t("errors.generic") };
  }
  revalidatePath(HALL_PASS_PATH, "layout");
  return { ok: true };
}

// A destination that already appears in the history cannot be deleted (the log
// must stay intact) - it can be switched off instead.
export async function deleteDestination(id: number): Promise<PassResult> {
  const { t, error } = await adminGuard();
  if (error) return { ok: false, error };
  const used = await prisma.hallPass.count({ where: { destinationId: id } });
  if (used > 0) return { ok: false, error: t("errors.destinationInUse") };
  try {
    await prisma.passDestination.delete({ where: { id } });
  } catch {
    return { ok: false, error: t("errors.generic") };
  }
  revalidatePath(HALL_PASS_PATH, "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Admin: restricted groups
// ---------------------------------------------------------------------------
const groupSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(1).max(60),
  note: z.string().trim().max(200).nullable().optional(),
  active: z.boolean(),
});

export type GroupInput = z.input<typeof groupSchema>;

export async function saveGroup(input: GroupInput): Promise<PassResult & { id?: number }> {
  const { t, error } = await adminGuard();
  if (error) return { ok: false, error };
  const parsed = groupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: t("errors.invalidInput") };
  const { id, ...rest } = parsed.data;
  const data = { name: rest.name, note: rest.note || null, active: rest.active };

  try {
    const saved = id
      ? await prisma.restrictedGroup.update({ where: { id }, data })
      : await prisma.restrictedGroup.create({ data });
    revalidatePath(HALL_PASS_PATH, "layout");
    return { ok: true, id: saved.id };
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, error: t("errors.nameTaken") };
    console.error("[hallPass] saveGroup failed", e);
    return { ok: false, error: t("errors.generic") };
  }
}

export async function setGroupActive(id: number, active: boolean): Promise<PassResult> {
  const { t, error } = await adminGuard();
  if (error) return { ok: false, error };
  try {
    await prisma.restrictedGroup.update({ where: { id }, data: { active } });
  } catch {
    return { ok: false, error: t("errors.generic") };
  }
  revalidatePath(HALL_PASS_PATH, "layout");
  return { ok: true };
}

export async function deleteGroup(id: number): Promise<PassResult> {
  const { t, error } = await adminGuard();
  if (error) return { ok: false, error };
  try {
    await prisma.restrictedGroup.delete({ where: { id } });
  } catch {
    return { ok: false, error: t("errors.generic") };
  }
  revalidatePath(HALL_PASS_PATH, "layout");
  return { ok: true };
}

export async function addGroupMember(groupId: number, studentId: string): Promise<PassResult> {
  const { t, error } = await adminGuard();
  if (error) return { ok: false, error };
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true } });
  if (!student) return { ok: false, error: t("errors.studentNotFound") };
  try {
    await prisma.groupMember.create({ data: { groupId, studentId } });
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, error: t("errors.alreadyMember") };
    return { ok: false, error: t("errors.generic") };
  }
  revalidatePath(HALL_PASS_PATH, "layout");
  return { ok: true };
}

export async function removeGroupMember(groupId: number, studentId: string): Promise<PassResult> {
  const { t, error } = await adminGuard();
  if (error) return { ok: false, error };
  await prisma.groupMember.deleteMany({ where: { groupId, studentId } });
  revalidatePath(HALL_PASS_PATH, "layout");
  return { ok: true };
}

// Name / username search used by the "add student to group" picker (admins only).
export async function searchStudentsForGroup(query: string): Promise<StudentHit[]> {
  const { userId, role } = await caller();
  if (!userId || role !== "admin") return [];
  const tokens = query.trim().split(/\s+/).filter(Boolean).slice(0, 3);
  if (tokens.length === 0) return [];
  const rows = await prisma.student.findMany({
    where: {
      AND: tokens.map((token) => ({
        OR: [
          { name: { contains: token, mode: "insensitive" as const } },
          { surname: { contains: token, mode: "insensitive" as const } },
          { username: { contains: token, mode: "insensitive" as const } },
        ],
      })),
    },
    orderBy: [{ surname: "asc" }, { name: "asc" }],
    take: 12,
    select: { id: true, name: true, surname: true, username: true, class: { select: { name: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    name: `${r.name} ${r.surname}`,
    username: r.username,
    className: r.class.name,
  }));
}
