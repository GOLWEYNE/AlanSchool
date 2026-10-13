import { getTranslations } from "next-intl/server";
import { auth } from "@clerk/nextjs/server";
import { requireRole } from "@/lib/auth";
import { routeAccessMap } from "@/lib/settings";
import { ensureDuty, getDutyPrefs, getDutySettings, getMyDuties, schoolNow, toMinutes } from "@/lib/duty";
import { CARD, Hero } from "@/components/hallPass/HallPassUi";
import MyDutyPrefs from "@/components/duty/MyDutyPrefs";

export const dynamic = "force-dynamic";

// "My Duties": today and this week for the signed-in teacher, plus notification opt-ins.
const MyDutiesPage = async () => {
  requireRole(routeAccessMap["/dashboard/list/my-duties(.*)"]);
  const { userId } = auth();
  const t = await getTranslations("Duty");
  if (!userId || !(await ensureDuty())) {
    return <div className="p-4 text-sm text-red-600">{t("tablesUnavailable")}</div>;
  }

  const [duties, prefs, settings] = await Promise.all([getMyDuties(userId), getDutyPrefs(userId), getDutySettings()]);
  const now = schoolNow(new Date(), settings.timeZone);
  const today = duties.filter((d) => d.weekday === now.weekday);
  const label = (d: (typeof duties)[number]) => t("dutyLine", { floor: d.floor, block: d.block, start: d.startTime, end: d.endTime });

  const status = (d: (typeof duties)[number]) => {
    const s = toMinutes(d.startTime) ?? 0;
    const e = toMinutes(d.endTime) ?? 0;
    if (now.minutes >= e) return "past";
    if (now.minutes >= s) return "now";
    return "upcoming";
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <Hero title={t("myTitle")} subtitle={t("mySubtitle", { date: now.date })} />

      {duties.length === 0 && <section className={CARD + " text-sm dark:text-slate-200"}>{t("notLinkedMessage")}</section>}

      <section className={CARD + " flex flex-col gap-2"}>
        <h2 className="text-lg font-semibold dark:text-slate-100">{t("today")}</h2>
        {now.weekday > 5 && <p className="text-sm text-gray-500">{t("weekend")}</p>}
        {now.weekday <= 5 && today.length === 0 && <p className="text-sm text-gray-500">{t("noDutiesToday")}</p>}
        <ul className="flex flex-col gap-2">
          {today.map((d) => {
            const st = status(d);
            return (
              <li
                key={d.assignmentId}
                className={
                  "flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm " +
                  (st === "now"
                    ? "border-green-400 bg-green-50 dark:border-green-700 dark:bg-green-950/40"
                    : st === "past"
                      ? "border-gray-200 opacity-60 dark:border-slate-700"
                      : "border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30")
                }
              >
                <span className="font-semibold dark:text-slate-100">{label(d)}</span>
                <span className="text-xs text-gray-600 dark:text-slate-300">
                  {d.coDuty.length ? t("with", { names: d.coDuty.join(", ") }) + " · " : ""}
                  {t(`status.${st}`)}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className={CARD + " flex flex-col gap-3"}>
        <h2 className="text-lg font-semibold dark:text-slate-100">{t("thisWeek")}</h2>
        {[1, 2, 3, 4, 5].map((day) => {
          const list = duties.filter((d) => d.weekday === day);
          return (
            <div key={day} className={day === now.weekday ? "rounded-lg bg-blue-50 p-2 dark:bg-blue-950/30" : "p-2"}>
              <p className="text-sm font-semibold dark:text-slate-100">{t(`days.${day}`)}</p>
              {list.length === 0 ? (
                <p className="text-xs text-gray-500">{t("noDuties")}</p>
              ) : (
                <ul className="mt-1 flex flex-wrap gap-2">
                  {list.map((d) => (
                    <li key={d.assignmentId} className="rounded-full border border-gray-200 px-3 py-1 text-xs dark:border-slate-700 dark:text-slate-200">
                      {label(d)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </section>

      <section className={CARD + " flex flex-col gap-3"}>
        <h2 className="text-lg font-semibold dark:text-slate-100">{t("notificationsTitle")}</h2>
        <p className="text-sm text-gray-600 dark:text-slate-300">
          {t("notificationsHint", { lead: settings.leadMinutes })}
        </p>
        <MyDutyPrefs initial={prefs} />
      </section>
    </div>
  );
};

export default MyDutiesPage;
