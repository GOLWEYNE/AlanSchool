// The school's daily routine (2026-2027 academic year): when each lesson starts
// and ends. All times are school time (see src/lib/schoolTime.ts), written as
// "HH:MM". Two groups follow different bells:
//   - junior: classes 0a-0c, 1a-1d (incl. the -к / -r parallels), 2a-2e, 3a-3e, 4a-4d
//   - upper:  classes 5a-11c
// (Breakfast, lunch, clubs and the afternoon snack are not lessons, so they are
// not listed here.)

export type BellGroup = "junior" | "upper";

export type BellPeriod = {
  /** Lesson number within the day (1-based). */
  n: number;
  start: string;
  end: string;
};

export const BELL_SCHEDULE: Record<BellGroup, BellPeriod[]> = {
  junior: [
    { n: 1, start: "08:55", end: "09:35" },
    { n: 2, start: "09:40", end: "10:20" },
    { n: 3, start: "10:25", end: "11:05" },
    { n: 4, start: "11:10", end: "11:50" },
    { n: 5, start: "11:55", end: "12:35" },
    { n: 6, start: "13:10", end: "13:50" },
    { n: 7, start: "13:55", end: "14:35" },
  ],
  upper: [
    { n: 1, start: "08:30", end: "09:10" },
    { n: 2, start: "09:40", end: "10:20" },
    { n: 3, start: "10:25", end: "11:05" },
    { n: 4, start: "11:10", end: "11:50" },
    { n: 5, start: "11:55", end: "12:35" },
    { n: 6, start: "12:40", end: "13:20" },
    { n: 7, start: "13:55", end: "14:35" },
    { n: 8, start: "14:40", end: "15:20" },
  ],
};

/** Grades 0-4 follow the junior bells, grades 5 and up the upper bells. */
export const bellGroupOf = (className: string): BellGroup => {
  const match = className.trim().match(/^\d+/);
  const grade = match ? parseInt(match[0], 10) : NaN;
  return Number.isFinite(grade) && grade >= 5 ? "upper" : "junior";
};

/** The routine period with exactly this start and end (school time), if any. */
export const findPeriod = (group: BellGroup, start: string, end: string): BellPeriod | null =>
  BELL_SCHEDULE[group].find((p) => p.start === start && p.end === end) ?? null;

/** "HH:MM" -> minutes since midnight. */
export const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** Minutes since midnight -> "HH:MM". */
export const fromMinutes = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};
