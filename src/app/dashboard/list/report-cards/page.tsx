import Table from "@/components/Table";
import PageHero from "@/components/PageHero";
import BulkGenerateReportCardsPanel from "@/components/BulkGenerateReportCardsPanel";
import ReportCardGenerateButton from "@/components/ReportCardGenerateButton";
import prisma from "@/lib/prisma";
import { TERM_LABELS } from "@/lib/reportCardPdf";
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import Link from "next/link";

const ReportCardsListPage = async () => {
  const t = await getTranslations("List.reportCards");

  const [reportCards, classes, students] = await prisma.$transaction([
    prisma.reportCard.findMany({
      include: { student: { include: { class: true } } },
      orderBy: [{ generatedAt: "desc" }],
      take: 100,
    }),
    prisma.class.findMany({ orderBy: { name: "asc" } }),
    prisma.student.findMany({
      select: { id: true, name: true, surname: true, classId: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const columns = [
    { header: t("columns.student"), accessor: "student" },
    { header: t("columns.class"), accessor: "class", className: "hidden md:table-cell" },
    { header: t("columns.term"), accessor: "term", className: "hidden md:table-cell" },
    { header: t("columns.schoolYear"), accessor: "schoolYear", className: "hidden md:table-cell" },
    { header: t("columns.gpa"), accessor: "gpa", className: "hidden lg:table-cell" },
    { header: t("columns.attendance"), accessor: "attendance", className: "hidden lg:table-cell" },
    { header: t("columns.generatedAt"), accessor: "generatedAt", className: "hidden lg:table-cell" },
    { header: t("columns.actions"), accessor: "action" },
  ];

  const renderRow = (item: (typeof reportCards)[number]) => (
    <tr
      key={item.id}
      className="border-b border-gray-200 dark:border-slate-800 even:bg-slate-50 dark:even:bg-slate-900/40 text-sm hover:bg-lamaPurpleLight dark:hover:bg-blue-950/40"
    >
      <td className="p-4">
        <div className="flex flex-col">
          <h3 className="font-semibold">
            {item.student.name} {item.student.surname}
          </h3>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            {item.student.username}
          </p>
        </div>
      </td>
      <td className="hidden md:table-cell">{item.student.class.name}</td>
      <td className="hidden md:table-cell">{TERM_LABELS[item.term] ?? item.term}</td>
      <td className="hidden md:table-cell">{item.schoolYear}</td>
      <td className="hidden lg:table-cell">
        {item.gpa !== null ? Math.round(item.gpa * 100) / 100 : "—"}
      </td>
      <td className="hidden lg:table-cell">
        {item.attendanceRate !== null
          ? `${Math.round(item.attendanceRate * 100) / 100}%`
          : "—"}
      </td>
      <td className="hidden lg:table-cell">
        {new Date(item.generatedAt).toLocaleDateString()}
      </td>
      <td>
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/list/report-cards/${item.id}`}
            title={t("viewLabel")}
          >
            <button className="circle-icon-btn">
              <Image src="/view.png" alt="" width={16} height={16} />
            </button>
          </Link>
          <Link
            href={item.pdfUrl ?? `/api/report-cards/${item.id}/pdf`}
            target="_blank"
            title={t("downloadLabel")}
          >
            <button className="circle-icon-btn">
              <Image src="/result.png" alt="" width={16} height={16} />
            </button>
          </Link>
          <ReportCardGenerateButton
            studentId={item.studentId}
            studentLabel={`${item.student.name} ${item.student.surname}`}
            defaultTerm={item.term}
            defaultSchoolYear={item.schoolYear}
            variant="button"
          />
        </div>
      </td>
    </tr>
  );

  return (
    <div className="panel-card p-4 md:p-5 rounded-md flex-1 m-4 mt-0 shine-hover">
      <PageHero
        title={t("title")}
        subtitle={t("subtitle")}
        emoji={t("emoji")}
        stats={[{ label: t("totalLabel"), value: reportCards.length }]}
      />

      <BulkGenerateReportCardsPanel
        classes={classes.map((c) => ({ id: c.id, name: c.name }))}
        students={students.map((s) => ({
          id: s.id,
          name: `${s.name} ${s.surname}`,
          classId: s.classId,
        }))}
      />

      {reportCards.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400 p-4">
          {t("empty")}
        </p>
      ) : (
        <Table columns={columns} renderRow={renderRow} data={reportCards} />
      )}
    </div>
  );
};

export default ReportCardsListPage;
