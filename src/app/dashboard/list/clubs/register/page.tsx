import Link from "next/link";
import PageHero from "@/components/PageHero";
import ClubRegistration from "@/components/ClubRegistration";
import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { getUserRole } from "@/lib/auth";
import { getTranslations } from "next-intl/server";
import { getSupervisedClubIds } from "@/lib/clubSupervision";

// Club registration: pick a club, then choose students from the whole school
// by grade and class. Admins see every club; a teacher only the clubs they
// supervise.
const ClubRegisterPage = async ({
  searchParams,
}: {
  searchParams: { clubId?: string };
}) => {
  const { userId, sessionClaims } = auth();
  const role = getUserRole(sessionClaims);
  const t = await getTranslations("List.clubRegister");

  if (role !== "admin" && role !== "teacher") {
    return (
      <div className="panel-card p-4 md:p-5 flex-1 m-4 mt-0 list-page-shell">
        <p className="text-sm text-gray-500 dark:text-slate-400 p-4">{t("restricted")}</p>
      </div>
    );
  }

  const supervisedIds = role === "teacher" ? await getSupervisedClubIds(userId) : null;
  const clubs = await prisma.club.findMany({
    where: supervisedIds ? { id: { in: supervisedIds } } : {},
    select: { id: true, name: true, capacity: true },
    orderBy: { name: "asc" },
  });

  const requestedId = searchParams.clubId ? parseInt(searchParams.clubId, 10) : NaN;
  const selected = clubs.find((c) => c.id === requestedId) ?? clubs[0];

  const [grades, classes, students, enrollments] = selected
    ? await Promise.all([
        prisma.grade.findMany({ orderBy: { level: "asc" }, select: { id: true, level: true } }),
        prisma.class.findMany({
          orderBy: { name: "asc" },
          select: { id: true, name: true, gradeId: true },
        }),
        prisma.student.findMany({
          orderBy: [{ name: "asc" }, { surname: "asc" }],
          select: {
            id: true,
            name: true,
            surname: true,
            classId: true,
            gradeId: true,
            class: { select: { name: true } },
            grade: { select: { level: true } },
          },
        }),
        prisma.clubEnrollment.findMany({
          where: { clubId: selected.id, status: { in: ["ACTIVE", "WAITLISTED"] } },
          select: { studentId: true, status: true },
        }),
      ])
    : [[], [], [], []];

  const statusByStudent = new Map(
    enrollments.map((e) => [e.studentId, e.status as "ACTIVE" | "WAITLISTED"])
  );
  const activeCount = enrollments.filter((e) => e.status === "ACTIVE").length;

  return (
    <div className="panel-card p-4 md:p-5 flex-1 m-4 mt-0 list-page-shell">
      <PageHero
        title={t("title")}
        subtitle={t("subtitle")}
        emoji={t("emoji")}
        stats={[
          { label: t("clubsLabel"), value: clubs.length },
          { label: t("studentsLabel"), value: students.length },
          { label: t("membersLabel"), value: activeCount },
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
            defaultValue={selected?.id}
            className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2 rounded-md text-sm min-w-[12rem]"
          >
            {clubs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
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
        {selected && (
          <>
            <Link
              href={`/dashboard/list/clubs/attendance?clubId=${selected.id}`}
              className="bg-emerald-500 text-white px-4 py-2 rounded-md text-sm font-semibold"
            >
              {t("attendanceButton")}
            </Link>
            <Link
              href={`/dashboard/list/clubs/uniform?clubId=${selected.id}`}
              className="bg-amber-500 text-white px-4 py-2 rounded-md text-sm font-semibold"
            >
              {t("uniformButton")}
            </Link>
          </>
        )}
      </form>

      {!selected ? (
        <p className="text-sm text-gray-500 dark:text-slate-400 p-4">
          {role === "teacher" ? t("noSupervisedClubs") : t("noClubs")}
        </p>
      ) : (
        <ClubRegistration
          key={selected.id}
          clubId={selected.id}
          capacity={selected.capacity}
          grades={grades}
          classes={classes}
          students={students.map((s) => ({
            id: s.id,
            name: s.name,
            surname: s.surname,
            classId: s.classId,
            className: s.class.name,
            gradeId: s.gradeId,
            gradeLevel: s.grade.level,
            status: statusByStudent.get(s.id) ?? null,
          }))}
        />
      )}
    </div>
  );
};

export default ClubRegisterPage;
