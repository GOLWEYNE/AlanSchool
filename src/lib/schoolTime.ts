// School time: the one clock every timetable and date-time in the app is read on.
//
// Why this exists: the server (Vercel) runs in UTC while every browser runs in
// its own local zone, and the old code mixed the two - a lesson typed as 09:00
// in a datetime-local input was parsed in the browser's zone, then re-read with
// local getters (getHours/setHours) on the server in UTC. The same lesson
// therefore showed different hours on different pages, and re-saving the edit
// form (which printed the stored instant in UTC) moved it again every time.
//
// The fix is a single fixed zone. The school is in Kazakhstan, which has used
// UTC+5 (no daylight saving) since 1 March 2024. Everything that reads or writes
// a lesson time goes through the helpers below, so the result no longer depends
// on where the server runs or where the viewer's browser is. This file must
// stay free of server-only imports because client components use it too.
//
// The offset is applied by hand (not through Intl) so conversions behave the
// same in every runtime and can never be broken by an outdated tz database.

export const SCHOOL_UTC_OFFSET_HOURS = 5;

// IANA name for the same fixed offset, for Intl / next-intl. The Etc/GMT zones
// have their sign inverted by definition: Etc/GMT-5 is UTC+5.
export const SCHOOL_TIME_ZONE = `Etc/GMT${SCHOOL_UTC_OFFSET_HOURS >= 0 ? "-" : "+"}${Math.abs(
  SCHOOL_UTC_OFFSET_HOURS
)}`;

/** Human label such as "UTC+5". */
export const SCHOOL_UTC_LABEL = `UTC${SCHOOL_UTC_OFFSET_HOURS >= 0 ? "+" : "-"}${Math.abs(
  SCHOOL_UTC_OFFSET_HOURS
)}`;

const HOUR_MS = 60 * 60 * 1000;
const OFFSET_MS = SCHOOL_UTC_OFFSET_HOURS * HOUR_MS;

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

export type WallClock = {
  year: number;
  /** 1-12 */
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export type SchoolDate = Pick<WallClock, "year" | "month" | "day">;

export type LessonDay = "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY";

export const LESSON_DAY_OFFSET: Record<LessonDay, number> = {
  MONDAY: 0,
  TUESDAY: 1,
  WEDNESDAY: 2,
  THURSDAY: 3,
  FRIDAY: 4,
};

const LESSON_DAY_BY_WEEKDAY: Record<number, LessonDay | null> = {
  0: null,
  1: "MONDAY",
  2: "TUESDAY",
  3: "WEDNESDAY",
  4: "THURSDAY",
  5: "FRIDAY",
  6: null,
};

// ---------------------------------------------------------------------------
// Instant <-> school wall clock
// ---------------------------------------------------------------------------

/** What a clock on the school wall reads at the given instant. */
export const toWallClock = (date: Date): WallClock => {
  const s = new Date(date.getTime() + OFFSET_MS);
  return {
    year: s.getUTCFullYear(),
    month: s.getUTCMonth() + 1,
    day: s.getUTCDate(),
    hour: s.getUTCHours(),
    minute: s.getUTCMinutes(),
    second: s.getUTCSeconds(),
  };
};

/** The instant at which the school wall clock reads the given fields. */
export const fromWallClock = (
  p: SchoolDate & Partial<Pick<WallClock, "hour" | "minute" | "second">>
): Date =>
  new Date(
    Date.UTC(p.year, p.month - 1, p.day, p.hour ?? 0, p.minute ?? 0, p.second ?? 0) - OFFSET_MS
  );

/** "YYYY-MM-DDTHH:mm:ss" - a wall-clock reading with no zone attached. */
export const formatWallClock = (p: WallClock): string =>
  `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`;

/** The string form of an instant as read on the school clock. */
export const toWallClockString = (date: Date): string => formatWallClock(toWallClock(date));

const WALL_CLOCK_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/;

/** Parses "YYYY-MM-DDTHH:mm[:ss]" (no zone) into fields, or null if malformed. */
export const parseWallClockString = (value: string): WallClock | null => {
  const m = WALL_CLOCK_RE.exec(value.trim());
  if (!m) return null;
  const [year, month, day, hour, minute, second] = [m[1], m[2], m[3], m[4], m[5], m[6] ?? "0"].map(
    Number
  );
  if (month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59 || second > 59) return null;
  // Reject impossible dates such as 31 February.
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return { year, month, day, hour, minute, second };
};

// ---------------------------------------------------------------------------
// datetime-local inputs
// ---------------------------------------------------------------------------

/**
 * Value for an <input type="datetime-local"> showing the given instant on the
 * school clock. (`toISOString().slice(0, 16)` prints UTC, not what the user
 * typed, so an edit form built on it shifts the time on every save.)
 */
export const toSchoolInputValue = (value: Date | string | number | null | undefined) => {
  if (value === null || value === undefined || value === "") return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return toWallClockString(date).slice(0, 16);
};

/**
 * Parses what a datetime-local input submits. A zone-less "YYYY-MM-DDTHH:mm" is
 * read as school time (NOT the browser's zone, which is what `new Date(value)`
 * would do). Anything carrying an explicit zone (Z / +05:00) is honoured as is.
 * Returns undefined for input that is not a valid date-time.
 */
export const parseSchoolDateTime = (value: string): Date | undefined => {
  const parts = parseWallClockString(value);
  if (parts) return fromWallClock(parts);
  const trimmed = value.trim();
  if (/(Z|[+-]\d{2}:?\d{2})$/i.test(trimmed)) {
    const date = new Date(trimmed);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return undefined;
};

// ---------------------------------------------------------------------------
// Weeks and days on the school calendar
// ---------------------------------------------------------------------------

const addDays = (d: SchoolDate, n: number): SchoolDate => {
  const x = new Date(Date.UTC(d.year, d.month - 1, d.day + n));
  return { year: x.getUTCFullYear(), month: x.getUTCMonth() + 1, day: x.getUTCDate() };
};

/** 0 = Sunday ... 6 = Saturday, on the school calendar. */
export const schoolWeekday = (now: Date = new Date()): number =>
  new Date(now.getTime() + OFFSET_MS).getUTCDay();

/** Which lesson column "today" is (null on Saturday and Sunday). */
export const schoolTodayLessonDay = (now: Date = new Date()): LessonDay | null =>
  LESSON_DAY_BY_WEEKDAY[schoolWeekday(now)];

/**
 * The Monday on or before today. On a weekend this is the Monday of the week
 * that just ended, so the recurring timetable keeps showing the school week
 * rather than an empty next one.
 */
export const schoolWeekMonday = (now: Date = new Date()): SchoolDate => {
  const today = toWallClock(now);
  const weekday = schoolWeekday(now);
  return addDays(today, -(weekday === 0 ? 6 : weekday - 1));
};

/** Minutes since midnight on the school clock. */
export const schoolMinutesOfDay = (date: Date): number => {
  const w = toWallClock(date);
  return w.hour * 60 + w.minute;
};

// ---------------------------------------------------------------------------
// Recurring lessons
//
// Lesson.startTime/endTime only carry a meaningful time of day (their date part
// is whatever was showing in the picker); the weekday lives in Lesson.day. These
// helpers re-project a lesson onto a real date.
// ---------------------------------------------------------------------------

/** A lesson's start/end on its weekday of the given week, as wall-clock strings. */
export const projectLessonToWeek = (
  lesson: { day: LessonDay; startTime: Date; endTime: Date },
  monday: SchoolDate = schoolWeekMonday()
): { start: string; end: string } => {
  const date = addDays(monday, LESSON_DAY_OFFSET[lesson.day]);
  const s = toWallClock(lesson.startTime);
  const e = toWallClock(lesson.endTime);
  return {
    start: formatWallClock({ ...date, hour: s.hour, minute: s.minute, second: s.second }),
    end: formatWallClock({ ...date, hour: e.hour, minute: e.minute, second: e.second }),
  };
};

/**
 * The instant on the same school day as `reference`, at the school time of day
 * of `time`. Used to put a recurring lesson onto "today" for live countdowns.
 */
export const onSchoolDayOf = (reference: Date, time: Date): Date => {
  const day = toWallClock(reference);
  const t = toWallClock(time);
  return fromWallClock({ ...day, hour: t.hour, minute: t.minute, second: t.second });
};

/** Monday 00:00 of the given school week, as a wall-clock string. */
export const weekStartString = (monday: SchoolDate = schoolWeekMonday()): string =>
  formatWallClock({ ...monday, hour: 0, minute: 0, second: 0 });

/** [start, end) of the school day containing the given "YYYY-MM-DD" (or now). */
export const schoolDayRange = (ymd?: string | null, now: Date = new Date()): [Date, Date] => {
  const m = ymd ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd) : null;
  const day: SchoolDate = m
    ? { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) }
    : toWallClock(now);
  return [fromWallClock(day), fromWallClock(addDays(day, 1))];
};

// ---------------------------------------------------------------------------
// Wall clock <-> the calendar widgets
//
// react-big-calendar positions events with the *local* getters of the Dates it
// is given. To make it show school time to everyone, the server sends wall-clock
// strings and the browser turns them into Dates whose local fields equal the
// wall clock. Those Dates are never real instants - never send them to the
// server or compare them with `new Date()`; convert back with
// localDateToWallClockString first.
// ---------------------------------------------------------------------------

/** A Date whose local (browser) fields read as the given wall-clock string. */
export const wallClockToLocalDate = (value: string): Date => {
  const p = parseWallClockString(value);
  if (!p) return new Date(NaN);
  return new Date(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
};

/** Inverse of wallClockToLocalDate: reads a Date's local fields as a wall clock. */
export const localDateToWallClockString = (date: Date): string =>
  formatWallClock({
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
    second: date.getSeconds(),
  });

/** "Now" as a wall-clock Date for react-big-calendar's `getNow`. */
export const schoolNowAsLocalDate = (): Date => wallClockToLocalDate(toWallClockString(new Date()));

/**
 * A Date whose UTC fields equal the given wall-clock Date's local fields.
 * Format it with `timeZone: "UTC"` to print the wall-clock reading exactly,
 * whatever zone the browser or server is in.
 */
export const localWallClockToUtcDate = (date: Date): Date =>
  new Date(
    Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      date.getHours(),
      date.getMinutes(),
      date.getSeconds()
    )
  );
