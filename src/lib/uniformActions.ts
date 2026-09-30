"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { getTranslations } from "next-intl/server";
import prisma from "@/lib/prisma";
import { getUserRole } from "@/lib/auth";
import { notifyUser } from "@/lib/notify";
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

type TFn = (key: string, values?: Record<string, string | number>) => string;

// Languages a parent notification is written in (the parent's own language
// is not stored, so the message carries all three).
const NOTIFY_LOCALES = ["kk", "ru", "en"] as const;

// Saves (creates or overwrites) one day's uniform check for a whole class.
// Only the class supervisor - or an admin - may do this, and supervisors can
// only record today or the last 7 days so old records can't be rewritten.
// When today's check newly marks a student as not in full uniform, the
// student's parent is notified (push + email).
export async function saveUniformChecks(
  classId: number,
  date: string,
  entries: UniformEntry[]
): Promise<SaveUniformResult> {
  const t = (await getTranslations("Uniform")) as unknown as TFn;
  const { userId, sessionClaims } = await auth();
  if (!userId) return { ok: false, error: t("errors.notSignedIn") };

  const role = getUserRole(sessionClaims);
  if (role !== "admin" && role !== "teacher") {
    return { ok: false, error: t("errors.notAllowed") };
  }
  if (!isValidDateStr(date)) return { ok: false, error: t("errors.invalidDate") };

  const today = schoolToday();
  if (date > today) return { ok: false, error: t("errors.future") };
  if (role === "teacher" && date < addDays(today, -7)) {
    return { ok: false, error: t("errors.tooOld") };
  }

  const cls = await prisma.class.findUnique({
    where: { id: classId },
    select: {
      supervisorId: true,
      students: { select: { id: true, name: true, surname: true, parentId: true } },
    },
  });
  if (!cls) return { ok: false, error: t("errors.classNotFound") };
  if (role === "teacher" && cls.supervisorId !== userId) {
    return { ok: false, error: t("errors.notSupervisor") };
  }

  const byId = new Map(cls.students.map((s) => [s.id, s]));
  const clean = entries.filter(
    (e) => byId.has(e.studentId) && (UNIFORM_STATUSES as readonly string[]).includes(e.status)
  );
  if (clean.length === 0) return { ok: false, error: t("errors.nothing") };

  const day = toDbDate(date);
  const checkedById = role === "teacher" ? userId : null;

  const previous = await prisma.uniformCheck.findMany({
    where: { classId, date: day, studentId: { in: clean.map((e) => e.studentId) } },
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

  await prisma.$transaction(
    prepared.map((e) => {
      const status = e.status as UniformStatus;
      return prisma.uniformCheck.upsert({
        where: { studentId_date: { studentId: e.studentId, date: day } },
        create: { studentId: e.studentId, classId, date: day, status, missingItems: e.missingItems, note: e.note, checkedById },
        update: { status, missingItems: e.missingItems, note: e.note, classId, ...(checkedById ? { checkedById } : {}) },
      });
    })
  );

  // Notify parents only for today's check, and only when the student is newly
  // (or differently) marked as not in full uniform - re-saving does not repeat it.
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
            titles.push(tt("notify.title"));
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
      // A notification problem must never make the save itself fail.
    }
  }

  revalidatePath("/dashboard/list/uniform");
  return { ok: true, saved: clean.length };
}
