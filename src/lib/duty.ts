import prisma from "@/lib/prisma";
import { DUTY_DDL } from "@/lib/dutyDdl";
import { sendPushToUser } from "@/lib/push";
import { sendEmailToUser } from "@/lib/email";
import seed from "@/lib/dutySeed.json";
import {
  DEFAULT_DUTY_TIME_ZONE,
  DEFAULT_LEAD_MINUTES,
  buildDutyMessage,
  dueKinds,
  isValidTimeZone,
  schoolNow,
  splitDutyName,
  type DutyKind,
  type ImportRow,
} from "@/lib/dutyShared";

export * from "@/lib/dutyShared";

export const DUTY_URL = "/dashboard/list/my-duties";

// ---------------------------------------------------------------------------
// Table bootstrap - same idempotent approach as ensureHallPass(): the feature
// works right after deploy; `prisma migrate deploy` stays safe to run too.
// ---------------------------------------------------------------------------
let ready = false;
let pending: Promise<boolean> | null = null;
// After a failed bootstrap (e.g. the database user cannot CREATE TABLE) don't
// retry on every request - the navbar bell polls every 30 seconds.
let failedAt = 0;
const RETRY_AFTER_MS = 5 * 60 * 1000;

async function probeTables() {
  await prisma.dutyTeacher.count();
  await prisma.dutySlot.count();
  await prisma.dutyAssignment.count();
  await prisma.dutyNotificationLog.count();
  await prisma.dutyDayOff.count();
  await prisma.dutySettings.count();
  await prisma.dutyPreference.count();
}

async function prepareTables(): Promise<boolean> {
  try {
    await probeTables();
    return true;
  } catch {
    try {
      for (const statement of DUTY_DDL) {
        await prisma.$executeRawUnsafe(statement);
      }
      await probeTables();
      return true;
    } catch (error) {
      console.error("[duty] could not prepare tables", error);
      return false;
    }
  }
}

export async function ensureDuty(): Promise<boolean> {
  if (ready) return true;
  if (failedAt && Date.now() - failedAt < RETRY_AFTER_MS) return false;
  if (!pending) {
    pending = prepareTables().finally(() => {
      pending = null;
    });
  }
  const ok = await pending;
  if (ok) {
    ready = true;
    failedAt = 0;
  } else {
    failedAt = Date.now();
  }
  return ok;
}

// ---------------------------------------------------------------------------
// Settings and preferences
// ---------------------------------------------------------------------------
export type DutySettingsDTO = {
  enabled: boolean;
  leadMinutes: number;
  notifyAtStart: boolean;
  timeZone: string;
};

export async function getDutySettings(): Promise<DutySettingsDTO> {
  const row = await prisma.dutySettings.findUnique({ where: { id: 1 } });
  return {
    enabled: row?.enabled ?? true,
    leadMinutes: row?.leadMinutes ?? DEFAULT_LEAD_MINUTES,
    notifyAtStart: row?.notifyAtStart ?? true,
    timeZone: row?.timeZone && isValidTimeZone(row.timeZone) ? row.timeZone : DEFAULT_DUTY_TIME_ZONE,
  };
}

export type DutyPrefsDTO = { inApp: boolean; push: boolean; email: boolean };

export async function getDutyPrefs(userId: string): Promise<DutyPrefsDTO> {
  const row = await prisma.dutyPreference.findUnique({ where: { userId } });
  return { inApp: row?.inApp ?? true, push: row?.push ?? true, email: row?.email ?? false };
}

// ---------------------------------------------------------------------------
// Roster reads
// ---------------------------------------------------------------------------
export type RosterSlotDTO = {
  id: number;
  floor: number;
  weekday: number;
  block: string;
  startTime: string;
  endTime: string;
  teacherIds: number[];
};

export type DutyTeacherDTO = {
  id: number;
  nameEn: string;
  nameOriginal: string | null;
  teacherId: string | null;
  linkedName: string | null;
  dutyCount: number;
};

export async function getRoster(): Promise<{ slots: RosterSlotDTO[]; teachers: DutyTeacherDTO[] }> {
  const [slots, teachers] = await Promise.all([
    prisma.dutySlot.findMany({
      orderBy: [{ floor: "asc" }, { weekday: "asc" }, { startTime: "asc" }, { block: "asc" }],
      include: { assignments: { select: { dutyTeacherId: true }, orderBy: { id: "asc" } } },
    }),
    prisma.dutyTeacher.findMany({
      orderBy: { nameEn: "asc" },
      include: {
        teacher: { select: { name: true, surname: true } },
        _count: { select: { assignments: true } },
      },
    }),
  ]);
  return {
    slots: slots.map((s) => ({
      id: s.id,
      floor: s.floor,
      weekday: s.weekday,
      block: s.block,
      startTime: s.startTime,
      endTime: s.endTime,
      teacherIds: s.assignments.map((a) => a.dutyTeacherId),
    })),
    teachers: teachers.map((t) => ({
      id: t.id,
      nameEn: t.nameEn,
      nameOriginal: t.nameOriginal,
      teacherId: t.teacherId,
      linkedName: t.teacher ? `${t.teacher.name} ${t.teacher.surname}` : null,
      dutyCount: t._count.assignments,
    })),
  };
}

export type MyDutyDTO = {
  assignmentId: number;
  floor: number;
  weekday: number;
  block: string;
  startTime: string;
  endTime: string;
  coDuty: string[];
};

export async function getMyDuties(userId: string): Promise<MyDutyDTO[]> {
  const dutyTeacher = await prisma.dutyTeacher.findUnique({ where: { teacherId: userId } });
  if (!dutyTeacher) return [];
  const rows = await prisma.dutyAssignment.findMany({
    where: { dutyTeacherId: dutyTeacher.id },
    include: { slot: { include: { assignments: { include: { dutyTeacher: { select: { id: true, nameEn: true } } } } } } },
  });
  return rows
    .map((r) => ({
      assignmentId: r.id,
      floor: r.slot.floor,
      weekday: r.slot.weekday,
      block: r.slot.block,
      startTime: r.slot.startTime,
      endTime: r.slot.endTime,
      coDuty: r.slot.assignments.filter((a) => a.dutyTeacherId !== dutyTeacher.id).map((a) => a.dutyTeacher.nameEn),
    }))
    .sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime) || a.floor - b.floor);
}

// ---------------------------------------------------------------------------
// Import / seed
// ---------------------------------------------------------------------------

/** The schedule transcribed from School_Duty_Schedule_EN.pdf. */
export function defaultScheduleRows(): ImportRow[] {
  return (seed as Array<{ floor: number; weekday: number; block: string; start: string; end: string; teachers: string[] }>).map(
    (r) => ({ ...r })
  );
}

/**
 * Writes rows into the roster in a handful of queries (fast enough for a
 * serverless time limit). mode "replace" empties the roster first; "merge" only
 * rewrites the slots present in `rows`.
 */
export async function applyScheduleRows(rows: ImportRow[], mode: "replace" | "merge") {
  if (mode === "replace") {
    await prisma.dutyAssignment.deleteMany({});
    await prisma.dutySlot.deleteMany({});
  }

  const names = Array.from(new Set(rows.flatMap((r) => r.teachers)));
  await prisma.dutyTeacher.createMany({ data: names.map((nameEn) => ({ nameEn })), skipDuplicates: true });
  await prisma.dutySlot.createMany({
    data: rows.map((r) => ({ floor: r.floor, weekday: r.weekday, block: r.block, startTime: r.start, endTime: r.end })),
    skipDuplicates: true,
  });

  const [teachers, slots] = await Promise.all([
    prisma.dutyTeacher.findMany({ where: { nameEn: { in: names } }, select: { id: true, nameEn: true } }),
    prisma.dutySlot.findMany({ select: { id: true, floor: true, weekday: true, block: true, startTime: true } }),
  ]);
  const teacherId = new Map(teachers.map((t) => [t.nameEn, t.id]));
  const slotId = new Map(slots.map((s) => [`${s.floor}|${s.weekday}|${s.block}|${s.startTime}`, s.id]));

  const touchedSlotIds: number[] = [];
  const assignments: { slotId: number; dutyTeacherId: number }[] = [];
  for (const r of rows) {
    const sid = slotId.get(`${r.floor}|${r.weekday}|${r.block}|${r.start}`);
    if (!sid) continue;
    touchedSlotIds.push(sid);
    for (const name of r.teachers) {
      const tid = teacherId.get(name);
      if (tid) assignments.push({ slotId: sid, dutyTeacherId: tid });
    }
  }
  if (mode === "merge" && touchedSlotIds.length) {
    await prisma.dutyAssignment.deleteMany({ where: { slotId: { in: touchedSlotIds } } });
  }
  await prisma.dutyAssignment.createMany({ data: assignments, skipDuplicates: true });
  return { slots: touchedSlotIds.length, assignments: assignments.length, teachers: names.length };
}

/** Links duty names to real accounts when exactly one account fits (surname + first initial). */
export async function autoMatchTeachers(): Promise<{ matched: number; ambiguous: number; unmatched: number }> {
  const [unlinked, accounts, taken] = await Promise.all([
    prisma.dutyTeacher.findMany({ where: { teacherId: null } }),
    prisma.teacher.findMany({ select: { id: true, name: true, surname: true } }),
    prisma.dutyTeacher.findMany({ where: { teacherId: { not: null } }, select: { teacherId: true } }),
  ]);
  const used = new Set(taken.map((t) => t.teacherId as string));
  let matched = 0;
  let ambiguous = 0;
  let unmatched = 0;
  for (const dt of unlinked) {
    const { surname, initial } = splitDutyName(dt.nameEn);
    if (surname.length < 4) {
      unmatched++;
      continue;
    }
    const hits = accounts.filter(
      (a) =>
        !used.has(a.id) &&
        a.surname.toLowerCase().startsWith(surname.slice(0, Math.max(4, surname.length - 1))) &&
        (!initial || a.name.toLowerCase().startsWith(initial))
    );
    if (hits.length === 1) {
      used.add(hits[0].id);
      await prisma.dutyTeacher.update({ where: { id: dt.id }, data: { teacherId: hits[0].id } });
      matched++;
    } else if (hits.length > 1) ambiguous++;
    else unmatched++;
  }
  return { matched, ambiguous, unmatched };
}

// ---------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------
type Delivery = { channels: string[] };

async function deliver(
  userId: string,
  message: { title: string; body: string },
  prefs: DutyPrefsDTO,
  force?: { push?: boolean; inApp?: boolean }
): Promise<Delivery> {
  const channels: string[] = [];
  const wantsInApp = force?.inApp ?? prefs.inApp;
  const wantsPush = force?.push ?? prefs.push;
  if (wantsInApp) channels.push("inapp");

  const jobs: Promise<unknown>[] = [];
  if (wantsPush) {
    channels.push("push");
    jobs.push(sendPushToUser(userId, { ...message, url: DUTY_URL }).catch((e) => console.error("[duty] push failed", e)));
  }
  if (prefs.email) {
    channels.push("email");
    jobs.push(sendEmailToUser(userId, { ...message, url: DUTY_URL }).catch((e) => console.error("[duty] email failed", e)));
  }
  await Promise.all(jobs);
  return { channels };
}

const isUniqueViolation = (err: unknown) => (err as { code?: string })?.code === "P2002";

export type ReminderSummary = {
  skipped?: string;
  date?: string;
  checked: number;
  sent: number;
  duplicates: number;
  unlinked: number;
};

/**
 * One scheduler tick. Safe to call every minute or every few minutes: the
 * unique (assignment, date, kind) log row is claimed *before* anything is sent,
 * so overlapping or repeated runs can never notify the same duty twice.
 */
export async function runDutyReminders(now: Date = new Date()): Promise<ReminderSummary> {
  const summary: ReminderSummary = { checked: 0, sent: 0, duplicates: 0, unlinked: 0 };
  if (!(await ensureDuty())) return { ...summary, skipped: "tables-unavailable" };

  const settings = await getDutySettings();
  if (!settings.enabled) return { ...summary, skipped: "disabled" };

  const local = schoolNow(now, settings.timeZone);
  summary.date = local.date;
  if (local.weekday < 1 || local.weekday > 5) return { ...summary, skipped: "weekend" };
  if (await prisma.dutyDayOff.findUnique({ where: { date: local.date } })) return { ...summary, skipped: "day-off" };

  const assignments = await prisma.dutyAssignment.findMany({
    where: { slot: { weekday: local.weekday } },
    include: {
      dutyTeacher: { select: { teacherId: true } },
      slot: { include: { assignments: { include: { dutyTeacher: { select: { nameEn: true } } } } } },
    },
  });

  const prefsCache = new Map<string, DutyPrefsDTO>();

  for (const a of assignments) {
    const kinds: DutyKind[] = dueKinds(local.minutes, a.slot.startTime, settings);
    if (!kinds.length) continue;
    summary.checked++;

    const userId = a.dutyTeacher.teacherId;
    if (!userId) {
      summary.unlinked++;
      continue;
    }
    let prefs = prefsCache.get(userId);
    if (!prefs) {
      prefs = await getDutyPrefs(userId);
      prefsCache.set(userId, prefs);
    }
    const coDuty = a.slot.assignments.filter((x) => x.id !== a.id).map((x) => x.dutyTeacher.nameEn);

    for (const kind of kinds) {
      const message = buildDutyMessage({
        floor: a.slot.floor,
        block: a.slot.block,
        startTime: a.slot.startTime,
        endTime: a.slot.endTime,
        kind,
        leadMinutes: settings.leadMinutes,
        coDuty,
      });
      let logId: number;
      try {
        const row = await prisma.dutyNotificationLog.create({
          data: { assignmentId: a.id, date: local.date, kind, userId, title: message.title, body: message.body, inApp: prefs.inApp },
          select: { id: true },
        });
        logId = row.id;
      } catch (err) {
        if (isUniqueViolation(err)) {
          summary.duplicates++;
          continue;
        }
        throw err;
      }
      const { channels } = await deliver(userId, message, prefs);
      await prisma.dutyNotificationLog.update({ where: { id: logId }, data: { channels: channels.join(",") } });
      summary.sent++;
    }
  }
  return summary;
}

/** Admin "send test notification now": goes to the admin's own account, ignoring the schedule. */
export async function sendTestDutyNotification(userId: string, sample?: { floor: number; block: string; startTime: string; endTime: string }) {
  await ensureDuty();
  const prefs = await getDutyPrefs(userId);
  const message = buildDutyMessage({
    floor: sample?.floor ?? 2,
    block: sample?.block ?? "3-4",
    startTime: sample?.startTime ?? "11:10",
    endTime: sample?.endTime ?? "11:55",
    kind: "test",
  });
  const { channels } = await deliver(userId, message, prefs, { push: true, inApp: true });
  await prisma.dutyNotificationLog.create({
    data: {
      assignmentId: null,
      date: schoolNow(new Date(), (await getDutySettings()).timeZone).date,
      kind: "test",
      userId,
      title: message.title,
      body: message.body,
      channels: channels.join(","),
      inApp: true,
    },
  });
  return { channels, body: message.body };
}
