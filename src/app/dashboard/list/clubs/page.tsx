import Link from "next/link";
import FormContainer from "@/components/FormContainer";
import Pagination from "@/components/Pagination";
import Table from "@/components/Table";
import TableSearch from "@/components/TableSearch";
import PageHero from "@/components/PageHero";
import ClubEnrollControls, { ClubEnrollStudent } from "@/components/ClubEnrollControls";
import prisma from "@/lib/prisma";
import { resolvePageSize } from "@/lib/settings";
import { Club, ClubEnrollment, Prisma, Teacher } from "@/generated/prisma/client";
import { auth } from "@clerk/nextjs/server";
import { getUserRole } from "@/lib/auth";
import { getTranslations } from "next-intl/server";
import { getClubSupervisors, getSupervisedClubIds, type ClubSupervisorLite } from "@/lib/clubSupervision";

type ClubList = Club & {
  instructor: Teacher | null;
  supervisors: ClubSupervisorLite[];
  _count: { enrollments: number };
  enrollments: ClubEnrollment[];
};

const ClubListPage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {
  const t = await getTranslations("List.clubs");
  const { userId, sessionClaims } = auth();
  const role = getUserRole(sessionClaims);

  // Students see their own enrollment; parents see one row per child —
  // this is what turns the table from an admin roster into a self-service
  // join/leave view.
  let relevantStudents: { id: string; label: string }[] = [];
  if (role === "student" && userId) {
    relevantStudents = [{ id: userId, label: t("you") }];
  } else if (role === "parent" && userId) {
    const children = await prisma.student.findMany({
      where: { parentId: userId },
      select: { id: true, name: true, surname: true },
    });
    relevantStudents = children.map((c) => ({ id: c.id, label: `${c.name} ${c.surname}` }));
  }
  const showEnrollColumn = relevantStudents.length > 0;

  // Clubs this teacher supervises (lead instructor or co-supervisor): they get
  // the register / attendance / uniform tools for those clubs only.
  const supervisedIds = new Set(role === "teacher" ? await getSupervisedClubIds(userId) : []);
  const canSupervise = (clubId: number) => role === "admin" || supervisedIds.has(clubId);

  const columns = [
    { header: t("columns.name"), accessor: "name" },
    { header: t("columns.category"), accessor: "category", className: "hidden md:table-cell" },
    { header: t("columns.capacity"), accessor: "capacity", className: "hidden md:table-cell" },
    { header: t("columns.enrolled"), accessor: "enrolled", className: "hidden md:table-cell" },
    { header: t("columns.supervisors"), accessor: "supervisors", className: "hidden md:table-cell" },
    ...(showEnrollColumn ? [{ header: t("columns.yourEnrollment"), accessor: "enroll" }] : []),
    ...(role === "admin" || role === "teacher"
      ? [{ header: t("columns.actions"), accessor: "action" }]
      : []),
  ];

  const renderRow = (item: ClubList, waitlistPositions: Map<string, number>) => {
    const full = item._count.enrollments >= item.capacity;
    const students: ClubEnrollStudent[] = relevantStudents.map((s) => {
      const enrollment = item.enrollments.find((e) => e.studentId === s.id) ?? null;
      return {
        id: s.id,
        label: s.label,
        enrollment:
          enrollment && enrollment.status !== "WITHDRAWN"
            ? { id: enrollment.id, status: enrollment.status as "ACTIVE" | "WAITLISTED" }
            : null,
        waitlistPosition: enrollment ? waitlistPositions.get(`${item.id}:${s.id}`) : undefined,
      };
    });

    return (
      <tr
        key={item.id}
        className="border-b border-gray-200 dark:border-slate-800 even:bg-slate-50 dark:even:bg-slate-900/40 text-sm hover:bg-lamaPurpleLight dark:hover:bg-blue-950/40"
      >
        <td className="flex items-center gap-4 p-4">{item.name}</td>
        <td className="hidden md:table-cell">{t.has(`categories.${item.category}`) ? t(`categories.${item.category}`) : item.category}</td>
        <td className="hidden md:table-cell">{item.capacity}</td>
        <td className="hidden md:table-cell">{item._count.enrollments}</td>
        <td className="hidden md:table-cell">
          {item.supervisors.length > 0
            ? item.supervisors.map((s) => `${s.name} ${s.surname}`).join(", ")
            : t("unassigned")}
          {role === "teacher" && supervisedIds.has(item.id) && (
            <span className="ml-2 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 px-2 py-0.5 text-xs font-semibold whitespace-nowrap">
              {t("youSupervise")}
            </span>
          )}
        </td>
        {showEnrollColumn && (
          <td>
            <ClubEnrollControls clubId={item.id} full={full} students={students} />
          </td>
        )}
        <td>
          <div className="flex items-center gap-2">
            {canSupervise(item.id) && (
              <>
                <Link
                  href={`/dashboard/list/clubs/register?clubId=${item.id}`}
                  className="text-xs font-semibold px-2.5 py-1 rounded-md bg-blue-500 text-white whitespace-nowrap"
                >
                  {t("registerStudents")}
                </Link>
                <Link
                  href={`/dashboard/list/clubs/attendance?clubId=${item.id}`}
                  className="text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-500 text-white whitespace-nowrap"
                >
                  {t("takeAttendance")}
                </Link>
                <Link
                  href={`/dashboard/list/clubs/uniform?clubId=${item.id}`}
                  className="text-xs font-semibold px-2.5 py-1 rounded-md bg-amber-500 text-white whitespace-nowrap"
                >
                  {t("checkUniform")}
                </Link>
              </>
            )}
            {role === "admin" && (
              <>
                <FormContainer
                  table="club"
                  type="update"
                  data={{ ...item, supervisorIds: item.supervisors.map((s) => s.id) }}
                />
                <FormContainer table="club" type="delete" id={item.id} />
              </>
            )}
          </div>
        </td>
      </tr>
    );
  };

  const { page, pageSize, ...queryParams } = searchParams;
  const p = page ? parseInt(page) : 1;
  const size = resolvePageSize(pageSize);
  const query: Prisma.ClubWhereInput = {};
  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined) {
        switch (key) {
          case "search":
            query.name = { contains: value, mode: "insensitive" };
            break;
          default:
            break;
        }
      }
    }
  }

  const [rawData, count] = await prisma.$transaction([
    prisma.club.findMany({
      where: query,
      include: {
        instructor: true,
        _count: { select: { enrollments: { where: { status: "ACTIVE" } } } },
        // Empty relevantStudents (admin/teacher) means `in: []`, which
        // Prisma resolves to no rows — cheaper than a conditional include
        // and keeps the payload type stable.
        enrollments: { where: { studentId: { in: relevantStudents.map((s) => s.id) } } },
      },
      orderBy: { name: "asc" },
      take: size,
      skip: size * (p - 1),
    }),
    prisma.club.count({ where: query }),
  ]);

  const supervisorsByClub = await getClubSupervisors(rawData.map((c) => c.id));
  const data: ClubList[] = rawData.map((c) => ({
    ...c,
    supervisors: supervisorsByClub.get(c.id) ?? [],
  }));

  // For any waitlisted enrollment on this page, work out its queue position
  // (1-based, ordered by whoever has waited longest) so the badge can show
  // "Waitlisted #2" instead of a bare status.
  const waitlistPositions = new Map<string, number>();
  const waitlistedClubIds = data
    .filter((c) => c.enrollments.some((e) => e.status === "WAITLISTED"))
    .map((c) => c.id);
  if (waitlistedClubIds.length > 0) {
    const allWaitlisted = await prisma.clubEnrollment.findMany({
      where: { clubId: { in: waitlistedClubIds }, status: "WAITLISTED" },
      orderBy: { enrolledAt: "asc" },
      select: { clubId: true, studentId: true },
    });
    const counters = new Map<number, number>();
    for (const w of allWaitlisted) {
      const nextPosition = (counters.get(w.clubId) ?? 0) + 1;
      counters.set(w.clubId, nextPosition);
      waitlistPositions.set(`${w.clubId}:${w.studentId}`, nextPosition);
    }
  }

  return (
    <div className="panel-card p-4 md:p-5 flex-1 m-4 mt-0 list-page-shell">
      <PageHero
        title={t("title")}
        subtitle={t("subtitle")}
        emoji={t("emoji")}
        stats={[
          { label: t("totalLabel"), value: count },
          { label: t("visibleNowLabel"), value: data.length },
          { label: t("adminModeLabel"), value: role === "admin" ? t("on") : t("off") },
        ]}
      />
      <div className="flex items-center justify-between">
        <h1 className="hidden md:block text-lg font-semibold text-blue-900">{t("heading")}</h1>
        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          <TableSearch />
          <div className="flex items-center gap-4 self-end">
            {(role === "admin" || role === "teacher") && (
              <>
                <Link
                  href="/dashboard/list/clubs/register"
                  className="bg-blue-500 text-white px-3 py-1.5 rounded-md text-sm font-semibold whitespace-nowrap"
                >
                  {t("registerButton")}
                </Link>
                <Link
                  href="/dashboard/list/clubs/attendance"
                  className="bg-emerald-500 text-white px-3 py-1.5 rounded-md text-sm font-semibold whitespace-nowrap"
                >
                  {t("clubAttendanceButton")}
                </Link>
                <Link
                  href="/dashboard/list/clubs/uniform"
                  className="bg-amber-500 text-white px-3 py-1.5 rounded-md text-sm font-semibold whitespace-nowrap"
                >
                  {t("clubUniformButton")}
                </Link>
              </>
            )}
            {role === "admin" && <FormContainer table="club" type="create" />}
          </div>
        </div>
      </div>
      <Table
        columns={columns}
        renderRow={(item: ClubList) => renderRow(item, waitlistPositions)}
        data={data}
      />
      <Pagination page={p} count={count} pageSize={size} />
    </div>
  );
};

export default ClubListPage;
