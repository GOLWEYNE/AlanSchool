import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { getUserRole } from "@/lib/auth";
import FormContainer from "@/components/FormContainer";
import TeacherExamManagement from "@/components/TeacherExamManagement";

const ExamManagementPage = async () => {
  const { userId, sessionClaims } = await auth();
  const role = getUserRole(sessionClaims);

  if (!userId || role !== "teacher") {
    return notFound();
  }

  const exams = await prisma.exam.findMany({
    where: { lesson: { teacherId: userId } },
    include: {
      lesson: {
        select: {
          subject: { select: { name: true } },
          class: { select: { name: true } },
        },
      },
    },
    orderBy: { startTime: "desc" },
  });

  // The create/update/delete controls are rendered here, in the server
  // page, because FormContainer queries Prisma itself (to build the
  // lesson/student/class pickers ExamForm needs) - it can't be imported
  // into TeacherExamManagement's "use client" module. Each row carries its
  // own already-rendered action buttons down as a prop.
  const rows = exams.map((exam: (typeof exams)[number]) => ({
    ...exam,
    actions: (
      <>
        <FormContainer table="exam" type="update" data={exam} />
        <FormContainer table="exam" type="delete" id={exam.id} />
      </>
    ),
  }));

  return (
    <div className="flex-1 p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">
          Exam Management
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Create, edit, and manage exams for specific classes or students
        </p>
      </div>
      <TeacherExamManagement
        exams={rows}
        createButton={<FormContainer table="exam" type="create" />}
      />
    </div>
  );
};

export default ExamManagementPage;
