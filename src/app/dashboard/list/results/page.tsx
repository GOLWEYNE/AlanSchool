import FormContainer from "@/components/FormContainer";
import Pagination from "@/components/Pagination";
import Table from "@/components/Table";
import TableSearch from "@/components/TableSearch";
import PageHero from "@/components/PageHero";
import prisma from "@/lib/prisma";
import { ITEM_PER_PAGE } from "@/lib/settings";
import { Prisma } from "@/generated/prisma/client";
import Image from "next/image";

import { auth } from "@clerk/nextjs/server";
import { getUserRole } from "@/lib/auth";
import { getTranslations } from "next-intl/server";

type ResultList = {
  id: number;
  title: string;
  studentId: string;
  studentName: string;
  studentSurname: string;
  teacherName: string;
  teacherSurname: string;
  score: number;
  className: string;
  startTime: Date;
  examId?: number;
  assignmentId?: number;
};


const ResultListPage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {

const { userId, sessionClaims } = auth();
const role = getUserRole(sessionClaims);
const currentUserId = userId;
const t = await getTranslations("List.results");


const columns = [
  {
    header: t("columns.title"),
    accessor: "title",
  },
  {
    header: t("columns.student"),
    accessor: "student",
  },
  {
    header: t("columns.score"),
    accessor: "score",
    className: "hidden md:table-cell",
  },
  {
    header: t("columns.teacher"),
    accessor: "teacher",
    className: "hidden md:table-cell",
  },
  {
    header: t("columns.class"),
    accessor: "class",
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

const renderRow = (item: ResultList) => (
  <tr
    key={item.id}
    className="border-b border-gray-200 dark:border-slate-800 even:bg-slate-50 dark:even:bg-slate-900/40 text-sm hover:bg-lamaPurpleLight dark:hover:bg-blue-950/40"
  >
    <td className="flex items-center gap-4 p-4">{item.title}</td>
    <td>{item.studentName + " " + item.studentSurname}</td>
    <td className="hidden md:table-cell">{item.score}</td>
    <td className="hidden md:table-cell">
      {item.teacherName + " " + item.teacherSurname}
    </td>
    <td className="hidden md:table-cell">{item.className}</td>
    <td className="hidden md:table-cell">
      {new Intl.DateTimeFormat("en-US").format(item.startTime)}
    </td>
    <td>
      <div className="flex items-center gap-2">
        {(role === "admin" || role === "teacher") && (
          <>
            <FormContainer table="result" type="update" data={item} />
            {role === "admin" && (
              <FormContainer table="result" type="delete" id={item.id} />
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

  const query: Prisma.ResultWhereInput = {};

  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined) {
        switch (key) {
          case "studentId":
            query.studentId = value;
            break;
          case "search":
            query.OR = [
              { exam: { title: { contains: value, mode: "insensitive" } } },
              { student: { name: { contains: value, mode: "insensitive" } } },
            ];
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
      query.OR = [
        { exam: { lesson: { teacherId: currentUserId! } } },
        { assignment: { lesson: { teacherId: currentUserId! } } },
      ];
      break;

    case "student":
      query.studentId = currentUserId!;
      break;

    case "parent":
      query.student = {
        parentId: currentUserId!,
      };
      break;
    default:
      break;
  }

  const [dataRes, count] = await prisma.$transaction([
    prisma.result.findMany({
      where: query,
      include: {
        student: { select: { name: true, surname: true } },
        exam: {
          include: {
            lesson: {
              select: {
                class: { select: { name: true } },
                teacher: { select: { name: true, surname: true } },
              },
            },
          },
        },
        assignment: {
          include: {
            lesson: {
              select: {
                class: { select: { name: true } },
                teacher: { select: { name: true, surname: true } },
              },
            },
          },
        },
      },
      take: ITEM_PER_PAGE,
      skip: ITEM_PER_PAGE * (p - 1),
    }),
    prisma.result.count({ where: query }),
  ]);

  const data = dataRes.map((item) => {
    const assessment = item.exam || item.assignment;

    if (!assessment) return null;

    const isExam = "startTime" in assessment;

    return {
      id: item.id,
      title: assessment.title,
      studentId: item.studentId,
      studentName: item.student.name,
      studentSurname: item.student.surname,
      teacherName: assessment.lesson.teacher.name,
      teacherSurname: assessment.lesson.teacher.surname,
      score: item.score,
      className: assessment.lesson.class.name,
      startTime: isExam ? assessment.startTime : assessment.startDate,
      examId: item.examId || undefined,
      assignmentId: item.assignmentId || undefined,
    };
  });

  return (
    <div className="panel-card p-4 md:p-5 rounded-md flex-1 m-4 mt-0 shine-hover">
      <PageHero
        title={t("title")}
        subtitle={t("subtitle")}
        emoji={t("emoji")}
        stats={[
          { label: t("totalLabel"), value: count },
          { label: t("loadedLabel"), value: data.filter(Boolean).length },
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
              <FormContainer table="result" type="create" />
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

export default ResultListPage;
