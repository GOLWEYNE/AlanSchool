"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { getUserRole } from "@/lib/auth";
import {
  applyScheduleRows,
  autoMatchTeachers,
  defaultScheduleRows,
  ensureDuty,
  isValidTimeZone,
  parseDutyImport,
  sendTestDutyNotification,
  type ImportRow,
} from "@/lib/duty";

export type ActionResult = { ok: boolean; message?: string; errors?: string[] };

const PAGE = "/dashboard/list/duty-roster";

// Every admin action re-checks the role on the server - hiding the page is not enough.
async function requireAdmin(): Promise<{ userId: string } | null> {
  const { userId, sessionClaims } = auth();
  if (!userId || getUserRole(sessionClaims) !== "admin") return null;
  await ensureDuty();
  return { userId };
}

const DENIED: ActionResult = { ok: false, message: "Admins only." };
const done = (message: string): ActionResult => {
  revalidatePath(PAGE);
  return { ok: true, message };
};

export async function setSlotTeachers(slotId: number, dutyTeacherIds: number[]): Promise<ActionResult> {
  if (!(await requireAdmin())) return DENIED;
  const ids = Array.from(new Set(dutyTeacherIds.filter((n) => Number.isInteger(n))));
  if (ids.length > 2) return { ok: false, message: "At most 2 teachers per slot." };
  const slot = await prisma.dutySlot.findUnique({ where: { id: slotId }, select: { id: true } });
  if (!slot) return { ok: false, message: "Slot not found." };
  await prisma.$transaction([
    prisma.dutyAssignment.deleteMany({ where: { slotId, dutyTeacherId: { notIn: ids } } }),
    prisma.dutyAssignment.createMany({ data: ids.map((dutyTeacherId) => ({ slotId, dutyTeacherId })), skipDuplicates: true }),
  ]);
  return done("Saved.");
}

export async function importSchedule(text: string, format: "csv" | "json", mode: "replace" | "merge"): Promise<ActionResult> {
  if (!(await requireAdmin())) return DENIED;
  const { rows, errors } = parseDutyImport(text, format);
  if (errors.length) return { ok: false, message: "Nothing imported - fix these rows first.", errors: errors.slice(0, 20) };
  if (!rows.length) return { ok: false, message: "The file has no rows." };
  const r = await applyScheduleRows(rows as ImportRow[], mode);
  return done(`Imported ${r.slots} slots, ${r.assignments} assignments, ${r.teachers} teachers.`);
}

export async function loadDefaultSchedule(mode: "replace" | "merge"): Promise<ActionResult> {
  if (!(await requireAdmin())) return DENIED;
  const r = await applyScheduleRows(defaultScheduleRows(), mode);
  return done(`Loaded the built-in schedule: ${r.slots} slots, ${r.assignments} assignments, ${r.teachers} teachers.`);
}

export async function linkDutyTeacher(dutyTeacherId: number, teacherId: string | null): Promise<ActionResult> {
  if (!(await requireAdmin())) return DENIED;
  if (teacherId) {
    const [account, taken] = await Promise.all([
      prisma.teacher.findUnique({ where: { id: teacherId }, select: { id: true } }),
      prisma.dutyTeacher.findFirst({ where: { teacherId, NOT: { id: dutyTeacherId } }, select: { nameEn: true } }),
    ]);
    if (!account) return { ok: false, message: "Account not found." };
    if (taken) return { ok: false, message: `That account is already linked to "${taken.nameEn}".` };
  }
  await prisma.dutyTeacher.update({ where: { id: dutyTeacherId }, data: { teacherId } });
  return done(teacherId ? "Linked." : "Unlinked.");
}

export async function autoLinkTeachers(): Promise<ActionResult> {
  if (!(await requireAdmin())) return DENIED;
  const r = await autoMatchTeachers();
  return done(`Linked ${r.matched}. ${r.ambiguous} had several possible accounts and ${r.unmatched} had none - link those by hand.`);
}

export async function renameDutyTeacher(dutyTeacherId: number, nameEn: string, nameOriginal: string): Promise<ActionResult> {
  if (!(await requireAdmin())) return DENIED;
  const name = nameEn.trim();
  if (!name) return { ok: false, message: "Name is required." };
  const clash = await prisma.dutyTeacher.findFirst({ where: { nameEn: name, NOT: { id: dutyTeacherId } }, select: { id: true } });
  if (clash) return { ok: false, message: "Another person already has that name - use Merge instead." };
  await prisma.dutyTeacher.update({ where: { id: dutyTeacherId }, data: { nameEn: name, nameOriginal: nameOriginal.trim() || null } });
  return done("Saved.");
}

// Moves every duty from `fromId` onto `intoId` (for names spelled two ways), then deletes `fromId`.
export async function mergeDutyTeachers(fromId: number, intoId: number): Promise<ActionResult> {
  if (!(await requireAdmin())) return DENIED;
  if (fromId === intoId) return { ok: false, message: "Pick two different names." };
  const [from, into] = await Promise.all([
    prisma.dutyTeacher.findUnique({ where: { id: fromId } }),
    prisma.dutyTeacher.findUnique({ where: { id: intoId } }),
  ]);
  if (!from || !into) return { ok: false, message: "Teacher not found." };
  const intoSlots = await prisma.dutyAssignment.findMany({ where: { dutyTeacherId: intoId }, select: { slotId: true } });
  const have = new Set(intoSlots.map((a) => a.slotId));
  const moving = await prisma.dutyAssignment.findMany({ where: { dutyTeacherId: fromId }, select: { id: true, slotId: true } });
  await prisma.$transaction([
    ...moving.filter((a) => !have.has(a.slotId)).map((a) => prisma.dutyAssignment.update({ where: { id: a.id }, data: { dutyTeacherId: intoId } })),
    prisma.dutyAssignment.deleteMany({ where: { dutyTeacherId: fromId } }),
    // keep the account link if only the removed name had one
    ...(from.teacherId && !into.teacherId
      ? [prisma.dutyTeacher.update({ where: { id: fromId }, data: { teacherId: null } }), prisma.dutyTeacher.update({ where: { id: intoId }, data: { teacherId: from.teacherId } })]
      : []),
    prisma.dutyTeacher.delete({ where: { id: fromId } }),
  ]);
  return done(`Merged "${from.nameEn}" into "${into.nameEn}".`);
}

export async function saveDutySettings(input: { enabled: boolean; leadMinutes: number; notifyAtStart: boolean; timeZone: string }): Promise<ActionResult> {
  if (!(await requireAdmin())) return DENIED;
  const lead = Math.round(Number(input.leadMinutes));
  if (!Number.isFinite(lead) || lead < 0 || lead > 120) return { ok: false, message: "Lead time must be 0-120 minutes." };
  if (!isValidTimeZone(input.timeZone)) return { ok: false, message: "Unknown time zone (use a name like Asia/Almaty)." };
  const data = { enabled: !!input.enabled, leadMinutes: lead, notifyAtStart: !!input.notifyAtStart, timeZone: input.timeZone };
  await prisma.dutySettings.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
  return done("Settings saved.");
}

export async function addDayOff(date: string, reason: string): Promise<ActionResult> {
  if (!(await requireAdmin())) return DENIED;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, message: "Pick a date." };
  await prisma.dutyDayOff.upsert({ where: { date }, update: { reason: reason.trim() || null }, create: { date, reason: reason.trim() || null } });
  return done("Day off added.");
}

export async function removeDayOff(date: string): Promise<ActionResult> {
  if (!(await requireAdmin())) return DENIED;
  await prisma.dutyDayOff.deleteMany({ where: { date } });
  return done("Day off removed.");
}

export async function sendTestNotification(): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return DENIED;
  const r = await sendTestDutyNotification(admin.userId);
  const pushCount = await prisma.pushSubscription.count({ where: { userId: admin.userId } });
  return {
    ok: true,
    message:
      `Sent to your account via ${r.channels.join(" + ") || "nothing"}: "${r.body}". ` +
      (pushCount ? "" : "No browser is subscribed for push on your account yet - click the bell-with-dot button in the top bar first. "),
  };
}

// --- any signed-in user: their own channel preferences ----------------------

export async function saveMyDutyPrefs(input: { inApp: boolean; push: boolean; email: boolean }): Promise<ActionResult> {
  const { userId } = auth();
  if (!userId) return { ok: false, message: "Please sign in." };
  await ensureDuty();
  const data = { inApp: !!input.inApp, push: !!input.push, email: !!input.email };
  await prisma.dutyPreference.upsert({ where: { userId }, update: data, create: { userId, ...data } });
  revalidatePath("/dashboard/list/my-duties");
  return { ok: true, message: "Saved." };
}

export async function markDutyNotificationRead(id: number): Promise<ActionResult> {
  const { userId } = auth();
  if (!userId) return { ok: false };
  // userId is part of the filter so nobody can mark someone else's rows.
  await prisma.dutyNotificationLog.updateMany({ where: { id, userId }, data: { readAt: new Date() } });
  return { ok: true };
}
