import FormContainer from "@/components/FormContainer";
import Pagination from "@/components/Pagination";
import Table from "@/components/Table";
import TableSearch from "@/components/TableSearch";
import PageHero from "@/components/PageHero";
import prisma from "@/lib/prisma";
import { resolvePageSize } from "@/lib/settings";
import { BehaviorLog, BehaviorType, Prisma, Student, Teacher } from "@/generated/prisma/client";
import { auth } from "@clerk/nextjs/server";
import { getUserRole } from "@/lib/auth";
import { getTranslations } from "next-intl/server";
import { CheckCircle2, XCircle } from "lucide-react";

type BehaviorLogRow = BehaviorLog & {
  student: Pick<Student, "id" | "name" | "surname">;
  teacher: Pick<Teacher, "name" | "surname">;
};

const TYPE_BADGE: Record<BehaviorType, string> = {
  POSITIVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  CONCERN: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  INCIDENT: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};

// The BehaviorLog model (merit/incident notes on a student, optionally
// visible to their parent) has existed since the master module package
// landed, but had no page in the navigation to create or review entries -
// this is that page, for admins (every student) and teachers (their own
// classes). Parents/students see their own visible entries on their
// dashboards instead, via ReportCardBehaviorTimeline.
const BehaviorLogPage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {
  const { userId, sessionClaims } = auth();
  const role = getUserRole(sessionClaims);
  const t = await getTranslations("List.behaviorLog");

  if (role !== "admin" && role !== "teacher") {
    return (
      <div className="panel-card p-4 md:p-5 rounded-md flex-1 m-4 mt-0 list-page-shell">
        <PageHero title={t("heading")} subtitle={t("subheading")} emoji={t("emoji")} stats={[]} />
        <p className="text-sm text-gray-500 dark:text-slate-400 p-4">{t("restricted")}</p>
      </div>
    );
  }

  const TYPE_LABELS: Record<BehaviorType, string> = {
    POSITIVE: t("typePositive"),
    CONCERN: t("typeConcern"),
    INCIDENT: t("typeIncident"),
  };

  const columns = [
    { header: t("columns.date"), accessor: "date" },
    { header: t("columns.student"), accessor: "student" },
    { header: t("columns.type"), accessor: "type" },
    { header: t("columns.title"), accessor: "title", className: "hidden md:table-cell" },
    { header: t("columns.loggedBy"), accessor: "teacher", className: "hidden lg:table-cell" },
    { header: t("columns.visibleToParent"), accessor: "visible", className: "hidden md:table-cell" },
    { header: t("columns.actions"), accessor: "action" },
  ];

  const renderRow = (item: BehaviorLogRow) => (
    <tr
      key={item.id}
      className="border-b border-gray-200 dark:border-slate-800 even:bg-slate-50 dark:even:bg-slate-900/40 text-sm hover:bg-lamaPurpleLight dark:hover:bg-blue-950/40"
    >
      <td className="p-4">{new Date(item.date).toLocaleDateString()}</td>
      <td>{item.student.name} {item.student.surname}</td>
      <td>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${TYPE_BADGE[item.type]}`}>
          {TYPE_LABELS[item.type]}
        </span>
      </td>
      <td className="hidden md:table-cell">{item.title}</td>
      <td className="hidden lg:table-cell">{item.teacher.name} {item.teacher.surname}</td>
      <td className="hidden md:table-cell">
        {item.visibleToParent ? (
          <CheckCircle2 size={16} className="text-emerald-500" />
        ) : (
          <XCircle size={16} className="text-gray-300 dark:text-slate-600" />
        )}
      </td>
      <td>
        <div className="flex items-center gap-2">
          <FormContainer table="behaviorLog" type="update" data={item} />
          <FormContainer table="behaviorLog" type="delete" id={item.id} />
        </div>
      </td>
    </tr>
  );

  const { page, pageSize, ...queryParams } = searchParams;
  const p = page ? parseInt(page) : 1;
  const size = resolvePageSize(pageSize);

  // Teachers only ever see (and can only ever log against) students in a
  // class they actually teach or supervise - same scoping FormContainer
  // uses to build the student picker in the log form.
  const query: Prisma.BehaviorLogWhereInput =
    role === "teacher"
      ? {
          student: {
            class: {
              OR: [{ supervisorId: userId! }, { lessons: { some: { teacherId: userId! } } }],
            },
          },
        }
      : {};

  for (const [key, value] of Object.entries(queryParams)) {
    if (key === "search" && value) {
      query.OR = [
        { title: { contains: value, mode: "insensitive" } },
        { student: { name: { contains: value, mode: "insensitive" } } },
        { student: { surname: { contains: value, mode: "insensitive" } } },
      ];
    }
  }

  const [data, count] = await prisma.$transaction([
    prisma.behaviorLog.findMany({
      where: query,
      include: {
        student: { select: { id: true, name: true, surname: true } },
        teacher: { select: { name: true, surname: true } },
      },
      orderBy: { date: "desc" },
      take: size,
      skip: size * (p - 1),
    }),
    prisma.behaviorLog.count({ where: query }),
  ]);

  return (
    <div className="panel-card p-4 md:p-5 rounded-md flex-1 m-4 mt-0 list-page-shell">
      <PageHero
        title={t("heading")}
        subtitle={t("subheading")}
        emoji={t("emoji")}
        stats={[
          { label: t("totalLabel"), value: count },
          {
            label: t("positiveLabel"),
            value: data.filter((d) => d.type === "POSITIVE").length,
          },
        ]}
        action={<FormContainer table="behaviorLog" type="create" />}
      />
      <div className="flex items-center justify-between gap-4">
        <TableSearch />
      </div>
      <Table columns={columns} renderRow={renderRow} data={data} />
      <Pagination page={p} count={count} pageSize={size} />
    </div>
  );
};

export default BehaviorLogPage;
