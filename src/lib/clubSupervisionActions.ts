"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { getTranslations } from "next-intl/server";
import prisma from "@/lib/prisma";
import { getUserRole } from "@/lib/auth";
import { notifyUser } from "@/lib/notify";
import { canSuperviseClub, ensureClubSupervision } from "@/lib/clubSupervision";
import type { UniformStatus } from "@/generated/prisma/client";
import {
  UNIFORM_ITEM_KEYS,
  UNIFORM_STATUSES,
  addDays,
  isValidDateStr,
  schoolToday,
  toDbDate,
} from "@/lib/uniform";

type TFn = (key: string, values?: Record<string, string | number>) => string;

export type RegisterResult = {
  ok: boolean;
  error?: string;
  added?: number;
  waitlisted?: number;
  alreadyIn?: number;
  removed?: number;
};

async function requireClubAccess(clubId: number) {
  const { userId, sessionClaims } = await auth();
  if (!userId) return null;
  const role = getUserRole(sessionClaims);
  if (!(await canSuperviseClub(role, userId, clubId))) return null;
  return { userId, role };
}

// Registers any number of students (from any grade / class) into a club in one
// go. Only an admin or one of the club's supervisors may do this. Seats up to
// the club's capacity are ACTIVE; everyone after that joins the waitlist, the
// same rule as self-service enrolment.
export async function registerStudentsInClub(
  clubId: number,
  studentIds: string[]
): Promise<RegisterResult> {
  const t = (await getTranslations("List.clubRegister.errors")) as unknown as TFn;
  if (!Number.isInteger(clubId)) return { ok: false, error: t("invalid") };
  const access = await requireClubAccess(clubId);
  if (!access) return { ok: false, error: t("notAllowed") };

  const ids = Array.from(new Set((studentIds ?? []).filter((s) => typeof s === "string" && s)));
  if (ids.length === 0) return { ok: false, error: t("nothingSelected") };

  try {
    const club = await prisma.club.findUnique({
      where: { id: clubId },
      select: { capacity: true },
    });
    if (!club) return { ok: false, error: t("clubNotFound") };

    const students = await prisma.student.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    const validIds = new Set(students.map((s) => s.id));

    let added = 0;
    let waitlisted = 0;
    let alreadyIn = 0;

    await prisma.$transaction(async (tx) => {
      let active = await tx.clubEnrollment.count({ where: { clubId, status: "ACTIVE" } });
      const existing = await tx.clubEnrollment.findMany({
        where: { clubId, studentId: { in: Array.from(validIds) } },
        select: { id: true, studentId: true, status: true },
      });
      const byStudent = new Map(existing.map((e) => [e.studentId, e]));

      for (const studentId of Array.from(validIds)) {
        const current = byStudent.get(studentId);
        if (current && current.status !== "WITHDRAWN") {
          alreadyIn += 1;
          continue;
        }
        const status = active < club.capacity ? "ACTIVE" : "WAITLISTED";
        if (status === "ACTIVE") {
          active += 1;
          added += 1;
        } else {
          waitlisted += 1;
        }
        if (current) {
          await tx.clubEnrollment.update({
            where: { id: current.id },
            data: { status, enrolledAt: new Date() },
          });
        } else {
          await tx.clubEnrollment.create({ data: { clubId, studentId, status } });
        }
      }
    });

    revalidatePath("/dashboard/list/clubs");
    revalidatePath("/dashboard/list/clubs/register");
    revalidatePath("/dashboard/list/clubs/attendance");
    return { ok: true, added, waitlisted, alreadyIn };
  } catch (error) {
    console.error("[clubs] register students failed", error);
    return { ok: false, error: t("failed") };
  }
}

// Removes students from a club and promotes the waitlist into any freed seats.
export async function removeStudentsFromClub(
  clubId: number,
  studentIds: string[]
): Promise<RegisterResult> {
  const t = (await getTranslations("List.clubRegister.errors")) as unknown as TFn;
  if (!Number.isInteger(clubId)) return { ok: false, error: t("invalid") };
  const access = await requireClubAccess(clubId);
  if (!access) return { ok: false, error: t("notAllowed") };

  const ids = Array.from(new Set((studentIds ?? []).filter((s) => typeof s === "string" && s)));
  if (ids.length === 0) return { ok: false, error: t("nothingSelected") };

  try {
    let removed = 0;
    await prisma.$transaction(async (tx) => {
      const club = await tx.club.findUnique({ where: { id: clubId }, select: { capacity: true } });
      if (!club) return;
      const result = await tx.clubEnrollment.updateMany({
        where: { clubId, studentId: { in: ids }, status: { not: "WITHDRAWN" } },
        data: { status: "WITHDRAWN" },
      });
      removed = result.count;

      const active = await tx.clubEnrollment.count({ where: { clubId, status: "ACTIVE" } });
      const free = club.capacity - active;
      if (free > 0) {
        const next = await tx.clubEnrollment.findMany({
          where: { clubId, status: "WAITLISTED" },
          orderBy: { enrolledAt: "asc" },
          take: free,
          select: { id: true },
        });
        if (next.length > 0) {
          await tx.clubEnrollment.updateMany({
            where: { id: { in: next.map((n) => n.id) } },
            data: { status: "ACTIVE" },
          });
        }
      }
    });

    revalidatePath("/dashboard/list/clubs");
    revalidatePath("/dashboard/list/clubs/register");
    revalidatePath("/dashboard/list/clubs/attendance");
    return { ok: true, removed };
  } catch (error) {
    console.error("[clubs] remove students failed", error);
    return { ok: false, error: t("failed") };
  }
}

export type ClubUniformEntry = {
  studentId: string;
  status: "FULL" | "PARTIAL" | "NONE";
  missingItems: string[];
  note?: string;
};

export type SaveClubUniformResult = { ok: boolean; error?: string; saved?: number };

const NOTIFY_LOCALES = ["kk", "ru", "en"] as const;

// Saves (creates or overwrites) one day's uniform check for a club's members.
// Only an admin or one of the club's supervisors may do this; supervisors can
// record today or the last 7 days only, so old records can't be rewritten.
export async function saveClubUniformChecks(
  clubId: number,
  date: string,
  entries: ClubUniformEntry[]
): Promise<SaveClubUniformResult> {
  const t = (await getTranslations("Uniform")) as unknown as TFn;
  const tc = (await getTranslations("List.clubUniform.errors")) as unknown as TFn;
  const { userId, sessionClaims } = await auth();
  if (!userId) return { ok: false, error: t("errors.notSignedIn") };
  const role = getUserRole(sessionClaims);

  if (!Number.isInteger(clubId) || !(await canSuperviseClub(role, userId, clubId))) {
    return { ok: false, error: tc("notSupervisor") };
  }
  if (!isValidDateStr(date)) return { ok: false, error: t("errors.invalidDate") };

  const today = schoolToday();
  if (date > today) return { ok: false, error: t("errors.future") };
  if (role === "teacher" && date < addDays(today, -7)) {
    return { ok: false, error: t("errors.tooOld") };
  }

  if (!(await ensureClubSupervision())) return { ok: false, error: tc("unavailable") };

  const club = await prisma.club.findUnique({
    where: { id: clubId },
    select: {
      name: true,
      enrollments: {
        where: { status: "ACTIVE" },
        select: { student: { select: { id: true, name: true, surname: true, parentId: true } } },
      },
    },
  });
  if (!club) return { ok: false, error: tc("clubNotFound") };

  const byId = new Map(club.enrollments.map((e) => [e.student.id, e.student]));
  const clean = entries.filter(
    (e) => byId.has(e.studentId) && (UNIFORM_STATUSES as readonly string[]).includes(e.status)
  );
  if (clean.length === 0) return { ok: false, error: t("errors.nothing") };

  const day = toDbDate(date);
  const checkedById = role === "teacher" ? userId : null;

  const previous = await prisma.clubUniformCheck.findMany({
    where: { clubId, date: day, studentId: { in: clean.map((e) => e.studentId) } },
    select: { studentId: true, status: true },
  });
  const previousStatus = new Map(previous.map((p) => [p.studentId, p.status as string]));

  const prepared = clean.map((e) => ({
    ...e,
    missingItems:
      e.status === "FULL"
        ? []
        : Array.from(new Set((e.missingItems ?? []).filter((k) => UNIFORM_ITEM_KEYS.includes(k)))),
    note: e.note ? e.note.trim().slice(0, 200) || null : null,
  }));

  try {
    await prisma.$transaction(
      prepared.map((e) => {
        const status = e.status as UniformStatus;
        return prisma.clubUniformCheck.upsert({
          where: { clubId_studentId_date: { clubId, studentId: e.studentId, date: day } },
          create: { clubId, studentId: e.studentId, date: day, status, missingItems: e.missingItems, note: e.note, checkedById },
          update: { status, missingItems: e.missingItems, note: e.note, ...(checkedById ? { checkedById } : {}) },
        });
      })
    );
  } catch (error) {
    console.error("[clubs] save club uniform failed", error);
    return { ok: false, error: tc("failed") };
  }

  // Tell parents about today's newly-recorded gaps (once per change), the same
  // way the class uniform check does. A notification problem never fails the save.
  if (date === today) {
    try {
      const toNotify = prepared.filter((e) => e.status !== "FULL" && previousStatus.get(e.studentId) !== e.status);
      const translators = await Promise.all(
        NOTIFY_LOCALES.map(async (locale) => (await getTranslations({ locale, namespace: "Uniform" })) as unknown as TFn)
      );
      await Promise.allSettled(
        toNotify.map((e) => {
          const student = byId.get(e.studentId)!;
          const name = student.name + " " + student.surname;
          const titles: string[] = [];
          const bodies: string[] = [];
          for (const tt of translators) {
            const items = e.missingItems.length
              ? tt("notify.missingSuffix", { items: e.missingItems.map((k) => tt("items." + k)).join(", ") })
              : "";
            titles.push(`${club.name}: ${tt("notify.title")}`);
            bodies.push(tt("notify.body", { student: name, date, status: tt("status." + e.status), items }));
          }
          return notifyUser(student.parentId, {
            title: Array.from(new Set(titles)).join(" / "),
            body: bodies.join("\n"),
            url: "/dashboard/list/uniform",
          });
        })
      );
    } catch {
      // ignore
    }
  }

  revalidatePath("/dashboard/list/clubs/uniform");
  return { ok: true, saved: clean.length };
}
