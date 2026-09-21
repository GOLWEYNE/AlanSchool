import { auth } from "@clerk/nextjs/server";
import { getFormatter, getTranslations } from "next-intl/server";
import ProtectedRoute from "@/components/ProtectedRoute";
import StudyGoals, { type StudyGoalItem } from "@/components/StudyGoals";
import prisma from "@/lib/prisma";
import { SCHOOL_UTC_LABEL, fromWallClock, toWallClock } from "@/lib/schoolTime";
import { MAX_STUDY_GOALS, getStudyGoals } from "@/lib/studyGoals";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
const UPCOMING_DAYS = 30;

type UpcomingItem = {
  key: string;
  type: "exam" | "assignment";
  title: string;
  subject: string;
  at: Date;
};

// Whole school-calendar days from today to the given instant (0 = today).
const daysFromToday = (at: Date, now: Date) => {
  const a = toWallClock(at);
  const b = toWallClock(now);
  return Math.round(
    (Date.UTC(a.year, a.month - 1, a.day) - Date.UTC(b.year, b.month - 1, b.day)) / DAY_MS
  );
};

const StudyPlannerPage = async () => {
  const t = await getTranslations("StudyPlanner");
  const format = await getFormatter();
  const { userId } = auth();
  const now = new Date();

  const student = userId
    ? await prisma.student.findUnique({
        where: { id: userId },
        select: { classId: true, class: { select: { name: true } } },
      })
    : null;
  const classId = student?.classId;

  // Subjects the student's class has lessons in (for tagging a goal).
  const subjectRows = classId
    ? await prisma.lesson.findMany({
        where: { classId },
        select: { subject: { select: { id: true, name: true } } },
        distinct: ["subjectId"],
      })
    : [];
  const subjects = subjectRows
    .map((r) => r.subject)
    .sort((a, b) => a.name.localeCompare(b.name));

  // What is coming up in the next month: exams and assignment deadlines.
  const horizon = new Date(now.getTime() + UPCOMING_DAYS * DAY_MS);
  const [exams, assignments] = classId
    ? await Promise.all([
        prisma.exam.findMany({
          where: { lesson: { classId }, startTime: { gte: now, lte: horizon } },
          include: { lesson: { include: { subject: { select: { name: true } } } } },
          orderBy: { startTime: "asc" },
        }),
        prisma.assignment.findMany({
          where: { lesson: { classId }, dueDate: { gte: now, lte: horizon } },
          include: { lesson: { include: { subject: { select: { name: true } } } } },
          orderBy: { dueDate: "asc" },
        }),
      ])
    : [[], []];

  const forMe = (ids: string[]) => ids.length === 0 || (userId ? ids.includes(userId) : false);
  const upcoming: UpcomingItem[] = [
    ...exams
      .filter((e) => forMe(e.targetStudentIds))
      .map((e) => ({
        key: `exam-${e.id}`,
        type: "exam" as const,
        title: e.title,
        subject: e.lesson.subject.name,
        at: e.startTime,
      })),
    ...assignments
      .filter((a) => forMe(a.targetStudentIds))
      .map((a) => ({
        key: `assignment-${a.id}`,
        type: "assignment" as const,
        title: a.title,
        subject: a.lesson.subject.name,
        at: a.dueDate,
      })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  // Personal goals. If the table cannot be read, show a notice instead of failing the page.
  let goals: StudyGoalItem[] = [];
  let goalsUnavailable = false;
  if (userId) {
    try {
      const startOfToday = fromWallClock(toWallClock(now));
      goals = (await getStudyGoals(userId)).map((g) => ({
        id: g.id,
        title: g.title,
        subjectName: g.subjectName,
        targetDate: g.targetDate,
        progress: g.progress,
        completedAt: g.completedAt,
        overdue: !g.completedAt && !!g.targetDate && new Date(g.targetDate) < startOfToday,
      }));
    } catch (error) {
      console.error("Study goals could not be loaded", error);
      goalsUnavailable = true;
    }
  }

  return (
    <ProtectedRoute allowedRoles={["student"]}>
      <div className="p-4 flex flex-col gap-4">
        <div className="rounded-2xl p-6 text-white shadow-lg bg-gradient-to-r from-yellow-400 via-blue-500 to-blue-400">
          <h1 className="text-3xl font-bold mb-2">📅 {t("title")}</h1>
          <p className="text-blue-50">{t("subtitle")}</p>
          {student?.class?.name && (
            <div className="mt-3">
              <span className="rounded-full bg-white/90 text-blue-900 px-3 py-1 text-xs font-semibold">
                {t("classLabel")}: {student.class.name}
              </span>
            </div>
          )}
        </div>

        <div className="flex gap-4 flex-col xl:flex-row">
          {/* GOALS */}
          <section className="w-full xl:w-2/3 panel-card p-6 rounded-lg shadow-md border-t-4 border-blue-400">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-blue-100">{t("goals.title")}</h2>
              <p className="text-sm text-gray-500 dark:text-slate-400">{t("goals.subtitle")}</p>
            </div>
            <StudyGoals
              goals={goals}
              subjects={subjects}
              maxGoals={MAX_STUDY_GOALS}
              unavailable={goalsUnavailable}
            />
          </section>

          <div className="w-full xl:w-1/3 flex flex-col gap-4">
            {/* CALENDAR EXPORT */}
            <section className="panel-card p-6 rounded-lg shadow-md border-t-4 border-yellow-400">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-blue-100">{t("export.title")}</h2>
              <p className="mt-2 text-sm text-gray-600 dark:text-slate-300">
                {classId ? t("export.description") : t("noClass")}
              </p>
              {classId && (
                <>
                  <a
                    href="/api/study-planner/calendar"
                    download
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    ⬇ {t("export.button")}
                  </a>
                  <p className="mt-3 text-xs text-gray-500 dark:text-slate-400">
                    {t("export.hint", { zone: SCHOOL_UTC_LABEL })}
                  </p>
                  <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">{t("export.howTo")}</p>
                </>
              )}
            </section>

            {/* COMING UP */}
            <section className="panel-card p-6 rounded-lg shadow-md border-t-4 border-blue-400">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-blue-100">{t("upcoming.title")}</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">
                {t("upcoming.subtitle", { days: UPCOMING_DAYS })}
              </p>
              {upcoming.length === 0 ? (
                <p className="rounded-xl border border-dashed border-blue-100 dark:border-slate-800 p-4 text-center text-sm text-gray-400 dark:text-slate-500">
                  {t("upcoming.empty")}
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {upcoming.map((item) => {
                    const days = daysFromToday(item.at, now);
                    return (
                      <li
                        key={item.key}
                        className="rounded-xl border border-blue-50 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              item.type === "exam"
                                ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300"
                                : "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300"
                            }`}
                          >
                            {item.type === "exam" ? t("upcoming.exam") : t("upcoming.assignment")}
                          </span>
                          <span className="text-[11px] font-medium text-blue-600 dark:text-blue-300">
                            {t("upcoming.inDays", { count: days })}
                          </span>
                        </div>
                        <div className="mt-1 font-semibold text-gray-800 dark:text-blue-100 break-words">{item.title}</div>
                        <div className="text-xs text-gray-500 dark:text-slate-400">
                          {item.subject} ·{" "}
                          {format.dateTime(item.at, { dateStyle: "medium", timeStyle: "short" })}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default StudyPlannerPage;
