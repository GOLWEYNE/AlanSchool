import prisma from "@/lib/prisma";
import { fromWallClock, schoolMinutesOfDay, toWallClock, type LessonDay } from "@/lib/schoolTime";
import { addDays, isValidDateStr, schoolToday } from "@/lib/uniform";

// "Lesson monitoring": how well each teacher keeps up with the daily work of a
// lesson - modelled on the "Monitoring of lesson delivery" page of school
// journals. For every lesson a teacher is timetabled to teach in the chosen
// days (one "occurrence" = one timetable slot on one calendar day) it checks:
//
//   conducted  - the class register was saved for that class that day
//   topics     - the lesson slot is tagged with curriculum objectives
//   grades     - an exam held / an assignment due that day has been graded
//                (only counted when something was due, otherwise "no data")
//   homework   - an assignment was given for the lesson that day
//
// The journal index is the average of the metrics that have data. Lessons are
// a recurring weekly slot (see schoolTime.ts), so everything is projected onto
// real calendar days here. Nothing new has to be entered by teachers: it is
// all read from records they already create.

export type MonitorPreset = "today" | "yesterday" | "week" | "month" | "custom";

export type MonitorRange = {
  preset: MonitorPreset;
  from: string; // YYYY-MM-DD inclusive
  to: string; // YYYY-MM-DD inclusive (never after today)
  today: string;
};

export type MonitorMetric = { done: number; total: number; pct: number | null };

export type MonitorRow = {
  key: string;
  classId: number;
  className: string;
  subjectId: number;
  subjectName: string;
  lessons: number;
  conducted: MonitorMetric;
  topics: MonitorMetric;
  grades: MonitorMetric;
  homework: MonitorMetric;
  index: number | null;
};

export type MonitorDay = {
  date: string;
  lessons: number;
  conducted: MonitorMetric;
  homework: MonitorMetric;
  index: number | null;
};

export type TeacherMonitor = {
  id: string;
  name: string;
  img: string | null;
  position: string | null;
  lessons: number;
  conducted: MonitorMetric;
  topics: MonitorMetric;
  grades: MonitorMetric;
  homework: MonitorMetric;
  index: number | null;
  rows: MonitorRow[];
  days: MonitorDay[];
};

export type LessonMonitoring = {
  range: MonitorRange;
  schoolDays: string[];
  teachers: TeacherMonitor[];
};

export const MAX_RANGE_DAYS = 92;

const DAY_BY_WEEKDAY: Record<number, LessonDay | undefined> = {
  1: "MONDAY",
  2: "TUESDAY",
  3: "WEDNESDAY",
  4: "THURSDAY",
  5: "FRIDAY",
};

const weekdayOf = (ymd: string) => new Date(`${ymd}T00:00:00Z`).getUTCDay();
const lessonDayOf = (ymd: string) => DAY_BY_WEEKDAY[weekdayOf(ymd)];

const pad = (n: number) => String(n).padStart(2, "0");
const schoolDateOf = (d: Date): string => {
  const w = toWallClock(d);
  return `${w.year}-${pad(w.month)}-${pad(w.day)}`;
};
const wallStartOf = (ymd: string): Date =>
  fromWallClock({ year: Number(ymd.slice(0, 4)), month: Number(ymd.slice(5, 7)), day: Number(ymd.slice(8, 10)) });

const metric = (done: number, total: number): MonitorMetric => ({
  done,
  total,
  pct: total > 0 ? Math.round((done / total) * 100) : null,
});

// Average of the metrics that have data; null when none do.
const indexOf = (...metrics: MonitorMetric[]): number | null => {
  const have = metrics.filter((m) => m.pct !== null).map((m) => m.pct as number);
  return have.length ? Math.round(have.reduce((s, x) => s + x, 0) / have.length) : null;
};

export function parsePreset(raw: string | undefined): MonitorPreset {
  return raw === "yesterday" || raw === "week" || raw === "month" || raw === "custom" ? raw : "today";
}

export function resolveMonitorRange(params: {
  preset?: string;
  from?: string;
  to?: string;
}): MonitorRange {
  const today = schoolToday();
  let preset = parsePreset(params.preset);
  // A hand-picked date range wins whatever the preset says.
  if (isValidDateStr(params.from) || isValidDateStr(params.to)) preset = "custom";

  let from = today;
  let to = today;
  if (preset === "yesterday") {
    from = addDays(today, -1);
    to = from;
  } else if (preset === "week") {
    const wd = weekdayOf(today);
    from = addDays(today, -(wd === 0 ? 6 : wd - 1));
  } else if (preset === "month") {
    from = addDays(today, -29);
  } else if (preset === "custom") {
    to = isValidDateStr(params.to) ? params.to : today;
    from = isValidDateStr(params.from) ? params.from : to;
  }

  if (to > today) to = today;
  if (from > to) from = to;
  const earliest = addDays(to, -(MAX_RANGE_DAYS - 1));
  if (from < earliest) from = earliest;
  return { preset, from, to, today };
}

type Acc = { lessons: number; conducted: number; topics: number; gradesDone: number; gradesTotal: number; homework: number };
const emptyAcc = (): Acc => ({ lessons: 0, conducted: 0, topics: 0, gradesDone: 0, gradesTotal: 0, homework: 0 });
const addAcc = (a: Acc, b: Acc) => {
  a.lessons += b.lessons;
  a.conducted += b.conducted;
  a.topics += b.topics;
  a.gradesDone += b.gradesDone;
  a.gradesTotal += b.gradesTotal;
  a.homework += b.homework;
};
const metricsOf = (a: Acc) => ({
  conducted: metric(a.conducted, a.lessons),
  topics: metric(a.topics, a.lessons),
  grades: metric(a.gradesDone, a.gradesTotal),
  homework: metric(a.homework, a.lessons),
});

export async function getLessonMonitoring(opts: {
  range: MonitorRange;
  // Set for one teacher's own cabinet; omit for the principal's all-teachers view.
  teacherId?: string;
}): Promise<LessonMonitoring> {
  const { range } = opts;
  const now = new Date();
  const nowMinutes = schoolMinutesOfDay(now);
  const rangeStart = wallStartOf(range.from);
  const rangeEnd = wallStartOf(addDays(range.to, 1));

  const lessons = await prisma.lesson.findMany({
    where: opts.teacherId ? { teacherId: opts.teacherId } : {},
    select: {
      id: true,
      day: true,
      startTime: true,
      classId: true,
      subjectId: true,
      teacherId: true,
      class: { select: { name: true } },
      subject: { select: { name: true } },
      teacher: {
        select: {
          id: true,
          name: true,
          surname: true,
          img: true,
          profile: { select: { photoUrl: true, position: true } },
        },
      },
      _count: { select: { objectives: true } },
    },
  });
  const lessonIds: number[] = lessons.map((l: { id: number }) => l.id);

  const [attendanceGroups, legacyAttendance, assignments, exams] = await Promise.all([
    prisma.attendanceRecord.groupBy({
      by: ["date", "classId", "lessonId"],
      where: { date: { gte: rangeStart, lt: rangeEnd } },
      _count: { _all: true },
    }),
    lessonIds.length
      ? prisma.attendance.groupBy({
          by: ["date", "lessonId"],
          where: { lessonId: { in: lessonIds }, date: { gte: rangeStart, lt: rangeEnd } },
          _count: { _all: true },
        })
      : Promise.resolve([] as { date: Date; lessonId: number }[]),
    lessonIds.length
      ? prisma.assignment.findMany({
          where: {
            lessonId: { in: lessonIds },
            OR: [
              { startDate: { gte: rangeStart, lt: rangeEnd } },
              { dueDate: { gte: rangeStart, lt: rangeEnd } },
            ],
          },
          select: {
            lessonId: true,
            startDate: true,
            dueDate: true,
            results: { select: { id: true }, take: 1 },
            submissions: { where: { gradedAt: { not: null } }, select: { id: true }, take: 1 },
          },
        })
      : Promise.resolve([]),
    lessonIds.length
      ? prisma.exam.findMany({
          where: { lessonId: { in: lessonIds }, startTime: { gte: rangeStart, lt: rangeEnd } },
          select: {
            lessonId: true,
            startTime: true,
            results: { select: { id: true }, take: 1 },
            submissions: { where: { gradedAt: { not: null } }, select: { id: true }, take: 1 },
          },
        })
      : Promise.resolve([]),
  ]);

  // --- School days in the range --------------------------------------------
  // A weekday counts as a school day when anyone took attendance on it (so
  // holidays are not held against teachers); today counts if it is a weekday.
  const classDays = new Set<string>(); // "classId|day": a register was saved
  const lessonDaysWithRegister = new Set<string>(); // "lessonId|day"
  const attendedDays = new Set<string>();
  for (const g of attendanceGroups as { date: Date; classId: number; lessonId: number | null }[]) {
    const day = schoolDateOf(g.date);
    if (!lessonDayOf(day)) continue;
    attendedDays.add(day);
    classDays.add(`${g.classId}|${day}`);
    if (g.lessonId !== null) lessonDaysWithRegister.add(`${g.lessonId}|${day}`);
  }
  for (const g of legacyAttendance as { date: Date; lessonId: number }[]) {
    const day = schoolDateOf(g.date);
    if (!lessonDayOf(day)) continue;
    attendedDays.add(day);
    lessonDaysWithRegister.add(`${g.lessonId}|${day}`);
  }

  const schoolDaySet = new Set<string>();
  for (let d = range.from; d <= range.to; d = addDays(d, 1)) {
    if (!lessonDayOf(d)) continue;
    if (attendedDays.has(d) || d === range.today) schoolDaySet.add(d);
  }
  if (schoolDaySet.size === 0) {
    // Nothing recorded at all: fall back to the plain weekdays of the range.
    for (let d = range.from; d <= range.to; d = addDays(d, 1)) if (lessonDayOf(d)) schoolDaySet.add(d);
  }
  const schoolDays = Array.from(schoolDaySet).sort();

  // --- Homework / grading lookups per lesson + day -------------------------
  const homeworkKeys = new Set<string>(); // "lessonId|day" an assignment was given
  const gradeItems = new Map<string, { total: number; done: number }>(); // "lessonId|day"
  const noteGradeItem = (lessonId: number, day: string, graded: boolean) => {
    const key = `${lessonId}|${day}`;
    const cur = gradeItems.get(key) ?? { total: 0, done: 0 };
    cur.total += 1;
    if (graded) cur.done += 1;
    gradeItems.set(key, cur);
  };
  type Graded = { results: { id: number }[]; submissions: { id: number }[] };
  const isGraded = (x: Graded) => x.results.length > 0 || x.submissions.length > 0;

  for (const a of assignments as (Graded & { lessonId: number; startDate: Date; dueDate: Date })[]) {
    const given = schoolDateOf(a.startDate);
    if (given >= range.from && given <= range.to) homeworkKeys.add(`${a.lessonId}|${given}`);
    const due = schoolDateOf(a.dueDate);
    if (due >= range.from && due <= range.to) noteGradeItem(a.lessonId, due, isGraded(a));
  }
  for (const e of exams as (Graded & { lessonId: number; startTime: Date })[]) {
    noteGradeItem(e.lessonId, schoolDateOf(e.startTime), isGraded(e));
  }

  // --- Walk every lesson occurrence ----------------------------------------
  type TeacherAcc = {
    meta: { id: string; name: string; img: string | null; position: string | null };
    total: Acc;
    rows: Map<string, { classId: number; className: string; subjectId: number; subjectName: string; acc: Acc }>;
    days: Map<string, Acc>;
  };
  const byTeacher = new Map<string, TeacherAcc>();

  for (const l of lessons as {
    id: number;
    day: string;
    startTime: Date;
    classId: number;
    subjectId: number;
    teacherId: string;
    class: { name: string };
    subject: { name: string };
    teacher: {
      id: string;
      name: string;
      surname: string;
      img: string | null;
      profile: { photoUrl: string | null; position: string | null } | null;
    };
    _count: { objectives: number };
  }[]) {
    let t = byTeacher.get(l.teacherId);
    if (!t) {
      t = {
        meta: {
          id: l.teacher.id,
          name: `${l.teacher.name} ${l.teacher.surname}`,
          img: l.teacher.profile?.photoUrl ?? l.teacher.img ?? null,
          position: l.teacher.profile?.position ?? null,
        },
        total: emptyAcc(),
        rows: new Map(),
        days: new Map(),
      };
      byTeacher.set(l.teacherId, t);
    }
    const rowKey = `${l.classId}:${l.subjectId}`;
    let row = t.rows.get(rowKey);
    if (!row) {
      row = { classId: l.classId, className: l.class.name, subjectId: l.subjectId, subjectName: l.subject.name, acc: emptyAcc() };
      t.rows.set(rowKey, row);
    }

    const startsAt = schoolMinutesOfDay(l.startTime);
    for (const day of schoolDays) {
      if (lessonDayOf(day) !== l.day) continue;
      // A lesson that has not begun yet today cannot be held against anyone.
      if (day === range.today && startsAt > nowMinutes) continue;

      const occ = emptyAcc();
      occ.lessons = 1;
      if (classDays.has(`${l.classId}|${day}`) || lessonDaysWithRegister.has(`${l.id}|${day}`)) occ.conducted = 1;
      if (l._count.objectives > 0) occ.topics = 1;
      if (homeworkKeys.has(`${l.id}|${day}`)) occ.homework = 1;
      const g = gradeItems.get(`${l.id}|${day}`);
      if (g && g.total > 0) {
        occ.gradesTotal = 1;
        if (g.done >= g.total) occ.gradesDone = 1;
      }

      addAcc(row.acc, occ);
      addAcc(t.total, occ);
      const dayAcc = t.days.get(day) ?? emptyAcc();
      addAcc(dayAcc, occ);
      t.days.set(day, dayAcc);
    }
  }

  const teachers: TeacherMonitor[] = Array.from(byTeacher.values()).map((t) => {
    const m = metricsOf(t.total);
    const rows: MonitorRow[] = Array.from(t.rows.entries())
      .map(([key, r]) => {
        const rm = metricsOf(r.acc);
        return {
          key,
          classId: r.classId,
          className: r.className,
          subjectId: r.subjectId,
          subjectName: r.subjectName,
          lessons: r.acc.lessons,
          ...rm,
          index: indexOf(rm.conducted, rm.topics, rm.grades, rm.homework),
        };
      })
      .filter((r) => r.lessons > 0)
      .sort((a, b) => a.className.localeCompare(b.className, undefined, { numeric: true }) || a.subjectName.localeCompare(b.subjectName));
    const days: MonitorDay[] = schoolDays.map((date) => {
      const acc = t.days.get(date) ?? emptyAcc();
      const dm = metricsOf(acc);
      return {
        date,
        lessons: acc.lessons,
        conducted: dm.conducted,
        homework: dm.homework,
        index: indexOf(dm.conducted, dm.topics, dm.grades, dm.homework),
      };
    });
    return {
      ...t.meta,
      lessons: t.total.lessons,
      ...m,
      index: indexOf(m.conducted, m.topics, m.grades, m.homework),
      rows,
      days,
    };
  });

  // Lowest journal index first (the teachers who need attention), then teachers
  // with nothing to score, alphabetically within each group.
  teachers.sort((a, b) => {
    if (a.index === null && b.index === null) return a.name.localeCompare(b.name);
    if (a.index === null) return 1;
    if (b.index === null) return -1;
    return a.index - b.index || a.name.localeCompare(b.name);
  });

  return { range, schoolDays, teachers };
}
