import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { getUserRole } from "@/lib/auth";
import { ReportCardDocument, ReportCardResultRow } from "@/lib/reportCardPdf";

// Report cards are rendered on demand rather than stored as static
// files: the DB only holds the stable /api/report-cards/[id]/pdf URL
// (ReportCard.pdfUrl), and this route builds the PDF fresh from the
// latest data every time it's requested.
export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const reportCardId = parseInt(params.id, 10);
  if (Number.isNaN(reportCardId)) {
    return NextResponse.json({ error: "Invalid report card id" }, { status: 400 });
  }

  const { userId, sessionClaims } = auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = getUserRole(sessionClaims);

  const reportCard = await prisma.reportCard.findUnique({
    where: { id: reportCardId },
    include: {
      student: { include: { class: true, grade: true } },
    },
  });

  if (!reportCard) {
    return NextResponse.json({ error: "Report card not found" }, { status: 404 });
  }

  const { student } = reportCard;

  const isAdminOrTeacher = role === "admin" || role === "teacher";
  const isSelf = role === "student" && userId === student.id;
  const isParent =
    role === "parent" && userId === student.parentId;

  if (!isAdminOrTeacher && !isSelf && !isParent) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const results = await prisma.result.findMany({
    where: { studentId: student.id },
    include: {
      exam: { include: { lesson: { include: { subject: true } } } },
      assignment: { include: { lesson: { include: { subject: true } } } },
    },
  });

  const resultRows: ReportCardResultRow[] = results.map((r) => {
    if (r.exam) {
      return {
        subject: r.exam.lesson.subject.name,
        assessment: r.exam.title,
        type: "Exam" as const,
        score: r.score,
      };
    }
    return {
      subject: r.assignment?.lesson.subject.name ?? "—",
      assessment: r.assignment?.title ?? "—",
      type: "Assignment" as const,
      score: r.score,
    };
  });

  const pdfBuffer = await renderToBuffer(
    ReportCardDocument({
      data: {
        studentName: `${student.name} ${student.surname}`,
        studentUsername: student.username,
        className: student.class.name,
        gradeLevel: student.grade?.level,
        term: reportCard.term,
        schoolYear: reportCard.schoolYear,
        gpa: reportCard.gpa,
        attendanceRate: reportCard.attendanceRate,
        behaviorSummary: reportCard.behaviorSummary,
        results: resultRows,
        generatedAt: reportCard.generatedAt,
      },
    })
  );

  const safeSchoolYear = reportCard.schoolYear.replace(/[^\w-]/g, "_");
  const fileName = `report-card-${student.username}-${reportCard.term}-${safeSchoolYear}.pdf`;

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
