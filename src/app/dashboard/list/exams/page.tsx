import FormContainer from "@/components/FormContainer";
import Pagination from "@/components/Pagination";
import Table from "@/components/Table";
import TableSearch from "@/components/TableSearch";
import PageHero from "@/components/PageHero";
import prisma from "@/lib/prisma";
import { ITEM_PER_PAGE } from "@/lib/settings";
import { Class, Exam, Prisma, Subject, Teacher } from "@/generated/prisma/client";
import Image from "next/image";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { getUserRole } from "@/lib/auth";
import { getTranslations } from "next-intl/server";

type ExamList = Exam & {
  lesson: {
    subject: Subject;
    class: Class;
    teacher: Teacher;
  };
};

const ExamListPage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {

const { userId, sessionClaims } = auth();
const role = getUserRole(sessionClaims);
const currentUserId = userId;
const t = await getTranslations("List.exams");


const columns = [
  {
    header: t("columns.subjectName"),
    accessor: "name",
  },
  {
    header: t("columns.class"),
    accessor: "class",
  },
  {
    header: t("columns.teacher"),
    accessor: "teacher",
    className: "hidden md:table-cell",
  },
  {
    header: t("columns.date"),
    accessor: "date",
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

const renderRow = (item: ExamList) => (
  <tr
    key={item.id}
    className="border-b border-gray-200 dark:border-slate-800 even:bg-slate-50 dark:even:bg-slate-900/40 text-sm hover:bg-lamaPurpleLight dark:hover:bg-blue-950/40"
  >
    <td className="flex items-center gap-4 p-4">
      <Link href={`/dashboard/list/exams/${item.id}`} className="hover:underline">
        {item.lesson.subject.name}
      </Link>
    </td>
    <td>{item.lesson.class.name}</td>
    <td className="hidden md:table-cell">
      {item.lesson.teacher.name + " " + item.lesson.teacher.surname}
    </td>
    <td className="hidden md:table-cell">
      {new Intl.DateTimeFormat("en-US").format(item.startTime)}
    </td>
    <td>
      <div className="flex items-center gap-2">
        <Link
          href={`/dashboard/list/exams/${item.id}`}
          className="text-xs font-semibold text-blue-500 hover:underline"
        >
          {role === "student" ? "View / Submit" : "View"}
        </Link>
        {(role === "admin" || role === "teacher") && (
          <>
            <FormContainer table="exam" type="update" data={item} />
            {(role === "admin" || role === "teacher") && (
              <FormContainer table="exam" type="delete" id={item.id} />
            )}
          </>
        )}
      </div>
    </td>
  </tr>
);

  const { page, ...queryParams } = searchParams;

  const p = page ? parseInt(page) : 1;

  // URL PARAMS CONDITION

  const query: Prisma.ExamWhereInput = {};

  query.lesson = {};
  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined) {
        switch (key) {
          case "classId":
            query.lesson.classId = parseInt(value);
            break;
          case "teacherId":
            query.lesson.teacherId = value;
            break;
          case "search":
            query.lesson.subject = {
              name: { contains: value, mode: "insensitive" },
            };
            break;
          default:
            break;
        }
      }
    }
  }

  // ROLE CONDITIONS

  switch (role) {
    case "admin":
      break;
    case "teacher":
      query.lesson.teacherId = currentUserId!;
      break;
    case "student":
      query.lesson.class = {
        students: {
          some: {
            id: currentUserId!,
          },
        },
      };
      break;
    case "parent":
      query.lesson.class = {
        students: {
          some: {
            parentId: currentUserId!,
          },
        },
      };
      break;

    default:
      break;
  }

  const [data, count] = await prisma.$transaction([
    prisma.exam.findMany({
      where: query,
      include: {
        lesson: {
          select: {
            subject: { select: { name: true } },
            teacher: { select: { name: true, surname: true } },
            class: { select: { name: true } },
          },
        },
      },
      take: ITEM_PER_PAGE,
      skip: ITEM_PER_PAGE * (p - 1),
    }),
    prisma.exam.count({ where: query }),
  ]);

  return (
    <div className="panel-card p-4 md:p-5 rounded-md flex-1 m-4 mt-0 shine-hover">
      <PageHero
        title={t("title")}
        subtitle={t("subtitle")}
        emoji={t("emoji")}
        stats={[
          { label: t("totalLabel"), value: count },
          { label: t("showingLabel"), value: data.length },
          { label: t("roleLabel"), value: role || "guest" },
        ]}
      />
      {/* TOP */}
      <div className="flex items-center justify-between">
        <h1 className="hidden md:block text-lg font-semibold text-blue-900">{t("heading")}</h1>
        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          <TableSearch />
          <div className="flex items-center gap-4 self-end">
            {(role === "admin" || role === "teacher") && (
              <>
                <button className="circle-icon-btn">
                  <Image src="/filter.png" alt="" width={14} height={14} />
                </button>
                <button className="circle-icon-btn">
                  <Image src="/sort.png" alt="" width={14} height={14} />
                </button>
              </>
            )}
            {(role === "admin" || role === "teacher") && (
              <FormContainer table="exam" type="create" />
            )}
          </div>
        </div>
      </div>
      {/* LIST */}
      <Table columns={columns} renderRow={renderRow} data={data} />
      {/* PAGINATION */}
      <Pagination page={p} count={count} />
    </div>
  );
};

export default ExamListPage;
