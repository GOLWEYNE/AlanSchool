import prisma from "@/lib/prisma";
import { loadMockTests, type MockTestRow } from "@/lib/mockTests";
import { SCHOOL_UTC_OFFSET_HOURS } from "@/lib/schoolTime";

// Everything the report card PDF shows, gathered in one place.
//
// compose() is pure (no database access) so the layout can be exercised with sample data;
// loadReportCardPdfData() reads the database and feeds it.

export const WEEKS_SHOWN = 8;
const HOUR = 3600_000;
const DAY = 24 * HOUR;

export type ResultKind = "assignment" | "quiz" | "exam";

export type RawResult = {
  kind: ResultKind;
  subject: string;
  score: number;
  // When the work was due / sat; decides which week it falls in.
  date: Date;
};

export type RawBehavior = {
  type: "POSITIVE" | "CONCERN" | "INCIDENT";
  title: string;
  date: Date;
};

export type RawClub = {
  name: string;
  enrolledAt: Date;
  sessions: { id: number; date: Date }[];
  attendedSessionIds: number[];
};

export type RawReportCardInput = {
  studentName: string;
  studentUsername: string;
  className: string;
  gradeLevel?: number;
  term: string;
  schoolYear: string;
  gpa: number | null;
  attendanceRate: number | null;
  generatedAt: Date;
  results: RawResult[];
  behavior: RawBehavior[];
  attendance: { present: number; late: number; absent: number; excused: number };
  clubs: RawClub[];
  mockTests: MockTestRow[];
};

export type SubjectRow = {
  subject: string;
  assignments: number | null;
  quizzes: number | null;
  exams: number | null;
  average: number | null;
};

export type ReportCardPdfData = {
  studentName: string;
  studentUsername: string;
  className: string;
  gradeLevel?: number;
  term: string;
  schoolYear: string;
  gpa: number | null;
  attendanceRate: number | null;
  generatedAt: Date;
  weekLabels: string[];
  weekly: {
    assignments: (number | null)[];
    quizzes: (number | null)[];
    exams: (number | null)[];
    positive: number[];
    concerns: number[];
    ielts: (number | null)[];
    sat: (number | null)[];
  };
  subjects: SubjectRow[];
  attendance: { present: number; late: number; absent: number; excused: number; total: number };
  clubs: { name: string; attended: number; held: number }[];
  behaviorLog: { date: Date; title: string; type: RawBehavior["type"] }[];
  ielts: { latest: number | null; best: number | null; sections: Record<string, number> | null };
  sat: { latest: number | null; sections: Record<string, number> | null };
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const mean = (xs: number[]) => (xs.length ? round1(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

// Monday 00:00 (school time) of the week containing `d`, returned as a plain ms value in the
// "school clock" frame (UTC fields of the shifted instant are the school wall-clock fields).
function weekStart(d: Date): number {
  const shifted = d.getTime() + SCHOOL_UTC_OFFSET_HOURS * HOUR;
  const dayStart = Math.floor(shifted / DAY) * DAY;
  const dow = new Date(dayStart).getUTCDay(); // 0 = Sunday
  const sinceMonday = (dow + 6) % 7;
  return dayStart - sinceMonday * DAY;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const weekLabel = (ms: number) => {
  const d = new Date(ms);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};

export function compose(input: RawReportCardInput): ReportCardPdfData {
  // The last WEEKS_SHOWN school weeks, ending with the week the report card was generated in.
  const lastWeek = weekStart(input.generatedAt);
  const starts = Array.from({ length: WEEKS_SHOWN }, (_, i) => lastWeek - (WEEKS_SHOWN - 1 - i) * 7 * DAY);
  const indexOf = (d: Date) => starts.indexOf(weekStart(d));

  const weeklyAvg = (kind: ResultKind) =>
    starts.map((_, i) =>
      mean(input.results.filter((r) => r.kind === kind && indexOf(r.date) === i).map((r) => r.score))
    );

  const positive = starts.map(() => 0);
  const concerns = starts.map(() => 0);
  for (const b of input.behavior) {
    const i = indexOf(b.date);
    if (i < 0) continue;
    if (b.type === "POSITIVE") positive[i] += 1;
    else concerns[i] += 1;
  }

  const latestPerWeek = (kind: "IELTS" | "SAT") =>
    starts.map((_, i) => {
      const inWeek = input.mockTests.filter((m) => m.kind === kind && indexOf(m.takenAt) === i);
      return inWeek.length ? inWeek[inWeek.length - 1].score : null;
    });

  const subjectNames = Array.from(new Set(input.results.map((r) => r.subject))).sort((a, b) => a.localeCompare(b));
  const subjects: SubjectRow[] = subjectNames.map((subject) => {
    const mine = input.results.filter((r) => r.subject === subject);
    const pick = (kind: ResultKind) => mean(mine.filter((r) => r.kind === kind).map((r) => r.score));
    return {
      subject,
      assignments: pick("assignment"),
      quizzes: pick("quiz"),
      exams: pick("exam"),
      average: mean(mine.map((r) => r.score)),
    };
  });

  const ielts = input.mockTests.filter((m) => m.kind === "IELTS");
  const sat = input.mockTests.filter((m) => m.kind === "SAT");

  const clubs = input.clubs.map((c) => {
    const held = c.sessions.filter((s) => s.date >= c.enrolledAt && s.date <= input.generatedAt);
    const heldIds = new Set(held.map((s) => s.id));
    return {
      name: c.name,
      held: held.length,
      attended: c.attendedSessionIds.filter((id) => heldIds.has(id)).length,
    };
  });

  const windowStart = starts[0];
  const behaviorLog = input.behavior
    .filter((b) => weekStart(b.date) >= windowStart)
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 6)
    .map((b) => ({ date: b.date, title: b.title, type: b.type }));

  const a = input.attendance;
  return {
    studentName: input.studentName,
    studentUsername: input.studentUsername,
    className: input.className,
    gradeLevel: input.gradeLevel,
    term: input.term,
    schoolYear: input.schoolYear,
    gpa: input.gpa,
    attendanceRate: input.attendanceRate,
    generatedAt: input.generatedAt,
    weekLabels: starts.map(weekLabel),
    weekly: {
      assignments: weeklyAvg("assignment"),
      quizzes: weeklyAvg("quiz"),
      exams: weeklyAvg("exam"),
      positive,
      concerns,
      ielts: latestPerWeek("IELTS"),
      sat: latestPerWeek("SAT"),
    },
    subjects,
    attendance: { ...a, total: a.present + a.late + a.absent + a.excused },
    clubs,
    behaviorLog,
    ielts: {
      latest: ielts.length ? ielts[ielts.length - 1].score : null,
      best: ielts.length ? Math.max(...ielts.map((m) => m.score)) : null,
      sections: ielts.length ? ielts[ielts.length - 1].sections : null,
    },
    sat: {
      latest: sat.length ? sat[sat.length - 1].score : null,
      sections: sat.length ? sat[sat.length - 1].sections : null,
    },
  };
}

const hasQuestions = (q: unknown) => Array.isArray(q) && q.length > 0;

export async function loadReportCardPdfData(reportCard: {
  term: string;
  schoolYear: string;
  gpa: number | null;
  attendanceRate: number | null;
  generatedAt: Date;
  student: {
    id: string;
    name: string;
    surname: string;
    username: string;
    class: { name: string };
    grade?: { level: number } | null;
  };
}): Promise<ReportCardPdfData> {
  const { student } = reportCard;

  const [results, behavior, attendanceRecords, enrollments, mockTests] = await Promise.all([
    prisma.result.findMany({
      where: { studentId: student.id },
      include: {
        exam: { include: { lesson: { include: { subject: true } } } },
        assignment: { include: { lesson: { include: { subject: true } } } },
      },
    }),
    prisma.behaviorLog.findMany({
      where: { studentId: student.id },
      select: { type: true, title: true, date: true },
      orderBy: { date: "desc" },
    }),
    prisma.attendanceRecord.findMany({ where: { studentId: student.id }, select: { status: true } }),
    prisma.clubEnrollment.findMany({
      where: { studentId: student.id, status: "ACTIVE" },
      include: { club: { select: { id: true, name: true } } },
    }),
    loadMockTests(student.id).catch(() => [] as MockTestRow[]),
  ]);

  const rawResults: RawResult[] = results.flatMap((r): RawResult[] => {
    if (r.exam) {
      return [{ kind: "exam", subject: r.exam.lesson.subject.name, score: r.score, date: r.exam.startTime }];
    }
    if (r.assignment) {
      return [
        {
          kind: hasQuestions(r.assignment.questions) ? "quiz" : "assignment",
          subject: r.assignment.lesson.subject.name,
          score: r.score,
          date: r.assignment.dueDate,
        },
      ];
    }
    return [];
  });

  const clubIds = enrollments.map((e) => e.clubId);
  const [clubSessions, clubAttendances] = clubIds.length
    ? await Promise.all([
        prisma.clubSession.findMany({
          where: { clubId: { in: clubIds } },
          select: { id: true, clubId: true, date: true },
        }),
        prisma.clubAttendance.findMany({
          where: { studentId: student.id, status: { in: ["PRESENT", "LATE"] } },
          select: { clubSessionId: true },
        }),
      ])
    : [[], []];
  const attendedIds = clubAttendances.map((a) => a.clubSessionId);

  const attendance = { present: 0, late: 0, absent: 0, excused: 0 };
  for (const rec of attendanceRecords) {
    if (rec.status === "PRESENT") attendance.present += 1;
    else if (rec.status === "LATE") attendance.late += 1;
    else if (rec.status === "ABSENT") attendance.absent += 1;
    else if (rec.status === "EXCUSED") attendance.excused += 1;
  }

  return compose({
    studentName: `${student.name} ${student.surname}`,
    studentUsername: student.username,
    className: student.class.name,
    gradeLevel: student.grade?.level,
    term: reportCard.term,
    schoolYear: reportCard.schoolYear,
    gpa: reportCard.gpa,
    attendanceRate: reportCard.attendanceRate,
    generatedAt: reportCard.generatedAt,
    results: rawResults,
    behavior,
    attendance,
    clubs: enrollments.map((e) => {
      const sessions = clubSessions.filter((s) => s.clubId === e.clubId);
      return {
        name: e.club.name,
        enrolledAt: e.enrolledAt,
        sessions: sessions.map((s) => ({ id: s.id, date: s.date })),
        attendedSessionIds: attendedIds.filter((id) => sessions.some((s) => s.id === id)),
      };
    }),
    mockTests,
  });
}
