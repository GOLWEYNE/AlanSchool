import prisma from "./prisma";
import {
  BELL_SCHEDULE,
  bellGroupOf,
  findPeriod,
  fromMinutes,
  toMinutes,
  type BellGroup,
} from "./bellSchedule";
import { SCHOOL_UTC_OFFSET_HOURS, toWallClock } from "./schoolTime";

// One-off repair of the timetable that was bulk-loaded for the junior classes
// before lesson times were tied to the school clock.
//
// What happened: that bulk timetable follows the junior routine (first lesson
// 08:55 ... seventh lesson 13:55) but every lesson was stored 2 hours too early,
// so on the school clock (UTC+5) the first lesson reads 06:55 instead of 08:55.
// All of those lessons carry dates from one week (14-18 Sep 2026) and sit exactly
// on one of the seven early slots, which is what identifies them. The repair moves
// each one to its proper routine period.
//
// Safety: every lesson that is changed is first copied into "LessonTimeBackup"
// (in the same transaction), a lesson is never shifted twice, and the whole
// change can be undone from the same page.

const LEGACY_SHIFT_MINUTES = 2 * 60;
const SCHOOL_OFFSET_MINUTES = SCHOOL_UTC_OFFSET_HOURS * 60;

/** Dates (UTC, inclusive) the bulk timetable was stored under. */
export const BULK_WEEK = { from: "2026-09-14", to: "2026-09-18" };

// The seven early slots, derived from the junior routine: what was stored (UTC)
// for each period, and what it should have been.
const LEGACY_SLOTS = BELL_SCHEDULE.junior.map((period) => {
  const start = toMinutes(period.start);
  const end = toMinutes(period.end);
  const early = SCHOOL_OFFSET_MINUTES + LEGACY_SHIFT_MINUTES;
  return {
    n: period.n,
    oldStart: fromMinutes(start - early), // UTC as stored
    oldEnd: fromMinutes(end - early),
    newStart: fromMinutes(start - SCHOOL_OFFSET_MINUTES), // UTC once fixed
    newEnd: fromMinutes(end - SCHOOL_OFFSET_MINUTES),
    // What the timetable shows today (school clock) and what it will show.
    shownStart: fromMinutes(start - LEGACY_SHIFT_MINUTES),
    shownEnd: fromMinutes(end - LEGACY_SHIFT_MINUTES),
    fixedStart: period.start,
    fixedEnd: period.end,
  };
});

const pad = (n: number) => String(n).padStart(2, "0");
const utcHHMM = (d: Date) => `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
const utcDate = (d: Date) => d.toISOString().slice(0, 10);
const schoolHHMM = (d: Date) => {
  const w = toWallClock(d);
  return `${pad(w.hour)}:${pad(w.minute)}`;
};
const sqlTimestamp = (d: Date) => d.toISOString().replace("T", " ").replace("Z", "");

// --- backup table ----------------------------------------------------------
// Created on first use (additive and idempotent) because this project's deploy
// does not run `prisma migrate deploy`; it is not part of the Prisma schema.

const CREATE_BACKUP_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS "LessonTimeBackup" (
    "id" SERIAL NOT NULL,
    "lessonId" INTEGER NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT (now() AT TIME ZONE 'UTC'),
    "restoredAt" TIMESTAMP(3),
    CONSTRAINT "LessonTimeBackup_pkey" PRIMARY KEY ("id")
)`;

// A lesson can only have one active (not yet restored) backup, so it can never
// be shifted twice, even if two people press the button at the same time.
const CREATE_BACKUP_INDEX_SQL = `CREATE UNIQUE INDEX IF NOT EXISTS "LessonTimeBackup_active_lesson_key" ON "LessonTimeBackup"("lessonId") WHERE "restoredAt" IS NULL`;

let ensured: Promise<void> | null = null;

const ensureBackupTable = () => {
  ensured ??= (async () => {
    try {
      await prisma.$executeRawUnsafe(CREATE_BACKUP_TABLE_SQL);
      await prisma.$executeRawUnsafe(CREATE_BACKUP_INDEX_SQL);
    } catch (error) {
      ensured = null; // try again on the next request
      throw error;
    }
  })();
  return ensured;
};

// --- status ----------------------------------------------------------------

export type RepairCandidate = {
  id: number;
  newStartAt: Date;
  newEndAt: Date;
};

export type PendingSlot = {
  n: number;
  /** Time the lesson shows today (school clock), "HH:MM". */
  shownStart: string;
  shownEnd: string;
  /** Time it will show after the repair. */
  fixedStart: string;
  fixedEnd: string;
  count: number;
};

export type OffRoutineLesson = {
  id: number;
  classId: number;
  className: string;
  group: BellGroup;
  day: string;
  subjectName: string;
  /** School clock, "HH:MM". */
  start: string;
  end: string;
};

export type LessonTimeStatus = {
  total: number;
  /** Lessons already on a routine period (after the pending repair, if applied). */
  onRoutine: number;
  pending: { count: number; classCount: number; slots: PendingSlot[] };
  applied: { count: number; savedAt: string | null };
  off: OffRoutineLesson[];
  candidates: RepairCandidate[];
};

export async function getLessonTimeStatus(): Promise<LessonTimeStatus> {
  await ensureBackupTable();

  const [lessons, backups] = await Promise.all([
    prisma.lesson.findMany({
      select: {
        id: true,
        classId: true,
        day: true,
        startTime: true,
        endTime: true,
        class: { select: { name: true } },
        subject: { select: { name: true } },
      },
      orderBy: [{ classId: "asc" }, { id: "asc" }],
    }),
    prisma.$queryRawUnsafe<{ lessonId: number; savedAt: string }[]>(
      `SELECT "lessonId", to_char("savedAt", 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "savedAt" FROM "LessonTimeBackup" WHERE "restoredAt" IS NULL`
    ),
  ]);

  const alreadyShifted = new Set(backups.map((b) => Number(b.lessonId)));
  const savedAt = backups.map((b) => b.savedAt).sort().pop() ?? null;

  const candidates: RepairCandidate[] = [];
  const slotCounts = new Map<number, number>();
  const candidateClasses = new Set<string>();
  const off: OffRoutineLesson[] = [];
  let onRoutine = 0;

  for (const lesson of lessons) {
    const className = lesson.class.name;
    const group = bellGroupOf(className);
    const startUtc = utcHHMM(lesson.startTime);
    const endUtc = utcHHMM(lesson.endTime);
    const date = utcDate(lesson.startTime);

    // Is this one of the early-slot lessons of the bulk timetable?
    if (
      group === "junior" &&
      !alreadyShifted.has(lesson.id) &&
      date >= BULK_WEEK.from &&
      date <= BULK_WEEK.to
    ) {
      const byStart = LEGACY_SLOTS.find((s) => s.oldStart === startUtc);
      const byEnd = LEGACY_SLOTS.find((s) => s.oldEnd === endUtc);
      // A lesson whose start and end point at different slots is left for a human.
      if (!(byStart && byEnd && byStart !== byEnd)) {
        const slot = byStart ?? byEnd;
        if (slot) {
          candidates.push({
            id: lesson.id,
            newStartAt: new Date(`${date}T${slot.newStart}:00.000Z`),
            newEndAt: new Date(`${utcDate(lesson.endTime)}T${slot.newEnd}:00.000Z`),
          });
          slotCounts.set(slot.n, (slotCounts.get(slot.n) ?? 0) + 1);
          candidateClasses.add(className);
          onRoutine += 1; // will be on its routine period once repaired
          continue;
        }
      }
    }

    const start = schoolHHMM(lesson.startTime);
    const end = schoolHHMM(lesson.endTime);
    if (findPeriod(group, start, end)) {
      onRoutine += 1;
    } else {
      off.push({
        id: lesson.id,
        classId: lesson.classId,
        className,
        group,
        day: lesson.day,
        subjectName: lesson.subject.name,
        start,
        end,
      });
    }
  }

  const slots: PendingSlot[] = LEGACY_SLOTS.filter((s) => slotCounts.has(s.n)).map((s) => ({
    n: s.n,
    shownStart: s.shownStart,
    shownEnd: s.shownEnd,
    fixedStart: s.fixedStart,
    fixedEnd: s.fixedEnd,
    count: slotCounts.get(s.n) ?? 0,
  }));

  return {
    total: lessons.length,
    onRoutine,
    pending: { count: candidates.length, classCount: candidateClasses.size, slots },
    applied: { count: alreadyShifted.size, savedAt },
    off,
    candidates,
  };
}

// --- apply / undo ----------------------------------------------------------

/** Moves the early-slot lessons to their routine periods. Returns how many moved. */
export async function applyLessonTimeRepair(): Promise<number> {
  const { candidates } = await getLessonTimeStatus();
  if (candidates.length === 0) return 0;

  // Only integers and ISO timestamps built above go into the statements.
  const ids = candidates.map((c) => Math.trunc(c.id)).join(",");
  const values = candidates
    .map((c) => `(${Math.trunc(c.id)},'${sqlTimestamp(c.newStartAt)}','${sqlTimestamp(c.newEndAt)}')`)
    .join(",");

  await prisma.$transaction([
    prisma.$executeRawUnsafe(
      `INSERT INTO "LessonTimeBackup" ("lessonId", "startTime", "endTime") SELECT id, "startTime", "endTime" FROM "Lesson" WHERE id IN (${ids})`
    ),
    prisma.$executeRawUnsafe(
      `UPDATE "Lesson" AS l SET "startTime" = v.s::timestamp, "endTime" = v.e::timestamp FROM (VALUES ${values}) AS v(id, s, e) WHERE l.id = v.id`
    ),
  ]);

  return candidates.length;
}

/** Puts every repaired lesson back exactly as it was. Returns how many were restored. */
export async function undoLessonTimeRepair(): Promise<number> {
  await ensureBackupTable();
  const [restored] = await prisma.$transaction([
    prisma.$executeRawUnsafe(
      `UPDATE "Lesson" AS l SET "startTime" = b."startTime", "endTime" = b."endTime" FROM "LessonTimeBackup" AS b WHERE b."lessonId" = l.id AND b."restoredAt" IS NULL`
    ),
    prisma.$executeRawUnsafe(
      `UPDATE "LessonTimeBackup" SET "restoredAt" = (now() AT TIME ZONE 'UTC') WHERE "restoredAt" IS NULL`
    ),
  ]);
  return restored;
}
