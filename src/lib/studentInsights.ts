import prisma from "@/lib/prisma";
import { addDays, schoolToday, toDbDate } from "@/lib/uniform";
import { DEFAULT_KPA_TARGET, getCurriculumDeliveryKpaBundle } from "@/lib/curriculumDeliveryKpa";
import {
  loadOlympiads,
  summarizeOlympiads,
  type OlympiadRow,
  type OlympiadSummary,
} from "@/lib/olympiads";
import { loadMockTests, type MockTestRow } from "@/lib/mockTests";

// Student insights: one place that reads everything the school records about a
// student (attendance, uniform, assignments, exams, olympiads, clubs, behaviour)
// and turns it into percentages for each class and each student. Nothing here
// writes to the database - it only reads existing records.
//
// Definitions (the footnote on the page repeats them):
//   attendance  = came / marked in the lesson register, came = Present or Late
//   uniform     = days with a full uniform / days checked
//   assignments = assignments handed in / assignments that fell due
//   grades      = average of every exam and assignment mark as a % of its total
//   KPA         = curriculum coverage of the class (same KPA as School Pulse)
//   index       = plain average of the four percentages above that have data

export type Pct = number | null;
export type Tally = { num: number; den: number; pct: Pct };

const pct = (a: number, b: number): Pct => (b > 0 ? Math.round((a / b) * 100) : null);
const tally = (num: number, den: number): Tally => ({ num, den, pct: pct(num, den) });
const avg = (values: Pct[]): Pct => {
  const v = values.filter((x): x is number => x !== null);
  return v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length) : null;
};

// ---- period -----------------------------------------------------------------

export const DAY_OPTIONS = [7, 30, 90, 0] as const; // 0 = the whole school year so far
export const DEFAULT_DAYS = 30;

export const parseDays = (raw: string | undefined): number => {
  const n = raw !== undefined ? Number(raw) : NaN;
  return (DAY_OPTIONS as readonly number[]).includes(n) ? n : DEFAULT_DAYS;
};

export type Window = {
  days: number;
  from: string | null;
  to: string;
  start: Date | null;
  end: Date;
};

export function resolveWindow(days: number): Window {
  const to = schoolToday();
  const from = days > 0 ? addDays(to, -(days - 1)) : null;
  return {
    days,
    from,
    to,
    start: from ? new Date(`${from}T00:00:00+05:00`) : null,
    end: new Date(`${addDays(to, 1)}T00:00:00+05:00`),
  };
}

const timeRange = (w: Window) => ({ ...(w.start ? { gte: w.start } : {}), lt: w.end });

// ---- per-student metrics -----------------------------------------------------

export type Behavior = { positive: number; concern: number; incident: number };

export type StudentMetrics = {
  attendance: Tally;
  late: number;
  absent: number;
  uniform: Tally;
  uniformPartial: number;
  uniformNone: number;
  assignments: Tally;
  grades: { sum: number; count: number; pct: Pct };
  exams: { sum: number; count: number; pct: Pct };
  homework: { sum: number; count: number; pct: Pct };
  olympiads: OlympiadSummary;
  clubs: number;
  behavior: Behavior;
  index: Pct;
};

export type Flag = "attendance" | "uniform" | "grades" | "work";

const gradePct = (score: number, total: number | null): number => {
  const v = total && total > 0 ? (score / total) * 100 : score;
  return Math.max(0, Math.min(100, Math.round(v)));
};

const meanOf = (sum: number, count: number): Pct => (count > 0 ? Math.round(sum / count) : null);

type StudentRef = { id: string; classId: number };

async function loadMetrics(students: StudentRef[], w: Window): Promise<Map<string, StudentMetrics>> {
  const ids = students.map((s) => s.id);
  const classIds = Array.from(new Set(students.map((s) => s.classId)));
  const classOf = new Map(students.map((s) => [s.id, s.classId]));
  const now = new Date();
  const dueRange = { ...(w.start ? { gte: w.start } : {}), lt: w.end, lte: now };

  const [att, uni, results, assignments, submissions, olympiads, clubs, behavior] = await Promise.all([
    prisma.attendanceRecord.groupBy({
      by: ["studentId", "status"],
      where: { studentId: { in: ids }, date: timeRange(w) },
      _count: { _all: true },
    }),
    prisma.uniformCheck.groupBy({
      by: ["studentId", "status"],
      where: {
        studentId: { in: ids },
        date: { ...(w.from ? { gte: toDbDate(w.from) } : {}), lte: toDbDate(w.to) },
      },
      _count: { _all: true },
    }),
    prisma.result.findMany({
      where: { studentId: { in: ids } },
      select: {
        studentId: true,
        score: true,
        assignmentId: true,
        examId: true,
        exam: { select: { totalMarks: true, startTime: true } },
        assignment: { select: { totalMarks: true, dueDate: true } },
      },
    }),
    prisma.assignment.findMany({
      where: { lesson: { classId: { in: classIds } }, dueDate: dueRange },
      select: { id: true, targetStudentIds: true, lesson: { select: { classId: true } } },
    }),
    prisma.studentSubmission.findMany({
      where: {
        studentId: { in: ids },
        assignmentId: { not: null },
        status: { in: ["SUBMITTED", "LATE", "GRADED"] },
      },
      select: { studentId: true, assignmentId: true },
    }),
    loadOlympiads(ids),
    prisma.clubEnrollment.groupBy({
      by: ["studentId"],
      where: { studentId: { in: ids }, status: "ACTIVE" },
      _count: { _all: true },
    }),
    prisma.behaviorLog.groupBy({
      by: ["studentId", "type"],
      where: { studentId: { in: ids }, date: timeRange(w) },
      _count: { _all: true },
    }),
  ]);

  const blank = (): StudentMetrics => ({
    attendance: tally(0, 0),
    late: 0,
    absent: 0,
    uniform: tally(0, 0),
    uniformPartial: 0,
    uniformNone: 0,
    assignments: tally(0, 0),
    grades: { sum: 0, count: 0, pct: null },
    exams: { sum: 0, count: 0, pct: null },
    homework: { sum: 0, count: 0, pct: null },
    olympiads: summarizeOlympiads([]),
    clubs: 0,
    behavior: { positive: 0, concern: 0, incident: 0 },
    index: null,
  });
  const out = new Map<string, StudentMetrics>(ids.map((id) => [id, blank()]));

  // attendance
  const attCounts = new Map<string, { came: number; total: number; late: number; absent: number }>();
  for (const g of att) {
    const c = attCounts.get(g.studentId) ?? { came: 0, total: 0, late: 0, absent: 0 };
    const n = g._count._all;
    c.total += n;
    if (g.status === "PRESENT" || g.status === "LATE") c.came += n;
    if (g.status === "LATE") c.late += n;
    if (g.status === "ABSENT") c.absent += n;
    attCounts.set(g.studentId, c);
  }
  attCounts.forEach((c, id) => {
    const m = out.get(id);
    if (!m) return;
    m.attendance = tally(c.came, c.total);
    m.late = c.late;
    m.absent = c.absent;
  });

  // uniform
  const uniCounts = new Map<string, { full: number; total: number; partial: number; none: number }>();
  for (const g of uni) {
    const c = uniCounts.get(g.studentId) ?? { full: 0, total: 0, partial: 0, none: 0 };
    const n = g._count._all;
    c.total += n;
    if (g.status === "FULL") c.full += n;
    if (g.status === "PARTIAL") c.partial += n;
    if (g.status === "NONE") c.none += n;
    uniCounts.set(g.studentId, c);
  }
  uniCounts.forEach((c, id) => {
    const m = out.get(id);
    if (!m) return;
    m.uniform = tally(c.full, c.total);
    m.uniformPartial = c.partial;
    m.uniformNone = c.none;
  });

  // grades (only marks for exams / assignments that fall inside the period)
  for (const r of results) {
    const m = out.get(r.studentId);
    if (!m) continue;
    if (r.exam) {
      const t = r.exam.startTime;
      if ((w.start && t < w.start) || t >= w.end) continue;
      m.exams.sum += gradePct(r.score, r.exam.totalMarks);
      m.exams.count += 1;
    } else if (r.assignment) {
      const t = r.assignment.dueDate;
      if ((w.start && t < w.start) || t >= w.end) continue;
      m.homework.sum += gradePct(r.score, r.assignment.totalMarks);
      m.homework.count += 1;
    }
  }

  // assignments handed in
  const handedIn = new Set<string>();
  for (const s of submissions) handedIn.add(`${s.studentId}:${s.assignmentId}`);
  for (const r of results) if (r.assignmentId) handedIn.add(`${r.studentId}:${r.assignmentId}`);
  const assignmentsByClass = new Map<number, { id: number; targets: string[] }[]>();
  for (const a of assignments) {
    const list = assignmentsByClass.get(a.lesson.classId) ?? [];
    list.push({ id: a.id, targets: a.targetStudentIds });
    assignmentsByClass.set(a.lesson.classId, list);
  }
  out.forEach((m, id) => {
    const list = assignmentsByClass.get(classOf.get(id) as number) ?? [];
    let expected = 0;
    let done = 0;
    for (const a of list) {
      if (a.targets.length > 0 && !a.targets.includes(id)) continue;
      expected += 1;
      if (handedIn.has(`${id}:${a.id}`)) done += 1;
    }
    m.assignments = tally(done, expected);
  });

  // olympiads, clubs, behaviour
  const olyByStudent = new Map<string, OlympiadRow[]>();
  for (const o of olympiads) olyByStudent.set(o.studentId, [...(olyByStudent.get(o.studentId) ?? []), o]);
  olyByStudent.forEach((rows, id) => {
    const m = out.get(id);
    if (m) m.olympiads = summarizeOlympiads(rows);
  });
  for (const c of clubs) {
    const m = out.get(c.studentId);
    if (m) m.clubs = c._count._all;
  }
  for (const b of behavior) {
    const m = out.get(b.studentId);
    if (!m) continue;
    const n = b._count._all;
    if (b.type === "POSITIVE") m.behavior.positive += n;
    else if (b.type === "CONCERN") m.behavior.concern += n;
    else m.behavior.incident += n;
  }

  // roll-ups
  out.forEach((m) => {
    const gCount = m.exams.count + m.homework.count;
    m.exams.pct = meanOf(m.exams.sum, m.exams.count);
    m.homework.pct = meanOf(m.homework.sum, m.homework.count);
    m.grades = {
      sum: m.exams.sum + m.homework.sum,
      count: gCount,
      pct: meanOf(m.exams.sum + m.homework.sum, gCount),
    };
    m.index = avg([m.attendance.pct, m.uniform.pct, m.grades.pct, m.assignments.pct]);
  });

  return out;
}

export function flagsOf(m: StudentMetrics): Flag[] {
  const flags: Flag[] = [];
  if (m.attendance.pct !== null && m.attendance.pct < 80) flags.push("attendance");
  if (m.uniform.pct !== null && m.uniform.pct < 50) flags.push("uniform");
  if (m.grades.pct !== null && m.grades.pct < 50) flags.push("grades");
  if (m.assignments.pct !== null && m.assignments.pct < 50) flags.push("work");
  return flags;
}

// ---- class overview ------------------------------------------------------------

export type ClassSummary = {
  id: number;
  name: string;
  gradeLevel: number;
  supervisor: string | null;
  students: number;
  attendance: Tally;
  uniform: Tally;
  assignments: Tally;
  grades: { pct: Pct; count: number };
  kpa: Pct;
  olympiads: { students: number; entries: number; prizes: number };
  attention: number;
  index: Pct;
  rank: number | null;
};

export type SchoolTotals = {
  classes: number;
  students: number;
  attendance: Pct;
  uniform: Pct;
  kpa: Pct;
  grades: Pct;
  assignments: Pct;
  olympiadStudents: number;
  olympiadEntries: number;
  olympiadPrizes: number;
  attention: number;
};

type ClassRow = {
  id: number;
  name: string;
  grade: { level: number };
  supervisor: { name: string; surname: string } | null;
};

function summarizeClass(
  cls: ClassRow,
  metrics: StudentMetrics[],
  kpa: Pct
): ClassSummary {
  let aNum = 0, aDen = 0, uNum = 0, uDen = 0, wNum = 0, wDen = 0, gSum = 0, gCount = 0;
  let oStudents = 0, oEntries = 0, oPrizes = 0, attention = 0;
  for (const m of metrics) {
    aNum += m.attendance.num; aDen += m.attendance.den;
    uNum += m.uniform.num; uDen += m.uniform.den;
    wNum += m.assignments.num; wDen += m.assignments.den;
    gSum += m.grades.sum; gCount += m.grades.count;
    if (m.olympiads.entries > 0) oStudents += 1;
    oEntries += m.olympiads.entries;
    oPrizes += m.olympiads.prizes;
    if (flagsOf(m).length > 0) attention += 1;
  }
  const attendance = tally(aNum, aDen);
  const uniform = tally(uNum, uDen);
  const assignments = tally(wNum, wDen);
  const grades = { pct: meanOf(gSum, gCount), count: gCount };
  return {
    id: cls.id,
    name: cls.name,
    gradeLevel: cls.grade.level,
    supervisor: cls.supervisor ? `${cls.supervisor.name} ${cls.supervisor.surname}` : null,
    students: metrics.length,
    attendance,
    uniform,
    assignments,
    grades,
    kpa,
    olympiads: { students: oStudents, entries: oEntries, prizes: oPrizes },
    attention,
    index: avg([attendance.pct, uniform.pct, grades.pct, assignments.pct, kpa]),
    rank: null,
  };
}

const byName = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

async function loadKpaByClass(): Promise<Map<number, Pct>> {
  try {
    const bundle = await getCurriculumDeliveryKpaBundle({ target: DEFAULT_KPA_TARGET });
    return new Map(bundle.classes.map((c) => [c.classId, c.coveragePct]));
  } catch (error) {
    console.error("[studentInsights] KPA unavailable", error);
    return new Map();
  }
}

function rankClasses(list: ClassSummary[]): ClassSummary[] {
  const sorted = [...list].sort((a, b) => {
    if (a.index === null && b.index === null) return byName(a.name, b.name);
    if (a.index === null) return 1;
    if (b.index === null) return -1;
    return b.index - a.index || byName(a.name, b.name);
  });
  let rank = 0;
  for (const c of sorted) c.rank = c.index === null ? null : ++rank;
  return sorted;
}

export type Overview = { window: Window; classes: ClassSummary[]; school: SchoolTotals };

export async function getOverview(opts: { days: number; classIds?: number[] }): Promise<Overview> {
  const window = resolveWindow(opts.days);
  const [classes, students, kpa] = await Promise.all([
    prisma.class.findMany({
      where: opts.classIds ? { id: { in: opts.classIds } } : undefined,
      select: {
        id: true,
        name: true,
        grade: { select: { level: true } },
        supervisor: { select: { name: true, surname: true } },
      },
    }),
    prisma.student.findMany({
      where: opts.classIds ? { classId: { in: opts.classIds } } : undefined,
      select: { id: true, classId: true },
    }),
    loadKpaByClass(),
  ]);
  const metrics = await loadMetrics(students, window);

  const summaries = classes.map((cls) => {
    const own = students.filter((s) => s.classId === cls.id).map((s) => metrics.get(s.id) as StudentMetrics);
    return summarizeClass(cls, own, kpa.get(cls.id) ?? null);
  });
  const ranked = rankClasses(summaries);

  const sum = (f: (c: ClassSummary) => number) => ranked.reduce((s, c) => s + f(c), 0);
  const school: SchoolTotals = {
    classes: ranked.length,
    students: sum((c) => c.students),
    attendance: pct(sum((c) => c.attendance.num), sum((c) => c.attendance.den)),
    uniform: pct(sum((c) => c.uniform.num), sum((c) => c.uniform.den)),
    assignments: pct(sum((c) => c.assignments.num), sum((c) => c.assignments.den)),
    grades: (() => {
      const withGrades = ranked.filter((c) => c.grades.pct !== null && c.grades.count > 0);
      const total = withGrades.reduce((s, c) => s + c.grades.count, 0);
      return total > 0
        ? Math.round(withGrades.reduce((s, c) => s + (c.grades.pct as number) * c.grades.count, 0) / total)
        : null;
    })(),
    kpa: avg(ranked.map((c) => c.kpa)),
    olympiadStudents: sum((c) => c.olympiads.students),
    olympiadEntries: sum((c) => c.olympiads.entries),
    olympiadPrizes: sum((c) => c.olympiads.prizes),
    attention: sum((c) => c.attention),
  };
  return { window, classes: ranked, school };
}

// ---- one class -----------------------------------------------------------------

export type StudentRow = {
  id: string;
  name: string;
  surname: string;
  img: string | null;
  metrics: StudentMetrics;
  flags: Flag[];
  rank: number | null;
};

export type ClassDetail = {
  window: Window;
  summary: ClassSummary;
  students: StudentRow[];
};

export async function getClassDetail(opts: { classId: number; days: number }): Promise<ClassDetail | null> {
  const window = resolveWindow(opts.days);
  const cls = await prisma.class.findUnique({
    where: { id: opts.classId },
    select: {
      id: true,
      name: true,
      grade: { select: { level: true } },
      supervisor: { select: { name: true, surname: true } },
      students: { select: { id: true, name: true, surname: true, img: true, classId: true } },
    },
  });
  if (!cls) return null;
  const [kpa, metrics] = await Promise.all([loadKpaByClass(), loadMetrics(cls.students, window)]);

  const rows: StudentRow[] = cls.students.map((s) => {
    const m = metrics.get(s.id) as StudentMetrics;
    return { id: s.id, name: s.name, surname: s.surname, img: s.img, metrics: m, flags: flagsOf(m), rank: null };
  });
  rows.sort((a, b) => {
    const x = a.metrics.index;
    const y = b.metrics.index;
    if (x === null && y === null) return byName(`${a.surname} ${a.name}`, `${b.surname} ${b.name}`);
    if (x === null) return 1;
    if (y === null) return -1;
    return y - x || byName(`${a.surname} ${a.name}`, `${b.surname} ${b.name}`);
  });
  let rank = 0;
  for (const r of rows) r.rank = r.metrics.index === null ? null : ++rank;

  const summary = summarizeClass(cls, rows.map((r) => r.metrics), kpa.get(cls.id) ?? null);
  return { window, summary, students: rows };
}

// ---- one student -----------------------------------------------------------------

export type WeekBar = { week: string; came: number; marked: number; pct: Pct };
export type UniformDay = { date: string; status: "FULL" | "PARTIAL" | "NONE"; missing: string[] };
export type WorkRow = {
  title: string;
  subject: string;
  date: string;
  state: "done" | "missing";
  pct: Pct;
};
export type ExamRowOut = { title: string; subject: string; date: string; pct: number };
export type ClubRow = { id: number; name: string; came: number; marked: number; pct: Pct };
export type BehaviorRow = { type: "POSITIVE" | "CONCERN" | "INCIDENT"; title: string; date: string };

export type StudentProfile = {
  window: Window;
  student: {
    id: string;
    name: string;
    surname: string;
    img: string | null;
    classId: number;
    className: string;
    gradeLevel: number;
    supervisor: string | null;
  };
  metrics: StudentMetrics;
  flags: Flag[];
  rank: number | null;
  classSize: number;
  classAvg: {
    attendance: Pct;
    uniform: Pct;
    grades: Pct;
    assignments: Pct;
    index: Pct;
  };
  weeks: WeekBar[];
  uniformDays: UniformDay[];
  work: WorkRow[];
  exams: ExamRowOut[];
  olympiads: OlympiadRow[];
  clubs: ClubRow[];
  behavior: BehaviorRow[];
  mock: MockTestRow[];
};

const SCHOOL_OFFSET_MS = 5 * 60 * 60 * 1000;
const ymdOf = (d: Date) => new Date(d.getTime() + SCHOOL_OFFSET_MS).toISOString().slice(0, 10);
const mondayOf = (ymd: string) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7;
  return addDays(ymd, -back);
};

export async function getStudentProfile(opts: { studentId: string; days: number }): Promise<StudentProfile | null> {
  const base = await prisma.student.findUnique({
    where: { id: opts.studentId },
    select: { classId: true },
  });
  if (!base) return null;
  const detail = await getClassDetail({ classId: base.classId, days: opts.days });
  if (!detail) return null;
  const row = detail.students.find((s) => s.id === opts.studentId);
  if (!row) return null;
  const w = detail.window;
  const now = new Date();

  const cls = await prisma.class.findUnique({
    where: { id: base.classId },
    select: { name: true, grade: { select: { level: true } }, supervisor: { select: { name: true, surname: true } } },
  });

  const [attRows, uniRows, assignments, subs, results, olympiads, clubs, clubAtt, behavior, mock] =
    await Promise.all([
      prisma.attendanceRecord.findMany({
        where: { studentId: opts.studentId, date: timeRange(w) },
        select: { date: true, status: true },
      }),
      prisma.uniformCheck.findMany({
        where: {
          studentId: opts.studentId,
          date: { ...(w.from ? { gte: toDbDate(w.from) } : {}), lte: toDbDate(w.to) },
        },
        orderBy: { date: "desc" },
        take: 12,
        select: { date: true, status: true, missingItems: true },
      }),
      prisma.assignment.findMany({
        where: { lesson: { classId: base.classId }, dueDate: { ...(w.start ? { gte: w.start } : {}), lt: w.end, lte: now } },
        orderBy: { dueDate: "desc" },
        take: 40,
        select: {
          id: true,
          title: true,
          dueDate: true,
          totalMarks: true,
          targetStudentIds: true,
          lesson: { select: { subject: { select: { name: true } } } },
        },
      }),
      prisma.studentSubmission.findMany({
        where: { studentId: opts.studentId, assignmentId: { not: null } },
        select: { assignmentId: true, status: true, grade: true },
      }),
      prisma.result.findMany({
        where: { studentId: opts.studentId },
        select: {
          score: true,
          assignmentId: true,
          exam: {
            select: {
              title: true,
              totalMarks: true,
              startTime: true,
              lesson: { select: { subject: { select: { name: true } } } },
            },
          },
        },
      }),
      loadOlympiads([opts.studentId]),
      prisma.clubEnrollment.findMany({
        where: { studentId: opts.studentId, status: "ACTIVE" },
        select: { club: { select: { id: true, name: true } } },
      }),
      prisma.clubAttendance.findMany({
        where: { studentId: opts.studentId, clubSession: { date: timeRange(w) } },
        select: { status: true, clubSession: { select: { clubId: true } } },
      }),
      prisma.behaviorLog.findMany({
        where: { studentId: opts.studentId, date: timeRange(w) },
        orderBy: { date: "desc" },
        take: 8,
        select: { type: true, title: true, date: true },
      }),
      loadMockTests(opts.studentId).catch(() => [] as MockTestRow[]),
    ]);

  // attendance by week (latest 12 weeks)
  const weekMap = new Map<string, { came: number; marked: number }>();
  for (const r of attRows) {
    const wk = mondayOf(ymdOf(r.date));
    const c = weekMap.get(wk) ?? { came: 0, marked: 0 };
    c.marked += 1;
    if (r.status === "PRESENT" || r.status === "LATE") c.came += 1;
    weekMap.set(wk, c);
  }
  const weeks: WeekBar[] = Array.from(weekMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([week, c]) => ({ week, came: c.came, marked: c.marked, pct: pct(c.came, c.marked) }));

  // assignments
  const subByAssignment = new Map<number, { status: string; grade: number | null }>();
  for (const s of subs) if (s.assignmentId) subByAssignment.set(s.assignmentId, { status: s.status, grade: s.grade });
  const resultByAssignment = new Map<number, number>();
  for (const r of results) if (r.assignmentId) resultByAssignment.set(r.assignmentId, r.score);
  const work: WorkRow[] = [];
  for (const a of assignments) {
    if (a.targetStudentIds.length > 0 && !a.targetStudentIds.includes(opts.studentId)) continue;
    const sub = subByAssignment.get(a.id);
    const score = resultByAssignment.get(a.id) ?? sub?.grade ?? null;
    const handed = resultByAssignment.has(a.id) || (!!sub && ["SUBMITTED", "LATE", "GRADED"].includes(sub.status));
    work.push({
      title: a.title,
      subject: a.lesson.subject.name,
      date: ymdOf(a.dueDate),
      state: handed ? "done" : "missing",
      pct: score === null ? null : gradePct(score, a.totalMarks),
    });
  }

  // exams
  const exams: ExamRowOut[] = [];
  for (const r of results) {
    if (!r.exam) continue;
    const t = r.exam.startTime;
    if ((w.start && t < w.start) || t >= w.end) continue;
    exams.push({
      title: r.exam.title,
      subject: r.exam.lesson.subject.name,
      date: ymdOf(t),
      pct: gradePct(r.score, r.exam.totalMarks),
    });
  }
  exams.sort((a, b) => b.date.localeCompare(a.date));

  // clubs
  const clubTally = new Map<number, { came: number; marked: number }>();
  for (const a of clubAtt) {
    const id = a.clubSession.clubId;
    const c = clubTally.get(id) ?? { came: 0, marked: 0 };
    c.marked += 1;
    if (a.status === "PRESENT" || a.status === "LATE") c.came += 1;
    clubTally.set(id, c);
  }
  const clubRows: ClubRow[] = clubs.map((c) => {
    const t = clubTally.get(c.club.id) ?? { came: 0, marked: 0 };
    return { id: c.club.id, name: c.club.name, came: t.came, marked: t.marked, pct: pct(t.came, t.marked) };
  });

  const mates = detail.students.map((s) => s.metrics);
  const classAvg = {
    attendance: detail.summary.attendance.pct,
    uniform: detail.summary.uniform.pct,
    grades: detail.summary.grades.pct,
    assignments: detail.summary.assignments.pct,
    index: avg(mates.map((m) => m.index)),
  };

  return {
    window: w,
    student: {
      id: row.id,
      name: row.name,
      surname: row.surname,
      img: row.img,
      classId: base.classId,
      className: cls?.name ?? detail.summary.name,
      gradeLevel: cls?.grade.level ?? detail.summary.gradeLevel,
      supervisor: cls?.supervisor ? `${cls.supervisor.name} ${cls.supervisor.surname}` : null,
    },
    metrics: row.metrics,
    flags: row.flags,
    rank: row.rank,
    classSize: detail.students.length,
    classAvg,
    weeks,
    uniformDays: uniRows.map((u) => ({
      date: u.date.toISOString().slice(0, 10),
      status: u.status as "FULL" | "PARTIAL" | "NONE",
      missing: u.missingItems,
    })),
    work,
    exams,
    olympiads,
    clubs: clubRows,
    behavior: behavior.map((b) => ({
      type: b.type as "POSITIVE" | "CONCERN" | "INCIDENT",
      title: b.title,
      date: ymdOf(b.date),
    })),
    mock,
  };
}
