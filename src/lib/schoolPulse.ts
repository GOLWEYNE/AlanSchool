import prisma from "@/lib/prisma";
import { getCurriculumDeliveryKpa, DEFAULT_KPA_TARGET } from "@/lib/curriculumDeliveryKpa";
import {
  fromWallClock,
  onSchoolDayOf,
  schoolTodayLessonDay,
  toWallClock,
  type LessonDay,
} from "@/lib/schoolTime";

// "School pulse": the data behind the big principal's banner on the admin
// dashboard. Everything is read from records teachers already create - the
// attendance register, class uniform checks, curriculum tagging (the KPA),
// the timetable and the clubs - so nothing new has to be entered.
//
// A teacher counts as "on track" for a duty when they did it on at least
// ON_TRACK_RATE of the school days it applied to them in the chosen period.
// For "Today" that simply means: they did it today.

export type PulsePeriod = "day" | "week" | "term";

export const ON_TRACK_RATE = 0.8;

const DAYS: LessonDay[] = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];
// getUTCDay(): 1 = Monday ... 5 = Friday.
const DAY_BY_UTC_WEEKDAY: Record<number, LessonDay | undefined> = {
  1: "MONDAY",
  2: "TUESDAY",
  3: "WEDNESDAY",
  4: "THURSDAY",
  5: "FRIDAY",
};

// Terms (quarters) of the Kazakhstan school year, as month-day windows. The
// real dates move a little every year, so these are working windows: a term
// is "current" from its start until the next one begins.
const TERMS = [
  { n: 1, start: [9, 1], end: [10, 26] },
  { n: 2, start: [11, 3], end: [12, 28] },
  { n: 3, start: [1, 8], end: [3, 22] },
  { n: 4, start: [3, 30], end: [5, 31] },
] as const;

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const toUtc = (s: string) => new Date(`${s}T00:00:00.000Z`);
const addDays = (s: string, n: number) => {
  const d = toUtc(s);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const weekdayOf = (s: string) => toUtc(s).getUTCDay();
const dayOfDate = (s: string) => DAY_BY_UTC_WEEKDAY[weekdayOf(s)];
const schoolDateString = (d: Date) => {
  const w = toWallClock(d);
  return ymd(w.year, w.month, w.day);
};

export type PulseRange = {
  period: PulsePeriod;
  from: string; // YYYY-MM-DD inclusive
  to: string; // YYYY-MM-DD inclusive (never after today)
  today: string;
  termNumber: number | null;
};

export const parsePeriod = (raw: string | undefined): PulsePeriod =>
  raw === "day" || raw === "week" || raw === "term" ? raw : "week";

export function resolveRange(period: PulsePeriod, now: Date = new Date()): PulseRange {
  const today = schoolDateString(now);
  if (period === "day") return { period, from: today, to: today, today, termNumber: null };
  if (period === "week") {
    const wd = weekdayOf(today);
    const from = addDays(today, -(wd === 0 ? 6 : wd - 1));
    return { period, from, to: today, today, termNumber: null };
  }
  const y = Number(today.slice(0, 4));
  // Latest term (this school year or the previous one) that has already begun.
  let best: { n: number; from: string; end: string } | null = null;
  for (const year of [y - 1, y]) {
    for (const t of TERMS) {
      // Terms 3 and 4 fall in the calendar year after the one the school year starts.
      const startYear = t.n >= 3 ? year + 1 : year;
      const from = ymd(startYear, t.start[0], t.start[1]);
      const end = ymd(startYear, t.end[0], t.end[1]);
      if (from <= today && (!best || from > best.from)) best = { n: t.n, from, end };
    }
  }
  if (!best) return { period, from: today, to: today, today, termNumber: null };
  return { period, from: best.from, to: best.end < today ? best.end : today, today, termNumber: best.n };
}

export type DutyStat = {
  // Teachers the duty applies to, and how many of them are on track.
  expected: number;
  onTrack: number;
  pct: number | null;
  // Overall completion: duty days done / duty days expected, across teachers.
  daysDone: number;
  daysExpected: number;
  daysPct: number | null;
};

export type NudgeTeacher = {
  id: string;
  name: string;
  attendance: number | null;
  uniform: number | null;
  kpa: number | null;
};

export type PulseDay = {
  day: LessonDay;
  lessons: number;
  teachers: number;
  isToday: boolean;
};

export type SchoolPulse = {
  range: PulseRange;
  schoolDays: number;
  teachersTotal: number;
  kpa: DutyStat & { target: number; avgCoverage: number | null };
  uniform: DutyStat;
  attendance: DutyStat;
  clubs: {
    total: number;
    active: number;
    studentsEnrolled: number;
    sessions: number;
    withoutLeader: number;
  };
  week: PulseDay[];
  today: {
    lessons: number;
    inProgress: number;
    finished: number;
    upcoming: number;
    teachersTeaching: number;
    isSchoolDay: boolean;
  };
  nudges: NudgeTeacher[];
};

const pct = (a: number, b: number): number | null => (b > 0 ? Math.round((a / b) * 100) : null);

const toStat = (rates: Map<string, { done: number; expected: number }>): DutyStat => {
  let onTrack = 0;
  let daysDone = 0;
  let daysExpected = 0;
  let expected = 0;
  rates.forEach(({ done, expected: exp }) => {
    if (exp <= 0) return;
    expected += 1;
    daysDone += done;
    daysExpected += exp;
    if (done / exp >= ON_TRACK_RATE) onTrack += 1;
  });
  return {
    expected,
    onTrack,
    pct: pct(onTrack, expected),
    daysDone,
    daysExpected,
    daysPct: pct(daysDone, daysExpected),
  };
};

export async function getSchoolPulse(period: PulsePeriod): Promise<SchoolPulse> {
  const now = new Date();
  const range = resolveRange(period, now);
  const rangeStart = fromWallClock({
    year: Number(range.from.slice(0, 4)),
    month: Number(range.from.slice(5, 7)),
    day: Number(range.from.slice(8, 10)),
  });
  const nextDay = addDays(range.to, 1);
  const rangeEnd = fromWallClock({
    year: Number(nextDay.slice(0, 4)),
    month: Number(nextDay.slice(5, 7)),
    day: Number(nextDay.slice(8, 10)),
  });

  const [teachers, lessons, classes, attendanceGroups, uniformGroups, kpaRows, clubs, sessions] =
    await Promise.all([
      prisma.teacher.findMany({ select: { id: true, name: true, surname: true } }),
      prisma.lesson.findMany({
        select: { day: true, teacherId: true, startTime: true, endTime: true },
      }),
      prisma.class.findMany({ where: { supervisorId: { not: null } }, select: { supervisorId: true } }),
      prisma.attendanceRecord.groupBy({
        by: ["date", "markedById"],
        where: { date: { gte: rangeStart, lt: rangeEnd } },
        _count: { _all: true },
      }),
      prisma.uniformCheck.groupBy({
        by: ["date", "checkedById"],
        where: { date: { gte: toUtc(range.from), lte: toUtc(range.to) } },
        _count: { _all: true },
      }),
      getCurriculumDeliveryKpa({ target: DEFAULT_KPA_TARGET }),
      prisma.club.findMany({
        select: {
          id: true,
          instructorId: true,
          _count: { select: { enrollments: { where: { status: "ACTIVE" } }, supervisors: true } },
        },
      }),
      prisma.clubSession.count({ where: { date: { gte: rangeStart, lt: rangeEnd } } }),
    ]);

  // --- School days in the period -------------------------------------------
  // A day counts as a school day when anyone took attendance on it (so
  // holidays are not held against teachers); today counts if it is a weekday.
  const schoolDaySet = new Set<string>();
  const attendanceByTeacher = new Map<string, Set<string>>();
  for (const g of attendanceGroups) {
    const day = schoolDateString(g.date);
    if (!dayOfDate(day)) continue;
    schoolDaySet.add(day);
    if (g.markedById) {
      const set = attendanceByTeacher.get(g.markedById) ?? new Set<string>();
      set.add(day);
      attendanceByTeacher.set(g.markedById, set);
    }
  }
  if (dayOfDate(range.today) && range.today >= range.from && range.today <= range.to) {
    schoolDaySet.add(range.today);
  }
  if (schoolDaySet.size === 0) {
    // Nothing recorded yet: fall back to the plain weekdays of the period.
    for (let d = range.from; d <= range.to; d = addDays(d, 1)) if (dayOfDate(d)) schoolDaySet.add(d);
  }
  const schoolDays = Array.from(schoolDaySet).sort();

  const uniformByTeacher = new Map<string, Set<string>>();
  for (const g of uniformGroups) {
    if (!g.checkedById) continue;
    const day = g.date.toISOString().slice(0, 10);
    const set = uniformByTeacher.get(g.checkedById) ?? new Set<string>();
    set.add(day);
    uniformByTeacher.set(g.checkedById, set);
  }

  // --- Per-duty completion per teacher -------------------------------------
  const lessonDaysByTeacher = new Map<string, Set<LessonDay>>();
  for (const l of lessons) {
    const set = lessonDaysByTeacher.get(l.teacherId) ?? new Set<LessonDay>();
    set.add(l.day as LessonDay);
    lessonDaysByTeacher.set(l.teacherId, set);
  }

  const attendanceRates = new Map<string, { done: number; expected: number }>();
  lessonDaysByTeacher.forEach((days, teacherId) => {
    const expectedDays = schoolDays.filter((d) => {
      const ld = dayOfDate(d);
      return ld && days.has(ld);
    });
    const marked = attendanceByTeacher.get(teacherId) ?? new Set<string>();
    attendanceRates.set(teacherId, {
      expected: expectedDays.length,
      done: expectedDays.filter((d) => marked.has(d)).length,
    });
  });

  const supervisors = Array.from(new Set(classes.map((c) => c.supervisorId as string)));
  const uniformRates = new Map<string, { done: number; expected: number }>();
  for (const teacherId of supervisors) {
    const checked = uniformByTeacher.get(teacherId) ?? new Set<string>();
    uniformRates.set(teacherId, {
      expected: schoolDays.length,
      done: schoolDays.filter((d) => checked.has(d)).length,
    });
  }

  // KPA: share of scored teachers whose curriculum coverage meets the target.
  const scored = kpaRows.filter((r) => r.coveragePct !== null);
  const kpaOnTrack = scored.filter((r) => r.rating === "meets").length;
  const covSum = scored.reduce((s, r) => s + (r.coveragePct ?? 0), 0);
  const kpa = {
    expected: scored.length,
    onTrack: kpaOnTrack,
    pct: pct(kpaOnTrack, scored.length),
    daysDone: 0,
    daysExpected: 0,
    daysPct: null,
    target: DEFAULT_KPA_TARGET,
    avgCoverage: scored.length ? Math.round(covSum / scored.length) : null,
  };

  // --- Timetable -------------------------------------------------------------
  const todayLessonDay = schoolTodayLessonDay(now);
  const week: PulseDay[] = DAYS.map((day) => {
    const of = lessons.filter((l) => l.day === day);
    return {
      day,
      lessons: of.length,
      teachers: new Set(of.map((l) => l.teacherId)).size,
      isToday: day === todayLessonDay,
    };
  });

  const todays = todayLessonDay ? lessons.filter((l) => l.day === todayLessonDay) : [];
  let inProgress = 0;
  let finished = 0;
  let upcoming = 0;
  for (const l of todays) {
    const start = onSchoolDayOf(now, l.startTime);
    const end = onSchoolDayOf(now, l.endTime);
    if (end <= now) finished += 1;
    else if (start <= now) inProgress += 1;
    else upcoming += 1;
  }

  // --- Clubs -----------------------------------------------------------------
  const clubStats = {
    total: clubs.length,
    active: clubs.filter((c) => c._count.enrollments > 0).length,
    studentsEnrolled: clubs.reduce((s, c) => s + c._count.enrollments, 0),
    sessions,
    withoutLeader: clubs.filter((c) => !c.instructorId && c._count.supervisors === 0).length,
  };

  // --- Teachers who need a nudge ---------------------------------------------
  const kpaById = new Map(kpaRows.map((r) => [r.teacherId, r.coveragePct]));
  const rate = (m: Map<string, { done: number; expected: number }>, id: string) => {
    const r = m.get(id);
    return r && r.expected > 0 ? Math.round((r.done / r.expected) * 100) : null;
  };
  const nudges: NudgeTeacher[] = teachers
    .map((t) => ({
      id: t.id,
      name: `${t.name} ${t.surname}`,
      attendance: rate(attendanceRates, t.id),
      uniform: rate(uniformRates, t.id),
      kpa: kpaById.get(t.id) ?? null,
    }))
    .filter((t) => {
      const need = ON_TRACK_RATE * 100;
      return (
        (t.attendance !== null && t.attendance < need) ||
        (t.uniform !== null && t.uniform < need) ||
        (t.kpa !== null && t.kpa < DEFAULT_KPA_TARGET)
      );
    })
    .sort((a, b) => {
      const avg = (t: NudgeTeacher) => {
        const v = [t.attendance, t.uniform, t.kpa].filter((x): x is number => x !== null);
        return v.length ? v.reduce((s, x) => s + x, 0) / v.length : 100;
      };
      return avg(a) - avg(b) || a.name.localeCompare(b.name);
    })
    .slice(0, 8);

  return {
    range,
    schoolDays: schoolDays.length,
    teachersTotal: teachers.length,
    kpa,
    uniform: toStat(uniformRates),
    attendance: toStat(attendanceRates),
    clubs: clubStats,
    week,
    today: {
      lessons: todays.length,
      inProgress,
      finished,
      upcoming,
      teachersTeaching: new Set(todays.map((l) => l.teacherId)).size,
      isSchoolDay: !!todayLessonDay,
    },
    nudges,
  };
}
