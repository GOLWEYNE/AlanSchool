import prisma from "@/lib/prisma";
import { getUserRole } from "@/lib/auth";
import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { FileText, Clock } from "lucide-react";
import WorkSubmitPanel from "@/components/WorkSubmitPanel";
import WorkSubmissionsPanel from "@/components/WorkSubmissionsPanel";

type QuizQuestion = { text: string; options: string[]; correctIndex: number; points: number };

const SingleAssignmentPage = async ({ params: { id } }: { params: { id: string } }) => {
  const assignmentId = parseInt(id, 10);
  if (Number.isNaN(assignmentId)) return notFound();

  const { userId, sessionClaims } = auth();
  const role = getUserRole(sessionClaims);

  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      lesson: {
        select: {
          classId: true,
          class: { select: { name: true } },
          subject: { select: { name: true } },
          teacher: { select: { id: true, name: true, surname: true } },
        },
      },
    },
  });

  if (!assignment) return notFound();

  if (role === "teacher" && assignment.lesson.teacher.id !== userId) return notFound();

  let student: { id: string; classId: number } | null = null;
  if (role === "student" && userId) {
    student = await prisma.student.findUnique({
      where: { id: userId },
      select: { id: true, classId: true },
    });
  }

  const isTargeted = (studentId: string, classId: number) =>
    assignment.targetStudentIds.length === 0
      ? classId === assignment.lesson.classId
      : assignment.targetStudentIds.includes(studentId);

  if (role === "student" && (!student || !isTargeted(student.id, student.classId))) {
    return notFound();
  }

  if (role === "parent" && userId) {
    const child = await prisma.student.findFirst({
      where: { parentId: userId, classId: assignment.lesson.classId },
      select: { id: true },
    });
    if (!child) return notFound();
  }

  const isOpen = new Date() < assignment.dueDate;
  const questions = (assignment.questions as unknown as QuizQuestion[] | null) ?? null;
  const studentQuestions =
    questions?.map((q) => ({ text: q.text, options: q.options, points: q.points })) ?? null;

  let mySubmission = null;
  if (role === "student" && student) {
    const sub = await prisma.studentSubmission.findUnique({
      where: { assignmentId_studentId: { assignmentId: assignment.id, studentId: student.id } },
    });
    if (sub) {
      mySubmission = {
        fileUrl: sub.fileUrl,
        fileName: sub.fileName,
        submittedAt: sub.submittedAt?.toISOString() ?? null,
        status: sub.status,
        grade: sub.grade,
        feedback: sub.feedback,
        answers: (sub.answers as unknown as number[] | null) ?? null,
      };
    }
  }

  let submissionRows: {
    studentId: string;
    name: string;
    surname: string;
    submission: {
      id: number;
      fileUrl: string | null;
      fileName: string | null;
      submittedAt: string | null;
      status: string;
      grade: number | null;
      feedback: string | null;
      autoGraded: boolean;
    } | null;
  }[] = [];

  if (role === "admin" || role === "teacher") {
    const targetStudents =
      assignment.targetStudentIds.length > 0
        ? await prisma.student.findMany({
            where: { id: { in: assignment.targetStudentIds } },
            select: { id: true, name: true, surname: true },
          })
        : await prisma.student.findMany({
            where: { classId: assignment.lesson.classId },
            select: { id: true, name: true, surname: true },
          });

    const submissions = await prisma.studentSubmission.findMany({
      where: { assignmentId: assignment.id },
    });
    const submissionByStudent = new Map(submissions.map((s) => [s.studentId, s]));

    submissionRows = targetStudents.map((s) => {
      const sub = submissionByStudent.get(s.id);
      return {
        studentId: s.id,
        name: s.name,
        surname: s.surname,
        submission: sub
          ? {
              id: sub.id,
              fileUrl: sub.fileUrl,
              fileName: sub.fileName,
              submittedAt: sub.submittedAt?.toISOString() ?? null,
              status: sub.status,
              grade: sub.grade,
              feedback: sub.feedback,
              autoGraded: !!questions?.length,
            }
          : null,
      };
    });
  }

  return (
    <div className="flex-1 p-4 flex flex-col gap-4">
      <div className="panel-card p-5 md:p-6 shine-hover">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-blue-500 font-semibold mb-1">
              {assignment.lesson.subject.name} - Assignment
            </p>
            <h1 className="text-xl md:text-2xl font-bold text-blue-900 dark:text-blue-100">
              {assignment.title}
            </h1>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
              {assignment.lesson.class.name} - {assignment.lesson.teacher.name}{" "}
              {assignment.lesson.teacher.surname}
            </p>
          </div>
          <span
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border flex items-center gap-1.5 shrink-0 ${
              isOpen
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300"
                : "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300"
            }`}
          >
            <Clock size={12} />{" "}
            {isOpen ? `Due ${assignment.dueDate.toLocaleString()}` : "Closed"}
          </span>
        </div>
        {assignment.description && (
          <p className="text-sm text-gray-700 dark:text-slate-300 mt-4 whitespace-pre-wrap">
            {assignment.description}
          </p>
        )}
        <div className="flex flex-wrap gap-3 mt-4 text-xs text-gray-500 dark:text-slate-400">
          {assignment.totalMarks != null && <span>Total marks: {assignment.totalMarks}</span>}
          <span>Assigned: {assignment.startDate.toLocaleString()}</span>
        </div>
        {assignment.instructionsFileUrl && (
          <a
            href={assignment.instructionsFileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-300 hover:underline"
          >
            <FileText size={16} /> {assignment.instructionsFileName ?? "Download assignment paper"}
          </a>
        )}
      </div>

      {role === "student" && (
        <div className="panel-card p-5 md:p-6">
          <h2 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-3">
            Your submission
          </h2>
          <WorkSubmitPanel
            workType="assignment"
            workId={assignment.id}
            deadline={assignment.dueDate.toISOString()}
            questions={studentQuestions}
            existingSubmission={mySubmission}
          />
        </div>
      )}

      {(role === "admin" || role === "teacher") && (
        <div className="panel-card p-5 md:p-6">
          <h2 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-3">
            Submissions ({submissionRows.filter((r) => r.submission).length}/{submissionRows.length})
          </h2>
          <WorkSubmissionsPanel rows={submissionRows} />
        </div>
      )}
    </div>
  );
};

export default SingleAssignmentPage;
