import Link from "next/link";
import { getTranslations } from "next-intl/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { routeAccessMap } from "@/lib/settings";
import { addDays, schoolToday, toDbDate } from "@/lib/uniform";
import {
  RISK_RULES,
  classDailyRates,
  computeRiskReasons,
  summariseAttendance,
  type RiskReason,
} from "@/lib/supervisorRisk";

type SP = { [key: string]: string | undefined };
type TFn = (key: string, values?: Record<string, string | number>) => string;

const CARD =
  "rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900";
const TREND_DAYS = 28;

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

const BEHAVIOR_BADGE: Record<string, string> = {
  POSITIVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  CONCERN: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  INCIDENT: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};

const UNIFORM_BADGE: Record<string, string> = {
  FULL: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  PARTIAL: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  NONE: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};

function reasonText(r: RiskReason, t: TFn): string {
  switch (r.kind) {
    case "absences":
      return t("reason.absences", { days: r.days });
    case "attendanceRate":
      return t("reason.attendanceRate", { percent: r.percent });
    case "behaviorConcerns":
      return t("reason.behaviorConcerns", { count: r.count });
    case "incident":
      return t("reason.incident", { count: r.count });
    case "uniform":
      return t("reason.uniform", { days: r.days });
  }
}

const pct = (n: number | null) => (n === null ? "-" : Math.round(n * 100) + "%");

const MyClassPage = async ({ searchParams }: { searchParams: Promise<SP> | SP }) => {
  const { userId, role } = await requireRole(routeAccessMap["/dashboard/list/my-class(.*)"]);
  const t = (await getTranslations("MyClass")) as unknown as TFn;
  const sp = await Promise.resolve(searchParams);
  const isAdmin = role === "admin";

  // Admins can open any class; a teacher only the classes they supervise.
  const classes = await prisma.class.findMany({
    where: isAdmin ? {} : { supervisorId: userId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      supervisor: { select: { name: true, surname: true } },
    },
  });

  const hero = (
    <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-amber-400 p-5 text-white">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="mt-1 text-sm opacity-90">{isAdmin ? t("subtitleAdmin") : t("subtitle")}</p>
    </div>
  );

  if (classes.length === 0) {
    return (
      <div className="flex flex-col gap-4 p-4">
        {hero}
        <p className={CARD + " text-sm text-gray-600 dark:text-slate-300"}>{t("noClass")}</p>
      </div>
    );
  }

  const requested = parseInt(sp.classId ?? "", 10);
  const selected = classes.find((c) => c.id === requested) ?? classes[0];

  const today = schoolToday();
  const since28 = addDays(today, -(TREND_DAYS - 1));
  const sinceAttendance = addDays(today, -(RISK_RULES.attendanceWindowDays - 1));
  const sinceBehavior = addDays(today, -(RISK_RULES.behaviorWindowDays - 1));
  const sinceIncident = addDays(today, -(RISK_RULES.recentIncidentDays - 1));
  const sinceUniform = addDays(today, -(RISK_RULES.uniformWindowDays - 1));

  const students = await prisma.student.findMany({
    where: { classId: selected.id },
    orderBy: [{ surname: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      surname: true,
      parent: { select: { name: true, surname: true, phone: true, email: true } },
    },
  });
  const ids = students.map((s) => s.id);

  const [attendanceRows, behaviorRows, uniformRows] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: { studentId: { in: ids }, date: { gte: toDbDate(since28) } },
      select: { studentId: true, date: true, status: true },
    }),
    prisma.behaviorLog.findMany({
      where: { studentId: { in: ids }, date: { gte: toDbDate(sinceBehavior) } },
      orderBy: { date: "desc" },
      select: {
        id: true,
        studentId: true,
        type: true,
        title: true,
        description: true,
        date: true,
        teacher: { select: { name: true, surname: true } },
      },
    }),
    prisma.uniformCheck.findMany({
      where: { studentId: { in: ids }, date: { gte: toDbDate(sinceUniform) } },
      select: { studentId: true, date: true, status: true, missingItems: true },
    }),
  ]);

  const attendance = attendanceRows.map((r) => ({
    studentId: r.studentId,
    day: dayKey(r.date),
    status: r.status,
  }));
  const behavior = behaviorRows.map((b) => ({
    studentId: b.studentId,
    day: dayKey(b.date),
    type: b.type,
  }));
  const uniform = uniformRows.map((u) => ({
    studentId: u.studentId,
    day: dayKey(u.date),
    status: u.status,
    missingItems: u.missingItems,
  }));

  // ---- per-student roll-up -------------------------------------------------
  const roster = students.map((s) => {
    const myAttendance = attendance.filter((a) => a.studentId === s.id);
    const myBehavior = behavior.filter((b) => b.studentId === s.id);
    const myUniform = uniform.filter((u) => u.studentId === s.id);
    const att = summariseAttendance(myAttendance, sinceAttendance);
    const reasons = computeRiskReasons({
      attendance: myAttendance,
      behavior: myBehavior,
      uniform: myUniform,
      sinceAttendance,
      sinceBehavior,
      sinceIncident,
      sinceUniform,
    });
    return {
      ...s,
      att,
      positives: myBehavior.filter((b) => b.type === "POSITIVE").length,
      negatives: myBehavior.filter((b) => b.type !== "POSITIVE").length,
      uniformBad: new Set(myUniform.filter((u) => u.status !== "FULL").map((u) => u.day)).size,
      reasons,
    };
  });

  const atRisk = roster
    .filter((r) => r.reasons.length > 0)
    .sort((a, b) => b.reasons.length - a.reasons.length || a.surname.localeCompare(b.surname));

  // ---- class-level numbers -------------------------------------------------
  const trendDays = Array.from({ length: TREND_DAYS }, (_, i) => addDays(since28, i));
  const trend = classDailyRates(attendance, trendDays);
  const recordedTrend = trend.filter((d) => d.rate !== null);
  const last7 = recordedTrend.filter((d) => d.day >= addDays(today, -6));
  const week7Attended = last7.reduce((n, d) => n + d.attended, 0);
  const week7Total = last7.reduce((n, d) => n + d.attended + d.absent, 0);
  const weekRate = week7Total === 0 ? null : week7Attended / week7Total;

  const todayUniform = uniform.filter((u) => u.day === today);
  const todayFull = todayUniform.filter((u) => u.status === "FULL").length;
  const todayNotFull = todayUniform.filter((u) => u.status !== "FULL");
  const uniformToday = todayUniform.length === 0 ? null : todayFull / todayUniform.length;

  const concerns30 = behavior.filter((b) => b.type !== "POSITIVE").length;
  const recentNotes = behaviorRows.slice(0, 8);
  const nameOf = new Map<string, string>(
    students.map((s): [string, string] => [s.id, s.name + " " + s.surname])
  );

  const uniformDays = Array.from({ length: RISK_RULES.uniformWindowDays }, (_, i) =>
    addDays(sinceUniform, i)
  );
  const uniformByDay = uniformDays.map((d) => {
    const rows = uniform.filter((u) => u.day === d);
    return {
      d,
      total: rows.length,
      full: rows.filter((r) => r.status === "FULL").length,
    };
  });

  const classQuery = "?classId=" + selected.id;

  return (
    <div className="flex flex-col gap-4 p-4">
      {hero}

      <div className={CARD}>
        <form method="get" className="flex flex-wrap items-end gap-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">{t("class")}</span>
            <select
              name="classId"
              defaultValue={selected.id}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-lg bg-slate-800 px-4 py-2 font-medium text-white hover:bg-slate-700"
          >
            {t("open")}
          </button>
          {selected.supervisor && (
            <span className="text-gray-500">
              {t("supervisor", { name: selected.supervisor.name + " " + selected.supervisor.surname })}
            </span>
          )}
          <div className="ml-auto flex flex-wrap gap-2">
            <Link
              href={"/dashboard/list/attendance"}
              className="rounded-lg border border-blue-300 px-3 py-2 font-medium text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/30"
            >
              {t("goAttendance")}
            </Link>
            <Link
              href={"/dashboard/list/behavior-log"}
              className="rounded-lg border border-blue-300 px-3 py-2 font-medium text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/30"
            >
              {t("goBehavior")}
            </Link>
            <Link
              href={"/dashboard/list/uniform" + classQuery}
              className="rounded-lg border border-blue-300 px-3 py-2 font-medium text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/30"
            >
              {t("goUniform")}
            </Link>
          </div>
        </form>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <div className={CARD}>
          <p className="text-xs text-gray-500">{t("cards.students")}</p>
          <p className="text-3xl font-bold dark:text-slate-100">{students.length}</p>
        </div>
        <div className={CARD}>
          <p className="text-xs text-gray-500">{t("cards.attendanceWeek")}</p>
          <p className="text-3xl font-bold text-emerald-600">{pct(weekRate)}</p>
        </div>
        <div className={CARD}>
          <p className="text-xs text-gray-500">{t("cards.uniformToday")}</p>
          <p className="text-3xl font-bold text-emerald-600">{pct(uniformToday)}</p>
        </div>
        <div className={CARD}>
          <p className="text-xs text-gray-500">{t("cards.concerns")}</p>
          <p className={"text-3xl font-bold " + (concerns30 ? "text-amber-600" : "text-emerald-600")}>
            {concerns30}
          </p>
        </div>
        <div className={CARD}>
          <p className="text-xs text-gray-500">{t("cards.atRisk")}</p>
          <p className={"text-3xl font-bold " + (atRisk.length ? "text-rose-600" : "text-emerald-600")}>
            {atRisk.length}
          </p>
        </div>
      </div>

      {/* At-risk students */}
      <div className={CARD}>
        <h2 className="text-lg font-semibold dark:text-slate-100">{t("atRiskTitle")}</h2>
        <p className="mb-3 text-xs text-gray-500">
          {t("atRiskHint", {
            absent: RISK_RULES.absentDays,
            behavior: RISK_RULES.negativeBehaviorEntries,
            uniform: RISK_RULES.uniformNonCompliantDays,
          })}
        </p>
        {atRisk.length === 0 ? (
          <p className="text-sm text-gray-500">{t("noAtRisk")}</p>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm dark:divide-slate-800">
            {atRisk.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2">
                <Link
                  href={"/dashboard/list/students/" + s.id}
                  className="font-medium text-blue-700 hover:underline dark:text-blue-300"
                >
                  {s.name} {s.surname}
                </Link>
                <span className="flex flex-wrap gap-1.5">
                  {s.reasons.map((r) => (
                    <span
                      key={r.kind}
                      className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                    >
                      {reasonText(r, t)}
                    </span>
                  ))}
                </span>
                <span className="ml-auto text-gray-500">
                  {s.parent.name} {s.parent.surname}{" "}
                  <a href={"tel:" + s.parent.phone} className="text-blue-700 hover:underline dark:text-blue-300">
                    {s.parent.phone}
                  </a>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Attendance trend */}
        <div className={CARD}>
          <h2 className="mb-3 text-lg font-semibold dark:text-slate-100">
            {t("attendanceTrend", { days: TREND_DAYS })}
          </h2>
          {recordedTrend.length === 0 ? (
            <p className="text-sm text-gray-500">{t("noAttendance")}</p>
          ) : (
            <>
              <div className="flex h-36 items-end gap-0.5" role="img" aria-label={t("attendanceTrend", { days: TREND_DAYS })}>
                {trend.map((d) => (
                  <div
                    key={d.day}
                    className="flex h-full flex-1 items-end rounded-sm bg-gray-100 dark:bg-slate-800"
                    title={d.day + ": " + (d.rate === null ? t("noRecords") : pct(d.rate) + " (" + d.absent + " " + t("absentShort") + ")")}
                  >
                    {d.rate !== null && (
                      <div
                        className={
                          "w-full rounded-sm " +
                          (d.rate >= 0.9 ? "bg-emerald-500" : d.rate >= 0.8 ? "bg-amber-500" : "bg-rose-500")
                        }
                        style={{ height: Math.round(d.rate * 100) + "%" }}
                      />
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-gray-400">
                <span>{since28.slice(5)}</span>
                <span>{today.slice(5)}</span>
              </div>
              <p className="mt-2 text-xs text-gray-500">{t("trendLegend")}</p>
            </>
          )}
        </div>

        {/* Uniform */}
        <div className={CARD}>
          <h2 className="mb-3 text-lg font-semibold dark:text-slate-100">{t("uniformTitle")}</h2>
          <div className="flex h-24 items-end gap-2">
            {uniformByDay.map((u) => {
              const v = u.total === 0 ? 0 : Math.round((u.full / u.total) * 100);
              return (
                <div key={u.d} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-xs text-gray-500">{u.total ? v + "%" : "-"}</span>
                  <div className="flex h-14 w-full items-end rounded bg-gray-100 dark:bg-slate-800">
                    <div className="w-full rounded bg-emerald-500" style={{ height: v + "%" }} />
                  </div>
                  <span className="text-[10px] text-gray-400">{u.d.slice(5)}</span>
                </div>
              );
            })}
          </div>
          <h3 className="mb-1 mt-4 text-sm font-semibold dark:text-slate-100">{t("uniformIssuesToday")}</h3>
          {todayUniform.length === 0 ? (
            <p className="text-sm text-gray-500">{t("uniformNotChecked")}</p>
          ) : todayNotFull.length === 0 ? (
            <p className="text-sm text-emerald-600">{t("uniformAllFull")}</p>
          ) : (
            <ul className="divide-y divide-gray-100 text-sm dark:divide-slate-800">
              {todayNotFull.map((u) => (
                <li key={u.studentId} className="flex flex-wrap items-center gap-2 py-1.5">
                  <span className="font-medium dark:text-slate-100">{nameOf.get(u.studentId)}</span>
                  <span className={"rounded-full px-2.5 py-0.5 text-xs font-semibold " + UNIFORM_BADGE[u.status]}>
                    {t("uniformStatus." + u.status)}
                  </span>
                  {u.missingItems.length > 0 && (
                    <span className="text-gray-500">{u.missingItems.join(", ")}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Behavior notes */}
      <div className={CARD}>
        <h2 className="mb-3 text-lg font-semibold dark:text-slate-100">
          {t("behaviorTitle", { days: RISK_RULES.behaviorWindowDays })}
        </h2>
        {recentNotes.length === 0 ? (
          <p className="text-sm text-gray-500">{t("noBehavior")}</p>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm dark:divide-slate-800">
            {recentNotes.map((b) => (
              <li key={b.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 py-2">
                <span className="w-24 shrink-0 text-gray-500">{dayKey(b.date)}</span>
                <span className={"rounded-full px-2.5 py-0.5 text-xs font-semibold " + BEHAVIOR_BADGE[b.type]}>
                  {t("behaviorType." + b.type)}
                </span>
                <span className="font-medium dark:text-slate-100">{nameOf.get(b.studentId)}</span>
                <span className="min-w-0 flex-1 text-gray-600 dark:text-slate-300">
                  {b.title}
                  {b.description ? " - " + b.description : ""}
                </span>
                <span className="text-xs text-gray-400">
                  {b.teacher.name} {b.teacher.surname}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Roster with parent contacts */}
      <div className={CARD}>
        <h2 className="mb-3 text-lg font-semibold dark:text-slate-100">{t("rosterTitle")}</h2>
        {roster.length === 0 ? (
          <p className="text-sm text-gray-500">{t("noStudents")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs text-gray-500 dark:border-slate-700">
                  <th className="py-2 pr-3 font-medium">{t("cols.student")}</th>
                  <th className="py-2 pr-3 font-medium">{t("cols.attendance", { days: RISK_RULES.attendanceWindowDays })}</th>
                  <th className="py-2 pr-3 font-medium">{t("cols.uniform", { days: RISK_RULES.uniformWindowDays })}</th>
                  <th className="py-2 pr-3 font-medium">{t("cols.behavior")}</th>
                  <th className="py-2 pr-3 font-medium">{t("cols.parent")}</th>
                  <th className="py-2 pr-3 font-medium">{t("cols.phone")}</th>
                  <th className="py-2 pr-3 font-medium">{t("cols.email")}</th>
                  <th className="py-2 font-medium">{t("cols.status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {roster.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2 pr-3">
                      <Link
                        href={"/dashboard/list/students/" + s.id}
                        className="font-medium text-blue-700 hover:underline dark:text-blue-300"
                      >
                        {s.name} {s.surname}
                      </Link>
                    </td>
                    <td className="py-2 pr-3 dark:text-slate-200">
                      {s.att.rate === null ? "-" : pct(s.att.rate)}
                      {s.att.absentDays > 0 && (
                        <span className="ml-1 text-xs text-gray-400">
                          ({s.att.absentDays} {t("absentShort")})
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3 dark:text-slate-200">
                      {s.uniformBad === 0 ? "-" : s.uniformBad}
                    </td>
                    <td className="py-2 pr-3 dark:text-slate-200">
                      <span className="text-emerald-600">+{s.positives}</span>{" "}
                      <span className={s.negatives ? "text-amber-600" : "text-gray-400"}>!{s.negatives}</span>
                    </td>
                    <td className="py-2 pr-3 dark:text-slate-200">
                      {s.parent.name} {s.parent.surname}
                    </td>
                    <td className="py-2 pr-3">
                      <a href={"tel:" + s.parent.phone} className="text-blue-700 hover:underline dark:text-blue-300">
                        {s.parent.phone}
                      </a>
                    </td>
                    <td className="py-2 pr-3">
                      {s.parent.email ? (
                        <a href={"mailto:" + s.parent.email} className="text-blue-700 hover:underline dark:text-blue-300">
                          {s.parent.email}
                        </a>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-2">
                      {s.reasons.length > 0 ? (
                        <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
                          {t("statusAtRisk")}
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                          {t("statusOk")}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyClassPage;
