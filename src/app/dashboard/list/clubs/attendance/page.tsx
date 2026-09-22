import Link from "next/link";
import PageHero from "@/components/PageHero";
import ClubAttendanceMatrixForm from "@/components/ClubAttendanceMatrixForm";
import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { getUserRole } from "@/lib/auth";
import { getFormatter, getTranslations } from "next-intl/server";
import { schoolDayRange, toWallClock, SCHOOL_TIME_ZONE } from "@/lib/schoolTime";

type Status = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

const pad = (n: number) => String(n).padStart(2, "0");
const schoolDateString = (d: Date) => {
  const w = toWallClock(d);
  return `${w.year}-${pad(w.month)}-${pad(w.day)}`;
};
const schoolTimeString = (d: Date) => {
  const w = toWallClock(d);
  return `${pad(w.hour)}:${pad(w.minute)}`;
};

// After-school clubs meet 15:00-16:00 on the school routine ("Кружки").
const DEFAULT_START = "15:00";
const DEFAULT_END = "16:00";

// Club-meeting attendance, built on the same pattern as the class Attendance
// page: pick a club and a day, mark the roster, save. Admins see every club;
// teachers only the clubs they instruct.
const ClubAttendancePage = async ({
  searchParams,
}: {
  searchParams: { clubId?: string; date?: string };
}) => {
  const { userId, sessionClaims } = auth();
  const role = getUserRole(sessionClaims);
  const t = await getTranslations("List.clubAttendance");
  const format = await getFormatter();

  if (role !== "admin" && role !== "teacher") {
    return (
      <div className="panel-card p-4 md:p-5 flex-1 m-4 mt-0 list-page-shell">
        <p className="text-sm text-gray-500 dark:text-slate-400 p-4">{t("restricted")}</p>
      </div>
    );
  }

  const date =
    searchParams.date && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date)
      ? searchParams.date
      : schoolDateString(new Date());
  const [dayStart, dayEnd] = schoolDayRange(date);

  const clubs = await prisma.club.findMany({
    where: role === "teacher" ? { instructorId: userId ?? "" } : {},
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const requestedId = searchParams.clubId ? parseInt(searchParams.clubId, 10) : NaN;
  const selectedClubId = clubs.some((c) => c.id === requestedId) ? requestedId : clubs[0]?.id;

  const session = selectedClubId
    ? await prisma.clubSession.findFirst({
        where: { clubId: selectedClubId, date: { gte: dayStart, lt: dayEnd } },
        orderBy: { startTime: "asc" },
        include: { attendances: { select: { studentId: true, status: true } } },
      })
    : null;

  // Roster = active members, plus anyone already marked for this meeting
  // (so a student who has since left still shows on past sessions).
  const markedIds = session?.attendances.map((a) => a.studentId) ?? [];
  const members = selectedClubId
    ? await prisma.student.findMany({
        where: {
          OR: [
            { clubEnrollments: { some: { clubId: selectedClubId, status: "ACTIVE" } } },
            { id: { in: markedIds } },
          ],
        },
        select: { id: true, name: true, surname: true, class: { select: { name: true } } },
        orderBy: [{ name: "asc" }, { surname: "asc" }],
      })
    : [];

  const statusByStudent = new Map(
    (session?.attendances ?? []).map((a) => [a.studentId, a.status as Status])
  );
  const presentCount = (session?.attendances ?? []).filter(
    (a) => a.status === "PRESENT" || a.status === "LATE"
  ).length;

  const recentSessions = selectedClubId
    ? await prisma.clubSession.findMany({
        where: { clubId: selectedClubId },
        orderBy: { date: "desc" },
        take: 10,
        include: { attendances: { select: { status: true } } },
      })
    : [];

  return (
    <div className="panel-card p-4 md:p-5 flex-1 m-4 mt-0 list-page-shell">
      <PageHero
        title={t("title")}
        subtitle={t("subtitle")}
        emoji={t("emoji")}
        stats={[
          { label: t("clubsLabel"), value: clubs.length },
          { label: t("membersLabel"), value: members.length },
          {
            label: t("markedLabel"),
            value: `${session?.attendances.length ?? 0}/${members.length}`,
          },
          { label: t("presentLabel"), value: presentCount },
        ]}
      />

      <form
        className="panel-card p-4 rounded-md mb-4 shine-hover flex flex-wrap items-end gap-4"
        method="GET"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 dark:text-slate-400">{t("clubLabel")}</label>
          <select
            name="clubId"
            defaultValue={selectedClubId}
            className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2 rounded-md text-sm min-w-[12rem]"
          >
            {clubs.map((c) => (
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
          {t("loadButton")}
        </button>
        <Link
          href="/dashboard/list/clubs"
          className="bg-white dark:bg-slate-800 ring-1 ring-gray-300 dark:ring-slate-700 px-4 py-2 rounded-md text-sm font-semibold"
        >
          {t("backToClubs")}
        </Link>
      </form>

      {clubs.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400 p-4">{t("noClubs")}</p>
      ) : selectedClubId ? (
        <>
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">
            {session ? t("sessionExists") : t("sessionNew")}
          </p>
          <ClubAttendanceMatrixForm
            clubId={selectedClubId}
            date={date}
            defaultStart={session ? schoolTimeString(session.startTime) : DEFAULT_START}
            defaultEnd={session ? schoolTimeString(session.endTime) : DEFAULT_END}
            students={members.map((s) => ({
              id: s.id,
              name: s.name,
              surname: s.surname,
              className: s.class?.name,
              existingStatus: statusByStudent.get(s.id),
            }))}
          />

          <div className="panel-card p-4 rounded-md mb-4 shine-hover">
            <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">
              {t("recentTitle")}
            </h2>
            {recentSessions.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-slate-400">{t("recentNone")}</p>
            ) : (
              <div className="flex flex-col divide-y divide-gray-100 dark:divide-slate-800">
                {recentSessions.map((s) => {
                  const sDate = schoolDateString(s.date);
                  const came = s.attendances.filter(
                    (a) => a.status === "PRESENT" || a.status === "LATE"
                  ).length;
                  return (
                    <Link
                      key={s.id}
                      href={`/dashboard/list/clubs/attendance?clubId=${selectedClubId}&date=${sDate}`}
                      className={`flex items-center justify-between gap-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-slate-800/60 px-2 rounded ${
                        sDate === date ? "font-semibold" : ""
                      }`}
                    >
                      <span>
                        {format.dateTime(s.date, {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          timeZone: SCHOOL_TIME_ZONE,
                        })}{" "}
                        · {schoolTimeString(s.startTime)}–{schoolTimeString(s.endTime)}
                      </span>
                      <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2.5 py-0.5 text-xs font-semibold">
                        {t("cameCount", { came, total: s.attendances.length })}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
};

export default ClubAttendancePage;
