import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import prisma from "@/lib/prisma";
import { getUserRole } from "@/lib/auth";
import { TERM_LABELS } from "@/lib/reportCardPdf";
import ReportCardView from "@/components/reportCard/ReportCardView";
import {
  AttendanceBreakdown,
  ReportCardBehaviorEntry,
  ReportCardResultRow,
  ReportCardViewData,
} from "@/components/reportCard/types";

// Renders the rich, in-browser report card dashboard for ONE ReportCard
// row. This page is fully data-driven — swap the [id] in the URL and the
// exact same layout renders correctly for any student in the school, so
// there is nothing here specific to a single example student.
const SingleReportCardPage = async ({
  params: { id },
}: {
  params: { id: string };
}) => {
  const reportCardId = parseInt(id, 10);
  if (Number.isNaN(reportCardId)) {
    return notFound();
  }

  const { userId, sessionClaims } = auth();
  if (!userId) {
    return notFound();
  }
  const role = getUserRole(sessionClaims);

  const reportCard = await prisma.reportCard.findUnique({
    where: { id: reportCardId },
    include: {
      student: { include: { class: true, grade: true } },
    },
  });

  if (!reportCard) {
    return notFound();
  }

  const { student } = reportCard;

  const isAdminOrTeacher = role === "admin" || role === "teacher";
  const isSelf = role === "student" && userId === student.id;
  const isParent = role === "parent" && userId === student.parentId;

  if (!isAdminOrTeacher && !isSelf && !isParent) {
    return (
      <div className="flex-1 p-4">
        <div className="panel-card p-8 rounded-2xl flex flex-col items-center text-center gap-3 max-w-md mx-auto mt-12">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20">
            <ShieldAlert size={26} className="text-rose-500 dark:text-rose-300" />
          </div>
          <h1 className="text-lg font-bold text-gray-800 dark:text-blue-100">
            Access Restricted
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            You don&apos;t have permission to view this student&apos;s report card.
          </p>
        </div>
      </div>
    );
  }

  const [results, behaviorLogs, attendanceRecords] = await Promise.all([
    prisma.result.findMany({
      where: { studentId: student.id },
      include: {
        exam: { include: { lesson: { include: { subject: true } } } },
        assignment: { include: { lesson: { include: { subject: true } } } },
      },
    }),
    prisma.behaviorLog.findMany({
      where: { studentId: student.id },
      orderBy: { date: "desc" },
      take: 5,
    }),
    prisma.attendanceRecord.findMany({
      where: { studentId: student.id },
      select: { status: true },
    }),
  ]);

  const resultRows: ReportCardResultRow[] = results.map((r) => {
    if (r.exam) {
      return {
        id: `exam-${r.id}`,
        subject: r.exam.lesson.subject.name,
        assessment: r.exam.title,
        type: "Exam" as const,
        score: r.score,
      };
    }
    return {
      id: `assignment-${r.id}`,
      subject: r.assignment?.lesson.subject.name ?? "—",
      assessment: r.assignment?.title ?? "—",
      type: "Assignment" as const,
      score: r.score,
    };
  });

  const behaviorEntries: ReportCardBehaviorEntry[] = behaviorLogs.map((log) => ({
    id: log.id,
    type: log.type,
    title: log.title,
    description: log.description,
    date: log.date,
  }));

  const attendanceBreakdown: AttendanceBreakdown = attendanceRecords.reduce(
    (acc, record) => {
      acc.total += 1;
      if (record.status === "PRESENT") acc.present += 1;
      else if (record.status === "ABSENT") acc.absent += 1;
      else if (record.status === "LATE") acc.late += 1;
      else if (record.status === "EXCUSED") acc.excused += 1;
      return acc;
    },
    { present: 0, absent: 0, late: 0, excused: 0, total: 0 }
  );

  const viewData: ReportCardViewData = {
    reportCardId: reportCard.id,
    studentId: student.id,
    studentName: `${student.name} ${student.surname}`,
    studentUsername: student.username,
    studentImg: student.img,
    className: student.class.name,
    gradeLevel: student.grade?.level,
    term: reportCard.term,
    termLabel: TERM_LABELS[reportCard.term] ?? reportCard.term,
    schoolYear: reportCard.schoolYear,
    gpa: reportCard.gpa,
    attendanceRate: reportCard.attendanceRate,
    attendanceBreakdown,
    results: resultRows,
    behaviorLogs: behaviorEntries,
    generatedAt: reportCard.generatedAt,
    pdfHref: reportCard.pdfUrl ?? `/api/report-cards/${reportCard.id}/pdf`,
  };

  return <ReportCardView data={viewData} />;
};

export default SingleReportCardPage;
