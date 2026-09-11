import PageHero from "@/components/PageHero";
import AttendanceMatrixForm from "@/components/AttendanceMatrixForm";
import AttendanceChart from "@/components/AttendanceChart";
import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { getUserRole } from "@/lib/auth";
import { getTranslations } from "next-intl/server";

type Status = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

const STATUS_BADGE: Record<string, string> = {
  PRESENT: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  ABSENT: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  LATE: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  EXCUSED: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
};

const todayISO = () => new Date().toISOString().slice(0, 10);

// The dedicated attendance route the sidebar link used to be missing —
// previously it pointed at the Students table. Admin/teacher get a live
// capture + monitoring grid; students get a read-only history of their own
// record. Backed entirely by the existing (until now unused)
// recordAttendanceBulk / AttendanceRecord master-module plumbing.
const AttendancePage = async ({
  searchParams,
}: {
  searchParams: {
    classId?: string;
    date?: string;
    trendStudentId?: string;
    trendFrom?: string;
    trendTo?: string;
  };
}) => {
  const { userId, sessionClaims } = auth();
  const role = getUserRole(sessionClaims);
  const date = searchParams.date || todayISO();
  const t = await getTranslations("List.attendance");

  const STATUS_LABELS: Record<string, string> = {
    PRESENT: t("statusPresent"),
    ABSENT: t("statusAbsent"),
    LATE: t("statusLate"),
    EXCUSED: t("statusExcused"),
  };

  if (role === "student") {
    const records = await prisma.attendanceRecord.findMany({
      where: { studentId: userId ?? "" },
      include: { class: true },
      orderBy: { date: "desc" },
      take: 60,
    });

    const total = records.length;
    const presentCount = records.filter((r) => r.status === "PRESENT").length;
    const rate = total > 0 ? Math.round((presentCount / total) * 1000) / 10 : null;

    return (
      <div className="panel-card p-4 md:p-5 flex-1 m-4 mt-0 list-page-shell">
        <PageHero
          title={t("studentTitle")}
          subtitle={t("studentSubtitle")}
          emoji={t("emoji")}
          stats={[
            { label: t("recordsLabel"), value: total },
            { label: t("attendanceRateLabel"), value: rate !== null ? `${rate}%` : "—" },
          ]}
        />
        {records.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-400 p-4">
            {t("noRecords")}
          </p>
        ) : (
          <div className="data-table-shell mt-4">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-blue-50 via-sky-50 to-yellow-50 dark:from-blue-950/40 dark:via-slate-900/60 dark:to-yellow-950/20 border-b border-blue-100 dark:border-slate-800">
                <tr className="text-left text-blue-700 dark:text-blue-300 text-sm">
                  <th className="px-4 py-3 font-semibold uppercase tracking-wide text-[11px]">
                    {t("dateColumn")}
                  </th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wide text-[11px]">
                    {t("classColumn")}
                  </th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wide text-[11px]">
                    {t("statusColumn")}
                  </th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wide text-[11px]">
                    {t("noteColumn")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-gray-200 dark:border-slate-800 even:bg-slate-50 dark:even:bg-slate-900/40 text-sm"
                  >
                    <td className="px-4 py-3">{new Date(r.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3">{r.class.name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          STATUS_BADGE[r.status]
                        }`}
                      >
                        {STATUS_LABELS[r.status] ?? r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-slate-400">
                      {r.note || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // admin / teacher: live capture + monitoring
  const classes =
    role === "teacher" && userId
      ? await prisma.class.findMany({
          where: {
            OR: [{ supervisorId: userId }, { lessons: { some: { teacherId: userId } } }],
          },
          orderBy: { name: "asc" },
        })
      : await prisma.class.findMany({ orderBy: { name: "asc" } });

  const selectedClassId = searchParams.classId
    ? parseInt(searchParams.classId, 10)
    : classes[0]?.id;

  const [students, existingRecords] = selectedClassId
    ? await prisma.$transaction([
        prisma.student.findMany({
          where: { classId: selectedClassId },
          select: { id: true, name: true, surname: true },
          orderBy: { name: "asc" },
        }),
        prisma.attendanceRecord.findMany({
          where: { classId: selectedClassId, date: new Date(date) },
        }),
      ])
    : [[], []];

  const recordByStudent = new Map(existingRecords.map((r) => [r.studentId, r.status as Status]));
  const presentToday = existingRecords.filter((r) => r.status === "PRESENT").length;

  // --- Trend analytics: per-class (optionally per-student) attendance over
  // a term, reusing the same AttendanceChart already used on the homepage
  // widget - just fed week-bucketed AttendanceRecord data instead of a
  // hard-coded Mon-Fri window.
  const trendTo = searchParams.trendTo ? new Date(`${searchParams.trendTo}T23:59:59`) : new Date();
  const trendFrom = searchParams.trendFrom
    ? new Date(searchParams.trendFrom)
    : new Date(trendTo.getTime() - 84 * 24 * 60 * 60 * 1000); // ~12 weeks back
  const trendStudentId = searchParams.trendStudentId || undefined;

  const trendRecords = selectedClassId
    ? await prisma.attendanceRecord.findMany({
        where: {
          classId: selectedClassId,
          date: { gte: trendFrom, lte: trendTo },
          ...(trendStudentId ? { studentId: trendStudentId } : {}),
        },
        select: { date: true, status: true },
      })
    : [];

  // Monday of the week a given date falls in, used as that week's bucket key.
  const weekStart = (d: Date) => {
    const copy = new Date(d);
    const day = copy.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    copy.setDate(copy.getDate() + diff);
    copy.setHours(0, 0, 0, 0);
    return copy;
  };

  const trendBuckets = new Map<string, { weekStart: Date; present: number; absent: number }>();
  for (let cursor = weekStart(trendFrom); cursor <= trendTo; cursor.setDate(cursor.getDate() + 7)) {
    trendBuckets.set(cursor.toISOString(), { weekStart: new Date(cursor), present: 0, absent: 0 });
  }
  trendRecords.forEach((r) => {
    const key = weekStart(new Date(r.date)).toISOString();
    const bucket = trendBuckets.get(key);
    if (!bucket) return;
    if (r.status === "PRESENT" || r.status === "LATE") bucket.present += 1;
    else if (r.status === "ABSENT") bucket.absent += 1;
    // EXCUSED is neither counted against nor for the rate.
  });

  const trendData = Array.from(trendBuckets.values())
    .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime())
    .map((b) => ({
      name: b.weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      present: b.present,
      absent: b.absent,
    }));

  const trendTotalPresent = trendData.reduce((sum, d) => sum + d.present, 0);
  const trendTotalAbsent = trendData.reduce((sum, d) => sum + d.absent, 0);
  const trendRate =
    trendTotalPresent + trendTotalAbsent > 0
      ? Math.round((trendTotalPresent / (trendTotalPresent + trendTotalAbsent)) * 100)
      : null;

  return (
    <div className="panel-card p-4 md:p-5 flex-1 m-4 mt-0 list-page-shell">
      <PageHero
        title={t("adminTitle")}
        subtitle={t("adminSubtitle")}
        emoji={t("emoji")}
        stats={[
          { label: t("classesLabel"), value: classes.length },
          { label: t("rosterSizeLabel"), value: students.length },
          { label: t("markedTodayLabel"), value: `${existingRecords.length}/${students.length}` },
          { label: t("presentLabel"), value: presentToday },
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
          <label className="text-xs text-gray-500 dark:text-slate-400">{t("dateLabel")}</label>
          <input
            type="date"
            name="date"
            defaultValue={date}
            className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2 rounded-md text-sm"
          />
        </div>
        <button className="bg-blue-500 text-white px-4 py-2 rounded-md text-sm font-semibold">
          {t("loadRosterButton")}
        </button>
      </form>

      {classes.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400 p-4">
          {t("noClasses")}
        </p>
      ) : selectedClassId ? (
        <>
          <AttendanceMatrixForm
            classId={selectedClassId}
            date={date}
            students={students.map((s) => ({
              id: s.id,
              name: s.name,
              surname: s.surname,
              existingStatus: recordByStudent.get(s.id),
            }))}
          />

          {/* TREND ANALYTICS */}
          <div className="panel-card p-4 rounded-md mb-4 shine-hover">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                {t("trendTitle")}
              </h2>
              {trendRate !== null && (
                <span className="rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-3 py-1 text-xs font-semibold">
                  {t("trendRate", { rate: trendRate })}
                </span>
              )}
            </div>

            <form
              className="flex flex-wrap items-end gap-4 mb-4"
              method="GET"
            >
              <input type="hidden" name="classId" value={selectedClassId} />
              <input type="hidden" name="date" value={date} />
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 dark:text-slate-400">{t("trendStudentLabel")}</label>
                <select
                  name="trendStudentId"
                  defaultValue={trendStudentId ?? ""}
                  className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2 rounded-md text-sm min-w-[10rem]"
                >
                  <option value="">{t("trendAllStudents")}</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.surname}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 dark:text-slate-400">{t("trendFromLabel")}</label>
                <input
                  type="date"
                  name="trendFrom"
                  defaultValue={trendFrom.toISOString().slice(0, 10)}
                  className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2 rounded-md text-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 dark:text-slate-400">{t("trendToLabel")}</label>
                <input
                  type="date"
                  name="trendTo"
                  defaultValue={trendTo.toISOString().slice(0, 10)}
                  className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2 rounded-md text-sm"
                />
              </div>
              <button className="bg-blue-500 text-white px-4 py-2 rounded-md text-sm font-semibold">
                {t("trendLoadButton")}
              </button>
            </form>

            {trendTotalPresent + trendTotalAbsent === 0 ? (
              <p className="text-sm text-gray-500 dark:text-slate-400">{t("trendNoData")}</p>
            ) : (
              <div className="h-72">
                <AttendanceChart data={trendData} />
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
};

export default AttendancePage;
