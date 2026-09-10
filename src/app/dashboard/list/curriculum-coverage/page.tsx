import PageHero from "@/components/PageHero";
import Table from "@/components/Table";
import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { getUserRole } from "@/lib/auth";
import { getTranslations } from "next-intl/server";

type IdName = { id: number; name: string };

// Which of a subject's curriculum objectives a class has actually been
// taught/assessed against, for a class+subject (and optionally a term's
// date range). Lessons are a recurring weekly slot with no calendar date of
// their own (see the timetable feature), so a tagged Lesson always counts -
// it's the standing plan for that class/subject; a tagged Exam only counts
// when its date falls inside the picked range, which is what lets this
// double as a "coverage over a term" report without needing a separate
// term-calendar concept the app doesn't otherwise have.
const CurriculumCoveragePage = async ({
  searchParams,
}: {
  searchParams: { classId?: string; subjectId?: string; from?: string; to?: string };
}) => {
  const { userId, sessionClaims } = auth();
  const role = getUserRole(sessionClaims);
  const t = await getTranslations("List.curriculumCoverage");

  if (role !== "admin" && role !== "teacher") {
    return (
      <div className="panel-card p-4 md:p-5 rounded-md flex-1 m-4 mt-0 list-page-shell">
        <PageHero title={t("title")} subtitle={t("subtitle")} emoji={t("emoji")} stats={[]} />
        <p className="text-sm text-gray-500 dark:text-slate-400 p-4">{t("restricted")}</p>
      </div>
    );
  }

  const teacherLessons: { class: IdName; subject: IdName }[] =
    role === "teacher" && userId
      ? await prisma.lesson.findMany({
          where: { teacherId: userId },
          select: {
            class: { select: { id: true, name: true } },
            subject: { select: { id: true, name: true } },
          },
        })
      : [];

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
  const fromDate = searchParams.from ? new Date(searchParams.from) : undefined;
  // Include the whole "to" day, not just its midnight.
  const toDate = searchParams.to ? new Date(`${searchParams.to}T23:59:59`) : undefined;

  type ObjectiveRow = {
    id: number;
    code: string | null;
    title: string;
    strand: string | null;
    coveredByLessons: string[];
    coveredByExams: string[];
  };

  let objectiveRows: ObjectiveRow[] = [];

  if (selectedClassId && selectedSubjectId) {
    const selectedClass = await prisma.class.findUnique({
      where: { id: selectedClassId },
      select: { gradeId: true },
    });

    type ObjectiveDef = { id: number; code: string | null; title: string; strand: string | null };

    const objectives: ObjectiveDef[] = await prisma.curriculumObjective.findMany({
      where: {
        subjectId: selectedSubjectId,
        // An objective with no gradeId applies at every grade; otherwise it
        // has to match the selected class's own grade.
        OR: [{ gradeId: null }, { gradeId: selectedClass?.gradeId }],
      },
      select: { id: true, code: true, title: true, strand: true },
      orderBy: [{ strand: "asc" }, { title: "asc" }],
    });

    type TaggedLesson = { id: number; name: string; objectives: { id: number }[] };
    type TaggedExam = { id: number; title: string; objectives: { id: number }[] };

    const lessons: TaggedLesson[] = await prisma.lesson.findMany({
      where: {
        classId: selectedClassId,
        subjectId: selectedSubjectId,
        ...(role === "teacher" ? { teacherId: userId! } : {}),
      },
      select: {
        id: true,
        name: true,
        objectives: { select: { id: true } },
      },
    });
    const lessonIds = lessons.map((l: TaggedLesson) => l.id);

    const exams: TaggedExam[] = await prisma.exam.findMany({
      where: {
        lessonId: { in: lessonIds },
        ...(fromDate || toDate
          ? { startTime: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } }
          : {}),
      },
      select: {
        id: true,
        title: true,
        objectives: { select: { id: true } },
      },
    });

    objectiveRows = objectives.map((o: ObjectiveDef) => ({
      id: o.id,
      code: o.code,
      title: o.title,
      strand: o.strand,
      coveredByLessons: lessons
        .filter((l: TaggedLesson) => l.objectives.some((tag: { id: number }) => tag.id === o.id))
        .map((l: TaggedLesson) => l.name),
      coveredByExams: exams
        .filter((e: TaggedExam) => e.objectives.some((tag: { id: number }) => tag.id === o.id))
        .map((e: TaggedExam) => e.title),
    }));
  }

  const coveredCount = objectiveRows.filter(
    (o) => o.coveredByLessons.length > 0 || o.coveredByExams.length > 0
  ).length;
  const totalCount = objectiveRows.length;
  const coveragePct = totalCount > 0 ? Math.round((coveredCount / totalCount) * 100) : null;

  const columns = [
    { header: t("columns.objective"), accessor: "objective" },
    { header: t("columns.strand"), accessor: "strand", className: "hidden md:table-cell" },
    { header: t("columns.status"), accessor: "status" },
    { header: t("columns.coveredBy"), accessor: "coveredBy", className: "hidden lg:table-cell" },
  ];

  const renderRow = (item: ObjectiveRow) => {
    const isCovered = item.coveredByLessons.length > 0 || item.coveredByExams.length > 0;
    const sources = [
      ...item.coveredByLessons.map((n) => `${t("lessonBadge")}: ${n}`),
      ...item.coveredByExams.map((n) => `${t("examBadge")}: ${n}`),
    ];
    return (
      <tr
        key={item.id}
        className="border-b border-gray-200 dark:border-slate-800 even:bg-slate-50 dark:even:bg-slate-900/40 text-sm"
      >
        <td className="flex items-center gap-4 p-4">
          {item.code ? `${item.code} - ${item.title}` : item.title}
        </td>
        <td className="hidden md:table-cell">{item.strand ?? "-"}</td>
        <td>
          <span
            className={`text-xs font-semibold px-2 py-1 rounded-full ${
              isCovered
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
            }`}
          >
            {isCovered ? t("covered") : t("gap")}
          </span>
        </td>
        <td className="hidden lg:table-cell text-xs text-gray-500 dark:text-slate-400">
          {sources.length > 0 ? sources.join(", ") : "-"}
        </td>
      </tr>
    );
  };

  return (
    <div className="panel-card p-4 md:p-5 rounded-md flex-1 m-4 mt-0 list-page-shell">
      <PageHero
        title={t("title")}
        subtitle={t("subtitle")}
        emoji={t("emoji")}
        stats={[
          { label: t("objectivesLabel"), value: totalCount },
          { label: t("coveredLabel"), value: coveredCount },
          { label: t("gapsLabel"), value: totalCount - coveredCount },
          { label: t("coverageLabel"), value: coveragePct !== null ? `${coveragePct}%` : "—" },
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
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 dark:text-slate-400">{t("fromLabel")}</label>
          <input
            type="date"
            name="from"
            defaultValue={searchParams.from ?? ""}
            className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2 rounded-md text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 dark:text-slate-400">{t("toLabel")}</label>
          <input
            type="date"
            name="to"
            defaultValue={searchParams.to ?? ""}
            className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2 rounded-md text-sm"
          />
        </div>
        <button className="bg-blue-500 text-white px-4 py-2 rounded-md text-sm font-semibold">
          {t("loadButton")}
        </button>
      </form>
      <p className="text-xs text-gray-400 dark:text-slate-500 -mt-2 mb-4">{t("dateRangeHint")}</p>

      {classes.length === 0 || subjects.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400 p-4">{t("noClasses")}</p>
      ) : !selectedClassId || !selectedSubjectId ? (
        <p className="text-sm text-gray-500 dark:text-slate-400 p-4">{t("selectPrompt")}</p>
      ) : objectiveRows.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400 p-4">{t("noObjectives")}</p>
      ) : (
        <Table columns={columns} renderRow={renderRow} data={objectiveRows} />
      )}
    </div>
  );
};

export default CurriculumCoveragePage;
