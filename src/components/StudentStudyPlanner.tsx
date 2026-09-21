import { getFormatter, getTranslations } from "next-intl/server";
import { SCHOOL_UTC_LABEL } from "@/lib/schoolTime";
import { getStudyGoals, type StudyGoalView } from "@/lib/studyGoals";
import {
  UPCOMING_DAYS,
  daysFromToday,
  getUpcomingItems,
  startOfSchoolDay,
  type UpcomingItem,
} from "@/lib/studyUpcoming";

// Staff view of a student's Study Planner (shown on the student's profile to
// admins and teachers): the student's goals and what is coming up, read-only,
// plus the same .ics calendar export the student gets. Only the student can
// change their own goals.

type Props = {
  studentId: string;
  studentName: string;
  classId: number;
};

const StudentStudyPlanner = async ({ studentId, studentName, classId }: Props) => {
  const t = await getTranslations("StudyPlanner");
  const format = await getFormatter();
  const now = new Date();

  let upcoming: UpcomingItem[] = [];
  try {
    upcoming = await getUpcomingItems(studentId, classId, now);
  } catch (error) {
    console.error("Upcoming items could not be loaded for the study planner view", error);
  }

  // If the goals table cannot be read, say so instead of failing the whole profile page.
  let goals: StudyGoalView[] = [];
  let goalsUnavailable = false;
  try {
    goals = await getStudyGoals(studentId);
  } catch (error) {
    console.error("Study goals could not be loaded for the study planner view", error);
    goalsUnavailable = true;
  }

  const startOfToday = startOfSchoolDay(now);
  const done = goals.filter((g) => g.completedAt !== null);
  const open = goals.filter((g) => g.completedAt === null);
  const average = goals.length
    ? Math.round(goals.reduce((sum, g) => sum + g.progress, 0) / goals.length)
    : 0;
  const dateLabel = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "medium" });

  const renderGoal = (goal: StudyGoalView) => {
    const finished = goal.completedAt !== null;
    const overdue = !finished && !!goal.targetDate && new Date(goal.targetDate) < startOfToday;
    return (
      <li
        key={goal.id}
        className={`rounded-xl border p-3 ${
          finished
            ? "border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-950/20"
            : "border-blue-100 dark:border-slate-800 bg-white dark:bg-slate-900/60"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h4
              className={`font-semibold break-words ${
                finished
                  ? "text-emerald-800 dark:text-emerald-300"
                  : "text-gray-800 dark:text-blue-100"
              }`}
            >
              {finished ? "✓ " : ""}
              {goal.title}
            </h4>
            <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] font-medium">
              {goal.subjectName && (
                <span className="rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-2 py-0.5">
                  {goal.subjectName}
                </span>
              )}
              {goal.targetDate && !finished && (
                <span
                  className={`rounded-full px-2 py-0.5 ${
                    overdue
                      ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300"
                      : "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300"
                  }`}
                >
                  {overdue ? t("goals.overdue") : t("goals.due", { date: dateLabel(goal.targetDate) })}
                </span>
              )}
              {finished && goal.completedAt && (
                <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5">
                  {t("goals.doneOn", { date: dateLabel(goal.completedAt) })}
                </span>
              )}
            </div>
          </div>
          <span className="shrink-0 text-sm font-semibold text-blue-700 dark:text-blue-300">
            {goal.progress}%
          </span>
        </div>
        <div
          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-slate-800"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={goal.progress}
          aria-label={t("goals.progressLabel")}
        >
          <div
            className={`h-full rounded-full ${
              finished ? "bg-emerald-500" : "bg-gradient-to-r from-yellow-400 to-blue-500"
            }`}
            style={{ width: `${goal.progress}%` }}
          />
        </div>
      </li>
    );
  };

  return (
    <section
      id="study-planner"
      className="bg-white dark:bg-slate-900 rounded-md p-4 flex flex-col gap-4 border-t-4 border-blue-400"
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-blue-900 dark:text-blue-100">📅 {t("title")}</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {t("staff.subtitle", { name: studentName })}
          </p>
        </div>
        <div className="flex flex-col gap-1 md:items-end">
          <a
            href={`/api/study-planner/calendar?studentId=${encodeURIComponent(studentId)}`}
            download
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            ⬇ {t("export.button")}
          </a>
          <span className="text-xs text-gray-500 dark:text-slate-400 md:text-right md:max-w-xs">
            {t("export.hint", { zone: SCHOOL_UTC_LABEL })}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-4 xl:flex-row">
        {/* GOALS (read-only) */}
        <div className="w-full xl:w-2/3 flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-blue-100">{t("staff.goalsTitle")}</h2>
          {goalsUnavailable ? (
            <p className="rounded-xl border border-dashed border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4 text-sm text-amber-800 dark:text-amber-300">
              {t("goals.errors.unavailable")}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 p-3">
                  <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">{goals.length}</div>
                  <div className="text-[11px] uppercase tracking-wide text-blue-700 dark:text-blue-300">
                    {t("goals.stats.total")}
                  </div>
                </div>
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 p-3">
                  <div className="text-2xl font-bold text-emerald-800 dark:text-emerald-200">{done.length}</div>
                  <div className="text-[11px] uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                    {t("goals.stats.done")}
                  </div>
                </div>
                <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 p-3">
                  <div className="text-2xl font-bold text-amber-800 dark:text-amber-200">{average}%</div>
                  <div className="text-[11px] uppercase tracking-wide text-amber-700 dark:text-amber-300">
                    {t("goals.stats.average")}
                  </div>
                </div>
              </div>

              {goals.length === 0 ? (
                <p className="rounded-xl border border-dashed border-blue-100 dark:border-slate-800 p-6 text-center text-sm text-gray-400 dark:text-slate-500">
                  {t("staff.noGoals", { name: studentName })}
                </p>
              ) : (
                <>
                  {open.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-blue-100">{t("goals.active")}</h3>
                      <ul className="flex flex-col gap-2">{open.map(renderGoal)}</ul>
                    </div>
                  )}
                  {done.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-blue-100">{t("goals.completed")}</h3>
                      <ul className="flex flex-col gap-2">{done.map(renderGoal)}</ul>
                    </div>
                  )}
                </>
              )}
              <p className="text-xs text-gray-400 dark:text-slate-500">{t("staff.readOnly")}</p>
            </>
          )}
        </div>

        {/* COMING UP */}
        <div className="w-full xl:w-1/3 flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-blue-100">{t("upcoming.title")}</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            {t("upcoming.subtitle", { days: UPCOMING_DAYS })}
          </p>
          {upcoming.length === 0 ? (
            <p className="rounded-xl border border-dashed border-blue-100 dark:border-slate-800 p-4 text-center text-sm text-gray-400 dark:text-slate-500">
              {t("upcoming.empty")}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {upcoming.map((item) => (
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
                      {t("upcoming.inDays", { count: daysFromToday(item.at, now) })}
                    </span>
                  </div>
                  <div className="mt-1 font-semibold text-gray-800 dark:text-blue-100 break-words">{item.title}</div>
                  <div className="text-xs text-gray-500 dark:text-slate-400">
                    {item.subject} · {format.dateTime(item.at, { dateStyle: "medium", timeStyle: "short" })}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
};

export default StudentStudyPlanner;
