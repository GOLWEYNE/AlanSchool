import FormContainer from "@/components/FormContainer";
import Pagination from "@/components/Pagination";
import Table from "@/components/Table";
import TableSearch from "@/components/TableSearch";
import prisma from "@/lib/prisma";
import { ITEM_PER_PAGE } from "@/lib/settings";
import { Class, Lesson, Prisma, Subject, Teacher } from "@/generated/prisma/client";
import Image from "next/image";
import { auth } from "@clerk/nextjs/server";
import { getUserRole } from "@/lib/auth";
import { getTranslations } from "next-intl/server";

type LessonList = Lesson & {
  subject: Subject;
  class: Class;
  teacher: Teacher;
};

const LessonsListPage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {
  const { userId, sessionClaims } = auth();
  const role = getUserRole(sessionClaims);
  const currentUserId = userId;
  const t = await getTranslations("List.lessons");

  const columns = [
    {
      header: t("columns.lesson"),
      accessor: "lesson",
    },
    {
      header: t("columns.subject"),
      accessor: "subject",
    },
    {
      header: t("columns.class"),
      accessor: "class",
      className: "hidden md:table-cell",
    },
    {
      header: t("columns.teacher"),
      accessor: "teacher",
      className: "hidden md:table-cell",
    },
    {
      header: t("columns.time"),
      accessor: "time",
      className: "hidden md:table-cell",
    },
    ...(role === "admin" || role === "teacher"
      ? [
          {
            header: t("columns.actions"),
            accessor: "action",
          },
        ]
      : []),
  ];

  const renderRow = (item: LessonList) => (
    <tr
      key={item.id}
      className="border-b border-gray-200 dark:border-slate-800 even:bg-slate-50 dark:even:bg-slate-900/40 text-sm hover:bg-lamaPurpleLight dark:hover:bg-blue-950/40"
    >
      <td className="flex items-center gap-4 p-4">{item.name}</td>
      <td>{item.subject.name}</td>
      <td className="hidden md:table-cell">{item.class.name}</td>
      <td className="hidden md:table-cell">
        {item.teacher.name} {item.teacher.surname}
      </td>
      <td className="hidden md:table-cell">
        {item.day} {item.startTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
      </td>
      <td>
        <div className="flex items-center gap-2">
          {(role === "admin" || role === "teacher") && (
            <>
              <FormContainer table="lesson" type="update" data={item} />
              {role === "admin" && (
                <FormContainer table="lesson" type="delete" id={item.id} />
              )}
            </>
          )}
        </div>
      </td>
    </tr>
  );

  const { page, ...queryParams } = searchParams;
  const p = page ? parseInt(page) : 1;

  const query: Prisma.LessonWhereInput = {};

  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined) {
        switch (key) {
          case "classId":
            query.classId = parseInt(value);
            break;
          case "teacherId":
            query.teacherId = value;
            break;
          case "search":
            query.OR = [
              { name: { contains: value, mode: "insensitive" } },
              { subject: { name: { contains: value, mode: "insensitive" } } },
            ];
            break;
          default:
            break;
        }
      }
    }
  }

  if (role === "teacher") {
    query.teacherId = currentUserId!;
  }

  const [data, count] = await prisma.$transaction([
    prisma.lesson.findMany({
      where: query,
      include: {
        subject: true,
        class: true,
        teacher: true,
      },
      take: ITEM_PER_PAGE,
      skip: ITEM_PER_PAGE * (p - 1),
      orderBy: { day: "asc" },
    }),
    prisma.lesson.count({ where: query }),
  ]);

  return (
    <div className="panel-card p-4 md:p-5 rounded-md flex-1 m-4 mt-0 shine-hover">
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
            {(role === "admin" || role === "teacher") && (
              <FormContainer table="lesson" type="create" />
            )}
          </div>
        </div>
      </div>
      <Table columns={columns} renderRow={renderRow} data={data} />
      <Pagination page={p} count={count} />
    </div>
  );
};

export default LessonsListPage;
