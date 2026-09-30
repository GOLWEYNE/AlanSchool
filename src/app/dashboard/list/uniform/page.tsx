import Link from "next/link";
import { getTranslations } from "next-intl/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { routeAccessMap } from "@/lib/settings";
import UniformChecker, { type UniformLabels, type UniformRow } from "@/components/UniformChecker";
import {
  REPEAT_THRESHOLD,
  UNIFORM_ITEMS,
  addDays,
  isValidDateStr,
  schoolToday,
  toDbDate,
  type UniformStatusKey,
} from "@/lib/uniform";

type SP = { [key: string]: string | undefined };
type TFn = (key: string, values?: Record<string, string | number>) => string;

const BADGE: Record<UniformStatusKey, string> = {
  FULL: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  PARTIAL: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  NONE: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};

const CARD = "rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900";

const pct = (part: number, total: number) => (total === 0 ? 0 : Math.round((part / total) * 100));

function Hero({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-amber-400 p-5 text-white">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-1 text-sm opacity-90">{subtitle}</p>
    </div>
  );
}

// Parents: read-only record of their own children's uniform checks.
async function ParentView({ userId, t }: { userId: string; t: TFn }) {
  const today = schoolToday();
  const since = addDays(today, -29);
  const children = await prisma.student.findMany({
    where: { parentId: userId },
    select: { id: true, name: true, surname: true, class: { select: { name: true } } },
  });
  const checks = await prisma.uniformCheck.findMany({
    where: { studentId: { in: children.map((c) => c.id) }, date: { gte: toDbDate(since) } },
    orderBy: { date: "desc" },
  });

  return (
    <div className="flex flex-col gap-4 p-4">
      <Hero title={t("title")} subtitle={t("subtitleParent")} />
      {children.length === 0 && <p className="text-sm text-gray-500">{t("noChildren")}</p>}
      {children.map((child) => {
        const mine = checks.filter((c) => c.studentId === child.id);
        const full = mine.filter((c) => c.status === "FULL").length;
        return (
          <div key={child.id} className={CARD}>
            <div className="flex flex-wrap items-baseline gap-3">
              <h2 className="text-lg font-semibold dark:text-slate-100">
                {child.name} {child.surname}
              </h2>
              <span className="text-sm text-gray-500">{t("classLabel", { name: child.class.name })}</span>
              <span className="ml-auto text-sm font-medium text-gray-600 dark:text-slate-300">
                {t("parentSummary", { full, total: mine.length, percent: pct(full, mine.length) })}
              </span>
            </div>
            {mine.length === 0 ? (
              <p className="mt-3 text-sm text-gray-500">{t("noRecords")}</p>
            ) : (
              <ul className="mt-3 divide-y divide-gray-100 dark:divide-slate-800">
                {mine.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                    <span className="w-28 text-gray-600 dark:text-slate-300">{c.date.toISOString().slice(0, 10)}</span>
                    <span className={"rounded-full px-2.5 py-1 text-xs font-semibold " + BADGE[c.status as UniformStatusKey]}>
                      {t("status." + c.status)}
                    </span>
                    {c.missingItems.length > 0 && (
                      <span className="text-gray-500">
                        {t("missingList", { items: c.missingItems.map((k) => t("items." + k)).join(", ") })}
                      </span>
                    )}
                    {c.note && <span className="text-gray-400">- {c.note}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

const UniformPage = async ({ searchParams }: { searchParams: Promise<SP> | SP }) => {
  const { userId, role } = await requireRole(routeAccessMap["/dashboard/list/uniform(.*)"]);
  const t = (await getTranslations("Uniform")) as unknown as TFn;
  if (role === "parent") return <ParentView userId={userId} t={t} />;

  const sp = await Promise.resolve(searchParams);
  const today = schoolToday();
  const date = isValidDateStr(sp.date) && sp.date <= today ? sp.date : today;
  const isAdmin = role === "admin";

  // Admins see every class; a teacher only sees the classes they supervise.
  const classes = await prisma.class.findMany({
    where: isAdmin ? {} : { supervisorId: userId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      supervisor: { select: { name: true, surname: true } },
      _count: { select: { students: true } },
    },
  });

  if (classes.length === 0) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Hero title={t("title")} subtitle={t("subtitleDefault")} />
        <p className={CARD + " text-sm text-gray-600 dark:text-slate-300"}>{t("noSupervisedClass")}</p>
      </div>
    );
  }

  const requested = parseInt(sp.classId ?? "", 10);
  const selected = classes.find((c) => c.id === requested) ?? classes[0];
  const classIds = classes.map((c) => c.id);

  const [students, dayChecks, overview, week, offenders] = await Promise.all([
    prisma.student.findMany({
      where: { classId: selected.id },
      orderBy: [{ surname: "asc" }, { name: "asc" }],
      select: { id: true, name: true, surname: true },
    }),
    prisma.uniformCheck.findMany({ where: { classId: selected.id, date: toDbDate(date) } }),
    prisma.uniformCheck.findMany({
      where: { classId: { in: classIds }, date: toDbDate(date) },
      select: { classId: true, status: true },
    }),
    prisma.uniformCheck.findMany({
      where: { classId: { in: classIds }, date: { gte: toDbDate(addDays(today, -6)) } },
      select: { date: true, status: true },
    }),
    prisma.uniformCheck.groupBy({
      by: ["studentId"],
      where: { classId: { in: classIds }, date: { gte: toDbDate(addDays(today, -6)) }, status: { not: "FULL" } },
      _count: { _all: true },
    }),
  ]);

  const byStudent = new Map(dayChecks.map((c) => [c.studentId, c]));
  const initial: UniformRow[] = students.map((s) => {
    const c = byStudent.get(s.id);
    return {
      id: s.id,
      name: s.name,
      surname: s.surname,
      // Unrecorded students default to full uniform so the supervisor only taps exceptions.
      status: (c?.status as UniformStatusKey) ?? "FULL",
      missingItems: c?.missingItems ?? [],
      note: c?.note ?? "",
    };
  });

  const labels: UniformLabels = {
    status: { FULL: t("status.FULL"), PARTIAL: t("status.PARTIAL"), NONE: t("status.NONE") },
    short: { FULL: t("short.FULL"), PARTIAL: t("short.PARTIAL"), NONE: t("short.NONE") },
    items: UNIFORM_ITEMS.map((i) => ({ key: i.key, label: t("items." + i.key) })),
    everyoneFull: t("everyoneFull"),
    notePlaceholder: t("notePlaceholder"),
    missingPrefix: t("missingPrefix"),
    save: t("save"),
    saving: t("saving"),
    savedTemplate: t("saved", { count: "__COUNT__" }),
    couldNotSave: t("couldNotSave"),
    noStudents: t("noStudents"),
  };

  const recorded = dayChecks.length > 0;
  const canEdit = isAdmin || date >= addDays(today, -7);

  // Per-class overview for the selected date.
  const perClass = classes.map((c) => {
    const rows = overview.filter((o) => o.classId === c.id);
    const full = rows.filter((r) => r.status === "FULL").length;
    return { ...c, checked: rows.length, full, compliance: pct(full, rows.length) };
  });
  const totalChecked = perClass.reduce((n, c) => n + c.checked, 0);
  const totalFull = perClass.reduce((n, c) => n + c.full, 0);
  const pending = perClass.filter((c) => c.checked === 0 && c._count.students > 0);

  // Seven-day school-wide trend.
  const days = [-6, -5, -4, -3, -2, -1, 0].map((d) => addDays(today, d));
  const trend = days.map((d) => {
    const rows = week.filter((w) => w.date.toISOString().slice(0, 10) === d);
    return { d, total: rows.length, value: pct(rows.filter((r) => r.status === "FULL").length, rows.length) };
  });

  const flagged = offenders.filter((o) => o._count._all >= REPEAT_THRESHOLD);
  const flaggedStudents = flagged.length
    ? await prisma.student.findMany({
        where: { id: { in: flagged.map((f) => f.studentId) } },
        select: { id: true, name: true, surname: true, class: { select: { name: true } } },
      })
    : [];

  const exportHref = "/api/uniform/export" + (isAdmin ? "" : "?classId=" + selected.id);

  return (
    <div className="flex flex-col gap-4 p-4">
      <Hero title={t("title")} subtitle={isAdmin ? t("subtitleAdmin") : t("subtitleSupervisor")} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className={CARD}>
          <p className="text-xs text-gray-500">{t("complianceOn", { date })}</p>
          <p className="text-3xl font-bold text-emerald-600">{pct(totalFull, totalChecked)}%</p>
        </div>
        <div className={CARD}>
          <p className="text-xs text-gray-500">{t("studentsChecked")}</p>
          <p className="text-3xl font-bold dark:text-slate-100">{totalChecked}</p>
        </div>
        <div className={CARD}>
          <p className="text-xs text-gray-500">{t("classesNotChecked")}</p>
          <p className={"text-3xl font-bold " + (pending.length ? "text-amber-600" : "text-emerald-600")}>{pending.length}</p>
        </div>
        <div className={CARD}>
          <p className="text-xs text-gray-500">{t("repeatAlerts")}</p>
          <p className={"text-3xl font-bold " + (flagged.length ? "text-rose-600" : "text-emerald-600")}>{flagged.length}</p>
        </div>
      </div>

      <div className={CARD}>
        <form method="get" className="mb-4 flex flex-wrap items-end gap-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">{t("class")}</span>
            <select name="classId" defaultValue={selected.id} className="rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">{t("date")}</span>
            <input type="date" name="date" defaultValue={date} max={today} className="rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
          </label>
          <button type="submit" className="rounded-lg bg-slate-800 px-4 py-2 font-medium text-white hover:bg-slate-700">
            {t("open")}
          </button>
          <a href={exportHref} className="ml-auto rounded-lg border border-blue-300 px-4 py-2 font-medium text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/30">
            {t("exportCsv")}
          </a>
        </form>

        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <h2 className="text-lg font-semibold dark:text-slate-100">{t("classOnDate", { name: selected.name, date })}</h2>
          <span className={"rounded-full px-2.5 py-1 text-xs font-semibold " + (recorded ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
            {recorded ? t("recorded") : t("notRecorded")}
          </span>
          {selected.supervisor && (
            <span className="text-gray-500">
              {t("supervisor", { name: selected.supervisor.name + " " + selected.supervisor.surname })}
            </span>
          )}
          {!canEdit && <span className="text-gray-500">{t("readOnly")}</span>}
        </div>

        <UniformChecker key={selected.id + date} classId={selected.id} date={date} initial={initial} canEdit={canEdit} labels={labels} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={CARD}>
          <h2 className="mb-3 text-lg font-semibold dark:text-slate-100">{t("last7")}</h2>
          <div className="flex h-40 items-end gap-2">
            {trend.map((tr) => (
              <div key={tr.d} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-xs text-gray-500">{tr.total ? tr.value + "%" : "-"}</span>
                <div className="flex h-28 w-full items-end rounded bg-gray-100 dark:bg-slate-800">
                  <div className="w-full rounded bg-emerald-500" style={{ height: tr.value + "%" }} />
                </div>
                <span className="text-[10px] text-gray-400">{tr.d.slice(5)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={CARD}>
          <h2 className="mb-3 text-lg font-semibold dark:text-slate-100">{t("repeatTitle", { count: REPEAT_THRESHOLD })}</h2>
          {flaggedStudents.length === 0 ? (
            <p className="text-sm text-gray-500">{t("noFlagged")}</p>
          ) : (
            <ul className="divide-y divide-gray-100 text-sm dark:divide-slate-800">
              {flaggedStudents.map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-2">
                  <span className="font-medium dark:text-slate-100">
                    {s.name} {s.surname}
                  </span>
                  <span className="text-gray-500">{t("classLabel", { name: s.class.name })}</span>
                  <span className="ml-auto rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">
                    {t("daysCount", { count: flagged.find((f) => f.studentId === s.id)?._count._all ?? 0 })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className={CARD}>
        <h2 className="mb-3 text-lg font-semibold dark:text-slate-100">{isAdmin ? t("allClasses", { date }) : t("yourClasses", { date })}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-gray-500">
              <tr>
                <th className="p-2">{t("thClass")}</th>
                <th className="p-2">{t("thSupervisor")}</th>
                <th className="p-2">{t("thChecked")}</th>
                <th className="p-2">{t("thFull")}</th>
                <th className="p-2">{t("thStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {perClass.map((c) => (
                <tr key={c.id} className="border-t border-gray-100 dark:border-slate-800">
                  <td className="p-2 font-medium dark:text-slate-100">
                    <Link href={"/dashboard/list/uniform?classId=" + c.id + "&date=" + date} className="hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="p-2 text-gray-600 dark:text-slate-300">{c.supervisor ? c.supervisor.name + " " + c.supervisor.surname : "-"}</td>
                  <td className="p-2">
                    {c.checked}/{c._count.students}
                  </td>
                  <td className="p-2">{c.checked ? c.compliance + "%" : "-"}</td>
                  <td className="p-2">
                    {c.checked === 0 ? (
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">{t("notChecked")}</span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">{t("done")}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UniformPage;
