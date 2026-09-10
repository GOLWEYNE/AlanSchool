import FormContainer from "@/components/FormContainer";
import Pagination from "@/components/Pagination";
import Table from "@/components/Table";
import TableSearch from "@/components/TableSearch";
import prisma from "@/lib/prisma";
import { resolvePageSize } from "@/lib/settings";
import { CurriculumObjective, Grade, Prisma, Subject } from "@/generated/prisma/client";
import Image from "next/image";
import { auth } from "@clerk/nextjs/server";
import { getUserRole } from "@/lib/auth";
import { getTranslations } from "next-intl/server";

type ObjectiveList = CurriculumObjective & { subject: Subject; grade: Grade | null };

// The curriculum's learning-objective bank (e.g. the Grade 1-2 science
// curriculum's objectives) that teachers tag Lessons/Exams against. Admin-
// managed, mirroring the Subjects list page exactly - only the columns and
// underlying Prisma model differ.
const ObjectiveListPage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {
  const { sessionClaims } = auth();
  const role = getUserRole(sessionClaims);
  const t = await getTranslations("List.objectives");

  const columns = [
    {
      header: t("columns.title"),
      accessor: "title",
    },
    {
      header: t("columns.code"),
      accessor: "code",
      className: "hidden md:table-cell",
    },
    {
      header: t("columns.subject"),
      accessor: "subject",
      className: "hidden md:table-cell",
    },
    {
      header: t("columns.grade"),
      accessor: "grade",
      className: "hidden md:table-cell",
    },
    {
      header: t("columns.strand"),
      accessor: "strand",
      className: "hidden lg:table-cell",
    },
    {
      header: t("columns.actions"),
      accessor: "action",
    },
  ];

  const renderRow = (item: ObjectiveList) => (
    <tr
      key={item.id}
      className="border-b border-gray-200 dark:border-slate-800 even:bg-slate-50 dark:even:bg-slate-900/40 text-sm hover:bg-lamaPurpleLight dark:hover:bg-blue-950/40"
    >
      <td className="flex items-center gap-4 p-4">{item.title}</td>
      <td className="hidden md:table-cell">{item.code ?? "-"}</td>
      <td className="hidden md:table-cell">{item.subject.name}</td>
      <td className="hidden md:table-cell">{item.grade ? item.grade.level : t("allGrades")}</td>
      <td className="hidden lg:table-cell">{item.strand ?? "-"}</td>
      <td>
        <div className="flex items-center gap-2">
          {role === "admin" && (
            <>
              <FormContainer table="objective" type="update" data={item} />
              <FormContainer table="objective" type="delete" id={item.id} />
            </>
          )}
        </div>
      </td>
    </tr>
  );

  const { page, pageSize, ...queryParams } = searchParams;

  const p = page ? parseInt(page) : 1;
  const size = resolvePageSize(pageSize);

  const query: Prisma.CurriculumObjectiveWhereInput = {};

  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined) {
        switch (key) {
          case "search":
            query.OR = [
              { title: { contains: value, mode: "insensitive" } },
              { code: { contains: value, mode: "insensitive" } },
              { strand: { contains: value, mode: "insensitive" } },
            ];
            break;
          default:
            break;
        }
      }
    }
  }

  const [data, count] = await prisma.$transaction([
    prisma.curriculumObjective.findMany({
      where: query,
      include: {
        subject: true,
        grade: true,
      },
      orderBy: [{ subject: { name: "asc" } }, { strand: "asc" }, { title: "asc" }],
      take: size,
      skip: size * (p - 1),
    }),
    prisma.curriculumObjective.count({ where: query }),
  ]);

  return (
    <div className="panel-card p-4 md:p-5 rounded-md flex-1 m-4 mt-0 list-page-shell">
      {/* TOP */}
      <div className="flex items-center justify-between">
        <h1 className="hidden md:block text-lg font-semibold text-blue-900">{t("heading")}</h1>
        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          <TableSearch />
          <div className="flex items-center gap-4 self-end">
            <button className="circle-icon-btn">
              <Image src="/filter.png" alt="" width={14} height={14} />
            </button>
            <button className="circle-icon-btn">
              <Image src="/sort.png" alt="" width={14} height={14} />
            </button>
            {role === "admin" && <FormContainer table="objective" type="create" />}
          </div>
        </div>
      </div>
      <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">{t("subheading")}</p>
      {/* LIST */}
      <Table columns={columns} renderRow={renderRow} data={data} />
      {/* PAGINATION */}
      <Pagination page={p} count={count} pageSize={size} />
    </div>
  );
};

export default ObjectiveListPage;
