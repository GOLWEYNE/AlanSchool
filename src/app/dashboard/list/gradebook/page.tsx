import PageHero from "@/components/PageHero";
import GradebookGrid, { GradebookAssessment, GradebookStudent } from "@/components/GradebookGrid";
import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { getUserRole } from "@/lib/auth";
import { getTranslations } from "next-intl/server";

// Spreadsheet-style gradebook: students (rows) x exams/assignments
// (columns) for one class/subject, with inline per-cell editing. Admins
// pick any class/subject; teachers are scoped to the classes and subjects
// they actually teach (derived from their own Lesson rows, mirroring the
// Attendance page's class picker). A class+subject pair can resolve to more
// than one Lesson (e.g. multiple weekly periods), so every exam/assignment
// across all matching lessons becomes a column, not just one lesson's.
const GradebookPage = async ({
  searchParams,
}: {
  searchParams: { classId?: string; subjectId?: string };
}) => {
  const { userId, sessionClaims } = auth();
  const role = getUserRole(sessionClaims);
  const t = await getTranslations("List.gradebook");

  if (role !== "admin" && role !== "teacher") {
    return (
      <div className="panel-card p-4 md:p-5 rounded-md flex-1 m-4 mt-0 list-page-shell">
        <PageHero title={t("title")} subtitle={t("subtitle")} emoji={t("emoji")} stats={[]} />
        <p className="text-sm text-gray-500 dark:text-slate-400 p-4">{t("restricted")}</p>
      </div>
    );
  }

  const teacherLessons: {
    class: { id: number; name: string };
    subject: { id: number; name: string };
  }[] =
    role === "teacher" && userId
      ? await prisma.lesson.findMany({
          where: { teacherId: userId },
          select: {
            class: { select: { id: true, name: true } },
            subject: { select: { id: true, name: true } },
          },
        })
      : [];

  type IdName = { id: number; name: string };

  const classes: IdName[] =
    role === "admin"
      ? await prisma.class.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })
      : Array.from(
          new Map<number, IdName>(teacherLessons.map((l) => [l.class.id, l.class])).values()
        ).sort((a, b) => a.name.localeCompare(b.name));

  const subjects: IdName[] =
    role === "admin"
      ? await prisma.subject.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })
      : Array.from(
          new Map<number, IdName>(teacherLessons.map((l) => [l.subject.id, l.subject])).values()
        ).sort((a, b) => a.name.localeCompare(b.name));

  const selectedClassId = searchParams.classId ? parseInt(searchParams.classId, 10) : classes[0]?.id;
  const selectedSubjectId = searchParams.subjectId
    ? parseInt(searchParams.subjectId, 10)
    : subjects[0]?.id;

  let students: GradebookStudent[] = [];
  let assessments: GradebookAssessment[] = [];
  const initialScores: Record<string, number> = {};

  if (selectedClassId && selectedSubjectId) {
    const lessons: { id: number }[] = await prisma.lesson.findMany({
      where: {
        classId: selectedClassId,
        subjectId: selectedSubjectId,
        ...(role === "teacher" ? { teacherId: userId! } : {}),
      },
      select: { id: true },
    });

    const lessonIds: number[] = lessons.map((l) => l.id);

    type ExamRow = { id: number; title: string; totalMarks: number | null; startTime: Date };
    type AssignmentRow = { id: number; title: string; totalMarks: number | null; dueDate: Date };

    // An empty lessonIds still works correctly here - `in: []` simply
    // matches nothing, so no special-casing is needed for "no lessons yet".
    const [studentRows, exams, assignments]: [GradebookStudent[], ExamRow[], AssignmentRow[]] =
      await prisma.$transaction([
        prisma.student.findMany({
          where: { classId: selectedClassId },
          select: { id: true, name: true, surname: true },
          orderBy: [{ name: "asc" }, { surname: "asc" }],
        }),
        prisma.exam.findMany({
          where: { lessonId: { in: lessonIds } },
          select: { id: true, title: true, totalMarks: true, startTime: true },
          orderBy: { startTime: "asc" },
        }),
        prisma.assignment.findMany({
          where: { lessonId: { in: lessonIds } },
          select: { id: true, title: true, totalMarks: true, dueDate: true },
          orderBy: { dueDate: "asc" },
        }),
      ]);

    students = studentRows;

    assessments = [
      ...exams.map((e) => ({
        key: `exam-${e.id}`,
        id: e.id,
        type: "exam" as const,
        title: e.title,
        totalMarks: e.totalMarks,
        date: e.startTime,
      })),
      ...assignments.map((a) => ({
        key: `assignment-${a.id}`,
        id: a.id,
        type: "assignment" as const,
        title: a.title,
        totalMarks: a.totalMarks,
        date: a.dueDate,
      })),
    ].sort((a, b) => a.date.getTime() - b.date.getTime());

    const examIds = exams.map((e) => e.id);
    const assignmentIds = assignments.map((a) => a.id);

    if ((examIds.length || assignmentIds.length) && students.length) {
      const results = await prisma.result.findMany({
        where: {
          studentId: { in: students.map((s) => s.id) },
          OR: [
            ...(examIds.length ? [{ examId: { in: examIds } }] : []),
            ...(assignmentIds.length ? [{ assignmentId: { in: assignmentIds } }] : []),
          ],
        },
        select: { studentId: true, examId: true, assignmentId: true, score: true },
      });

      for (const r of results) {
        const key = r.examId
          ? `${r.studentId}:exam-${r.examId}`
          : `${r.studentId}:assignment-${r.assignmentId}`;
        initialScores[key] = r.score;
      }
    }
  }

  const filledCount = Object.keys(initialScores).length;
  const totalCells = students.length * assessments.length;
  const scoreValues = Object.values(initialScores);
  const avgScore =
    scoreValues.length > 0
      ? Math.round((scoreValues.reduce((sum, s) => sum + s, 0) / scoreValues.length) * 10) / 10
      : null;

  return (
    <div className="panel-card p-4 md:p-5 rounded-md flex-1 m-4 mt-0 list-page-shell">
      <PageHero
        title={t("title")}
        subtitle={t("subtitle")}
        emoji={t("emoji")}
        stats={[
          { label: t("studentsLabel"), value: students.length },
          { label: t("assessmentsLabel"), value: assessments.length },
          { label: t("filledLabel"), value: `${filledCount}/${totalCells || 0}` },
          { label: t("avgScoreLabel"), value: avgScore ?? "—" },
        ]}
      />

      <form
        className="panel-card p-4 rounded-md mb-4 shine-hover flex flex-wrap items-end gap-4"
        method="GET"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 dark:text-slate-400">{t("classLabel")}</label>
          <select
            name="classId"
            defaultValue={selectedClassId}
            className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2 rounded-md text-sm min-w-[10rem]"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 dark:text-slate-400">{t("subjectLabel")}</label>
          <select
            name="subjectId"
            defaultValue={selectedSubjectId}
            className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2 rounded-md text-sm min-w-[10rem]"
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <button className="bg-blue-500 text-white px-4 py-2 rounded-md text-sm font-semibold">
          {t("loadButton")}
        </button>
      </form>

      {classes.length === 0 || subjects.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400 p-4">{t("noClasses")}</p>
      ) : !selectedClassId || !selectedSubjectId ? (
        <p className="text-sm text-gray-500 dark:text-slate-400 p-4">{t("selectPrompt")}</p>
      ) : students.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400 p-4">{t("noStudents")}</p>
      ) : assessments.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400 p-4">{t("noAssessments")}</p>
      ) : (
        <GradebookGrid
          students={students}
          assessments={assessments}
          initialScores={initialScores}
          canEdit={role === "admin" || role === "teacher"}
        />
      )}
    </div>
  );
};

export default GradebookPage;
