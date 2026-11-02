import prisma from "@/lib/prisma";

// KPA: "Curriculum Delivery" - one Key Performance Area for teacher reviews.
//
// It is computed entirely from data the Curriculum Coverage report already
// uses (Lesson -> CurriculumObjective tags and Exam -> CurriculumObjective
// tags), so it needs no new tables. For each teacher it looks at every
// class + subject they teach ("assignment"), counts the curriculum objectives
// that apply to that class's grade, and checks how many of them are covered
// by one of THAT teacher's tagged lessons (or an exam in the date range).

export const DEFAULT_KPA_TARGET = 80;

export type KpaRating = "meets" | "below" | "noData";

export type TeacherKpaRow = {
  teacherId: string;
  name: string;
  // class+subject pairs that have at least one applicable objective.
  assignments: number;
  // class+subject pairs the teacher teaches but with no objectives defined
  // yet - these can't be scored, so they are reported separately.
  assignmentsWithoutObjectives: number;
  totalObjectives: number;
  coveredObjectives: number;
  gaps: number;
  coveragePct: number | null;
  lessons: number;
  taggedLessons: number;
  taggedPct: number | null;
  rating: KpaRating;
};

type LessonRow = {
  id: number;
  teacherId: string;
  classId: number;
  subjectId: number;
  teacher: { name: string; surname: string };
  class: { gradeId: number; name: string };
  objectives: { id: number }[];
};

// The same KPA, seen from the class side: for each class, how many of the
// curriculum objectives that apply to it (across every subject it studies)
// were covered by ANY teacher's tagged lessons or exams.
export type ClassKpaRow = {
  classId: number;
  name: string;
  totalObjectives: number;
  coveredObjectives: number;
  coveragePct: number | null;
  rating: KpaRating;
};

type ObjectiveRow = { id: number; subjectId: number; gradeId: number | null };

type ExamRow = { lessonId: number; objectives: { id: number }[] };

const pct = (part: number, whole: number): number | null =>
  whole > 0 ? Math.round((part / whole) * 100) : null;

export const clampTarget = (raw: string | undefined): number => {
  const n = raw ? parseInt(raw, 10) : NaN;
  if (Number.isNaN(n)) return DEFAULT_KPA_TARGET;
  return Math.min(100, Math.max(1, n));
};

// Pure scoring step, kept separate from the database reads so it can be
// reasoned about (and tested) on its own.
export function scoreTeachers(
  lessons: LessonRow[],
  objectives: ObjectiveRow[],
  exams: ExamRow[],
  target: number
): TeacherKpaRow[] {
  const examsByLesson = new Map<number, ExamRow[]>();
  for (const e of exams) {
    const list = examsByLesson.get(e.lessonId) ?? [];
    list.push(e);
    examsByLesson.set(e.lessonId, list);
  }

  // teacher -> "classId:subjectId" -> that teacher's lessons for the pair
  const byTeacher = new Map<string, Map<string, LessonRow[]>>();
  for (const l of lessons) {
    const teacherMap = byTeacher.get(l.teacherId) ?? new Map<string, LessonRow[]>();
    const key = `${l.classId}:${l.subjectId}`;
    const list = teacherMap.get(key) ?? [];
    list.push(l);
    teacherMap.set(key, list);
    byTeacher.set(l.teacherId, teacherMap);
  }

  const rows: TeacherKpaRow[] = [];

  byTeacher.forEach((assignmentMap, teacherId) => {
    let assignments = 0;
    let assignmentsWithoutObjectives = 0;
    let totalObjectives = 0;
    let coveredObjectives = 0;
    let lessonCount = 0;
    let taggedLessons = 0;
    let name = "";

    assignmentMap.forEach((pairLessons) => {
      const first = pairLessons[0];
      name = `${first.teacher.name} ${first.teacher.surname}`;
      lessonCount += pairLessons.length;
      taggedLessons += pairLessons.filter((l) => l.objectives.length > 0).length;

      // Same rule as the Curriculum Coverage report: an objective with no
      // gradeId applies at every grade, otherwise it must match the class's.
      const applicable = objectives.filter(
        (o) =>
          o.subjectId === first.subjectId &&
          (o.gradeId === null || o.gradeId === first.class.gradeId)
      );

      if (applicable.length === 0) {
        assignmentsWithoutObjectives += 1;
        return;
      }

      const coveredIds = new Set<number>();
      for (const l of pairLessons) {
        l.objectives.forEach((o) => coveredIds.add(o.id));
        (examsByLesson.get(l.id) ?? []).forEach((e) =>
          e.objectives.forEach((o) => coveredIds.add(o.id))
        );
      }

      assignments += 1;
      totalObjectives += applicable.length;
      coveredObjectives += applicable.filter((o) => coveredIds.has(o.id)).length;
    });

    const coveragePct = pct(coveredObjectives, totalObjectives);
    rows.push({
      teacherId,
      name,
      assignments,
      assignmentsWithoutObjectives,
      totalObjectives,
      coveredObjectives,
      gaps: totalObjectives - coveredObjectives,
      coveragePct,
      lessons: lessonCount,
      taggedLessons,
      taggedPct: pct(taggedLessons, lessonCount),
      rating:
        coveragePct === null ? "noData" : coveragePct >= target ? "meets" : "below",
    });
  });

  // Lowest coverage first so the teachers who need support are at the top;
  // teachers with nothing to score sink to the bottom.
  return rows.sort((a, b) => {
    if (a.coveragePct === null && b.coveragePct === null) return a.name.localeCompare(b.name);
    if (a.coveragePct === null) return 1;
    if (b.coveragePct === null) return -1;
    return a.coveragePct - b.coveragePct || a.name.localeCompare(b.name);
  });
}

// Pure scoring step for the by-class view. Uses the same rules as
// scoreTeachers (an objective with no gradeId applies at every grade; exams
// count as coverage) but pools every teacher's lessons for a class + subject.
export function scoreClasses(
  lessons: LessonRow[],
  objectives: ObjectiveRow[],
  exams: ExamRow[],
  target: number
): ClassKpaRow[] {
  const examsByLesson = new Map<number, ExamRow[]>();
  for (const e of exams) {
    const list = examsByLesson.get(e.lessonId) ?? [];
    list.push(e);
    examsByLesson.set(e.lessonId, list);
  }

  // classId -> subjectId -> lessons of that class + subject (any teacher)
  const byClass = new Map<number, { name: string; gradeId: number; subjects: Map<number, LessonRow[]> }>();
  for (const l of lessons) {
    const entry =
      byClass.get(l.classId) ??
      { name: l.class.name, gradeId: l.class.gradeId, subjects: new Map<number, LessonRow[]>() };
    const list = entry.subjects.get(l.subjectId) ?? [];
    list.push(l);
    entry.subjects.set(l.subjectId, list);
    byClass.set(l.classId, entry);
  }

  const rows: ClassKpaRow[] = [];
  byClass.forEach((entry, classId) => {
    let totalObjectives = 0;
    let coveredObjectives = 0;
    entry.subjects.forEach((subjectLessons, subjectId) => {
      const applicable = objectives.filter(
        (o) => o.subjectId === subjectId && (o.gradeId === null || o.gradeId === entry.gradeId)
      );
      if (applicable.length === 0) return;
      const coveredIds = new Set<number>();
      for (const l of subjectLessons) {
        l.objectives.forEach((o) => coveredIds.add(o.id));
        (examsByLesson.get(l.id) ?? []).forEach((e) => e.objectives.forEach((o) => coveredIds.add(o.id)));
      }
      totalObjectives += applicable.length;
      coveredObjectives += applicable.filter((o) => coveredIds.has(o.id)).length;
    });
    const coveragePct = pct(coveredObjectives, totalObjectives);
    rows.push({
      classId,
      name: entry.name,
      totalObjectives,
      coveredObjectives,
      coveragePct,
      rating: coveragePct === null ? "noData" : coveragePct >= target ? "meets" : "below",
    });
  });

  // Lowest coverage first; classes with nothing to score sink to the bottom.
  return rows.sort((a, b) => {
    if (a.coveragePct === null && b.coveragePct === null) return a.name.localeCompare(b.name);
    if (a.coveragePct === null) return 1;
    if (b.coveragePct === null) return -1;
    return a.coveragePct - b.coveragePct || a.name.localeCompare(b.name);
  });
}

type KpaOpts = {
  // Set for a teacher viewing their own score; omit for the admin view.
  teacherId?: string;
  from?: Date;
  to?: Date;
  target: number;
};

async function loadKpaInputs(
  opts: KpaOpts
): Promise<{ lessons: LessonRow[]; objectives: ObjectiveRow[]; exams: ExamRow[] }> {
  const lessons: LessonRow[] = await prisma.lesson.findMany({
    where: opts.teacherId ? { teacherId: opts.teacherId } : {},
    select: {
      id: true,
      teacherId: true,
      classId: true,
      subjectId: true,
      teacher: { select: { name: true, surname: true } },
      class: { select: { gradeId: true, name: true } },
      objectives: { select: { id: true } },
    },
  });
  if (lessons.length === 0) return { lessons, objectives: [], exams: [] };

  const subjectIds: number[] = Array.from(new Set(lessons.map((l: LessonRow) => l.subjectId)));
  const objectives: ObjectiveRow[] = await prisma.curriculumObjective.findMany({
    where: { subjectId: { in: subjectIds } },
    select: { id: true, subjectId: true, gradeId: true },
  });

  const exams: ExamRow[] = await prisma.exam.findMany({
    where: {
      lessonId: { in: lessons.map((l: LessonRow) => l.id) },
      ...(opts.from || opts.to
        ? {
            startTime: {
              ...(opts.from ? { gte: opts.from } : {}),
              ...(opts.to ? { lte: opts.to } : {}),
            },
          }
        : {}),
    },
    select: { lessonId: true, objectives: { select: { id: true } } },
  });

  return { lessons, objectives, exams };
}

export async function getCurriculumDeliveryKpa(opts: KpaOpts): Promise<TeacherKpaRow[]> {
  const { lessons, objectives, exams } = await loadKpaInputs(opts);
  return scoreTeachers(lessons, objectives, exams, opts.target);
}

// Both views from a single database read (used by the admin School Pulse).
export async function getCurriculumDeliveryKpaBundle(
  opts: KpaOpts
): Promise<{ teachers: TeacherKpaRow[]; classes: ClassKpaRow[] }> {
  const { lessons, objectives, exams } = await loadKpaInputs(opts);
  return {
    teachers: scoreTeachers(lessons, objectives, exams, opts.target),
    classes: scoreClasses(lessons, objectives, exams, opts.target),
  };
}
