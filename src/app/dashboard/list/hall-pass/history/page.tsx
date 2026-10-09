import { getTranslations } from "next-intl/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { routeAccessMap } from "@/lib/settings";
import { getTeacherClassIds } from "@/lib/teacherScope";
import {
  HISTORY_PAGE_SIZE,
  ensureHallPass,
  formatSchoolDate,
  formatSchoolTime,
  loadPassHistory,
  parseHistoryFilters,
} from "@/lib/hallPass";
import Table from "@/components/Table";
import Pagination from "@/components/Pagination";
import { CARD, Hero, StaffNav } from "@/components/hallPass/HallPassUi";

export const dynamic = "force-dynamic";

type SP = { [key: string]: string | undefined };
type TFn = (key: string, values?: Record<string, string | number>) => string;

const FIELD =
  "rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  RETURNED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  AUTO_CLOSED: "bg-gray-200 text-gray-700 dark:bg-slate-700 dark:text-slate-200",
};

// Searchable audit log of every pass: who, where, when they left and came back.
const HallPassHistoryPage = async ({ searchParams }: { searchParams: Promise<SP> | SP }) => {
  const { userId, role } = requireRole(routeAccessMap["/dashboard/list/hall-pass/history(.*)"]);
  const t = (await getTranslations("HallPass")) as unknown as TFn;
  const sp = await Promise.resolve(searchParams);
  const viewer = { role: role as "admin" | "teacher", userId };

  await ensureHallPass();
  const filters = parseHistoryFilters(sp);
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const { rows, total } = await loadPassHistory(viewer, filters, page, HISTORY_PAGE_SIZE);

  // Filter choices: teachers only get their own classes.
  const classIds = role === "teacher" ? await getTeacherClassIds(userId) : null;
  const [destinations, classes, grades] = await Promise.all([
    prisma.passDestination.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    prisma.class.findMany({
      where: classIds ? { id: { in: classIds } } : {},
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.grade.findMany({ orderBy: { level: "asc" }, select: { level: true } }),
  ]);

  const exportQuery = new URLSearchParams(
    Object.entries(sp).filter(([k, v]) => v && k !== "page" && k !== "pageSize") as [string, string][]
  ).toString();

  const columns = [
    { header: t("history.cols.student"), accessor: "student" },
    { header: t("history.cols.studentId"), accessor: "studentId", className: "hidden md:table-cell" },
    { header: t("history.cols.grade"), accessor: "grade", className: "hidden md:table-cell" },
    { header: t("history.cols.class"), accessor: "class", className: "hidden md:table-cell" },
    { header: t("history.cols.destination"), accessor: "destination" },
    { header: t("history.cols.date"), accessor: "date" },
    { header: t("history.cols.out"), accessor: "out" },
    { header: t("history.cols.back"), accessor: "back" },
    { header: t("history.cols.minutes"), accessor: "minutes", className: "hidden lg:table-cell" },
    { header: t("history.cols.status"), accessor: "status" },
  ];

  return (
    <div className="flex flex-col gap-4 p-4">
      <Hero title={t("title")} subtitle={t("subtitleHistory")} />
      <StaffNav
        active="history"
        role={role}
        labels={{ live: t("nav.live"), history: t("nav.history"), settings: t("nav.settings") }}
      />

      <form method="get" className={CARD + " flex flex-wrap items-end gap-3"}>
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs text-gray-500 dark:text-slate-400">
          {t("history.search")}
          <input name="q" defaultValue={filters.q ?? ""} placeholder={t("history.searchPlaceholder")} className={FIELD} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-500 dark:text-slate-400">
          {t("history.from")}
          <input type="date" name="from" defaultValue={filters.from ?? ""} className={FIELD} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-500 dark:text-slate-400">
          {t("history.to")}
          <input type="date" name="to" defaultValue={filters.to ?? ""} className={FIELD} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-500 dark:text-slate-400">
          {t("history.cols.destination")}
          <select name="destinationId" defaultValue={filters.destinationId ?? ""} className={FIELD}>
            <option value="">{t("history.all")}</option>
            {destinations.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-500 dark:text-slate-400">
          {t("history.cols.grade")}
          <select name="gradeLevel" defaultValue={filters.gradeLevel ?? ""} className={FIELD}>
            <option value="">{t("history.all")}</option>
            {grades.map((g) => (
              <option key={g.level} value={g.level}>
                {g.level}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-500 dark:text-slate-400">
          {t("history.cols.class")}
          <select name="classId" defaultValue={filters.classId ?? ""} className={FIELD}>
            <option value="">{t("history.all")}</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-500 dark:text-slate-400">
          {t("history.cols.status")}
          <select name="status" defaultValue={filters.status ?? ""} className={FIELD}>
            <option value="">{t("history.all")}</option>
            {(["ACTIVE", "RETURNED", "AUTO_CLOSED"] as const).map((s) => (
              <option key={s} value={s}>
                {t("status." + s)}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700">
          {t("history.apply")}
        </button>
        <a href="/dashboard/list/hall-pass/history" className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800">
          {t("history.reset")}
        </a>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-600 dark:text-slate-300">{t("history.total", { count: total })}</p>
        <a
          href={"/api/hall-pass/export" + (exportQuery ? "?" + exportQuery : "")}
          className="rounded-lg border border-blue-300 px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-900/30"
        >
          {t("history.exportCsv")}
        </a>
      </div>

      {rows.length === 0 ? (
        <p className={CARD + " text-sm text-gray-600 dark:text-slate-300"}>{t("history.noRecords")}</p>
      ) : (
        <>
          <Table
            columns={columns}
            data={rows}
            renderRow={(r: (typeof rows)[number]) => {
              const minutes = r.returnedAt
                ? Math.max(0, Math.round((new Date(r.returnedAt).getTime() - new Date(r.issuedAt).getTime()) / 60000))
                : null;
              const over = minutes !== null && minutes > r.maxMinutes;
              return (
                <tr key={r.id} className="border-b border-gray-100 text-sm even:bg-slate-50/50 dark:border-slate-800 dark:even:bg-slate-900/40">
                  <td className="px-4 py-3 font-medium dark:text-slate-100">{r.studentName}</td>
                  <td className="hidden px-4 py-3 text-gray-600 dark:text-slate-300 md:table-cell">{r.username}</td>
                  <td className="hidden px-4 py-3 md:table-cell dark:text-slate-300">{r.gradeLevel}</td>
                  <td className="hidden px-4 py-3 md:table-cell dark:text-slate-300">{r.className}</td>
                  <td className="px-4 py-3 dark:text-slate-300">{r.destination}</td>
                  <td className="px-4 py-3 dark:text-slate-300">{formatSchoolDate(r.issuedAt)}</td>
                  <td className="px-4 py-3 tabular-nums dark:text-slate-300">{formatSchoolTime(r.issuedAt)}</td>
                  <td className="px-4 py-3 tabular-nums dark:text-slate-300">{r.returnedAt ? formatSchoolTime(r.returnedAt) : "-"}</td>
                  <td className={"hidden px-4 py-3 tabular-nums lg:table-cell " + (over ? "font-semibold text-rose-600" : "dark:text-slate-300")}>
                    {minutes === null ? "-" : minutes}
                  </td>
                  <td className="px-4 py-3">
                    <span className={"rounded-full px-2.5 py-1 text-xs font-semibold " + STATUS_STYLE[r.status]}>{t("status." + r.status)}</span>
                  </td>
                </tr>
              );
            }}
          />
          <Pagination page={page} count={total} pageSize={HISTORY_PAGE_SIZE} />
        </>
      )}
    </div>
  );
};

export default HallPassHistoryPage;
