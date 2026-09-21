import Link from "next/link";
import { getTranslations } from "next-intl/server";
import ProtectedRoute from "@/components/ProtectedRoute";
import LessonTimeRepairPanel from "@/components/LessonTimeRepairPanel";
import { BELL_SCHEDULE, type BellGroup } from "@/lib/bellSchedule";
import { getLessonTimeStatus, type LessonTimeStatus } from "@/lib/lessonTimeRepair";
import { SCHOOL_UTC_LABEL } from "@/lib/schoolTime";

export const dynamic = "force-dynamic";

const DAY_ORDER = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
const MAX_OFF_ROWS = 200;
const GROUPS: BellGroup[] = ["junior", "upper"];

const LessonTimesPage = async () => {
  const t = await getTranslations("LessonTimes");
  const common = await getTranslations("Common");

  let status: LessonTimeStatus | null = null;
  try {
    status = await getLessonTimeStatus();
  } catch (error) {
    console.error("Lesson time status could not be loaded", error);
  }

  const off = status
    ? [...status.off].sort(
        (a, b) =>
          a.className.localeCompare(b.className, undefined, { numeric: true }) ||
          DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day) ||
          a.start.localeCompare(b.start)
      )
    : [];

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <div className="p-4 flex flex-col gap-4">
        <div className="rounded-2xl p-6 text-white shadow-lg bg-gradient-to-r from-yellow-400 via-blue-500 to-blue-400">
          <h1 className="text-3xl font-bold mb-2">🕘 {t("title")}</h1>
          <p className="text-blue-50">{t("subtitle", { zone: SCHOOL_UTC_LABEL })}</p>
        </div>

        {/* THE ROUTINE */}
        <section className="panel-card p-6 rounded-lg shadow-md border-t-4 border-blue-400">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-blue-100">{t("routine.title")}</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">{t("routine.subtitle")}</p>
          <div className="grid gap-4 md:grid-cols-2">
            {GROUPS.map((group) => (
              <div
                key={group}
                className="rounded-xl border border-blue-100 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4"
              >
                <h3 className="font-semibold text-gray-800 dark:text-blue-100">{t(`routine.${group}.title`)}</h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">{t(`routine.${group}.classes`)}</p>
                <table className="w-full text-sm">
                  <tbody>
                    {BELL_SCHEDULE[group].map((p) => (
                      <tr key={p.n} className="border-t border-blue-50 dark:border-slate-800 text-gray-800 dark:text-slate-200">
                        <td className="py-1 pr-3 text-gray-500 dark:text-slate-400">{t("routine.lesson", { n: p.n })}</td>
                        <td className="py-1 font-medium">
                          {p.start} – {p.end}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </section>

        {/* REPAIR */}
        <section className="panel-card p-6 rounded-lg shadow-md border-t-4 border-yellow-400">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-blue-100">{t("repair.title")}</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
            {status ? t("repair.summary", { onRoutine: status.onRoutine, total: status.total }) : t("repair.description")}
          </p>
          {status ? (
            <LessonTimeRepairPanel
              pendingCount={status.pending.count}
              classCount={status.pending.classCount}
              slots={status.pending.slots}
              appliedCount={status.applied.count}
              appliedAt={status.applied.savedAt}
            />
          ) : (
            <p className="rounded-xl border border-dashed border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4 text-sm text-amber-800 dark:text-amber-300">
              {t("repair.errors.unavailable")}
            </p>
          )}
        </section>

        {/* LESSONS OFF THE ROUTINE */}
        {status && (
          <section className="panel-card p-6 rounded-lg shadow-md border-t-4 border-blue-400">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-blue-100">{t("off.title")}</h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">{t("off.subtitle")}</p>
            {off.length === 0 ? (
              <p className="rounded-xl border border-dashed border-emerald-200 dark:border-emerald-900/50 p-4 text-center text-sm text-emerald-700 dark:text-emerald-300">
                {t("off.empty")}
              </p>
            ) : (
              <>
                <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  {t("off.count", { count: off.length })}
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">
                        <th className="py-2 pr-4">{t("off.colClass")}</th>
                        <th className="py-2 pr-4">{t("off.colDay")}</th>
                        <th className="py-2 pr-4">{t("off.colSubject")}</th>
                        <th className="py-2 pr-4">{t("off.colTime")}</th>
                        <th className="py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {off.slice(0, MAX_OFF_ROWS).map((l) => (
                        <tr key={l.id} className="border-t border-blue-50 dark:border-slate-800 text-gray-800 dark:text-slate-200">
                          <td className="py-1.5 pr-4 font-medium">{l.className}</td>
                          <td className="py-1.5 pr-4">{common(`days.${l.day.toLowerCase()}`)}</td>
                          <td className="py-1.5 pr-4">{l.subjectName}</td>
                          <td className="py-1.5 pr-4">
                            {l.start} – {l.end}
                          </td>
                          <td className="py-1.5 text-right">
                            <Link
                              href={`/dashboard/list/lessons?classId=${l.classId}`}
                              className="text-xs font-semibold text-blue-600 dark:text-blue-300 hover:underline"
                            >
                              {t("off.open")}
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {off.length > MAX_OFF_ROWS && (
                  <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">
                    {t("off.truncated", { shown: MAX_OFF_ROWS, total: off.length })}
                  </p>
                )}
              </>
            )}
          </section>
        )}
      </div>
    </ProtectedRoute>
  );
};

export default LessonTimesPage;
