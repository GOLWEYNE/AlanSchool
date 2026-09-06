import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { getUserRole } from "@/lib/auth";
import FormContainer from "@/components/FormContainer";
import TeacherQuizManagement from "@/components/TeacherQuizManagement";

const QuizPage = async () => {
  const { userId, sessionClaims } = await auth();
  const role = getUserRole(sessionClaims);

  if (!userId || role !== "teacher") {
    return notFound();
  }

  // There's no separate Quiz table in the schema - a "quiz" is an
  // Assignment that has the optional auto-graded question builder
  // (WorkQuizBuilder, in AssignmentForm) filled in. This view is a
  // filtered read of the teacher's own assignments, and reuses the same
  // AssignmentForm/createAssignment/updateAssignment plumbing to persist -
  // there's no separate quiz form or model to keep in sync.
  const assignments = await prisma.assignment.findMany({
    where: { lesson: { teacherId: userId } },
    include: {
      lesson: {
        select: {
          subject: { select: { name: true } },
          class: { select: { name: true } },
        },
      },
    },
    orderBy: { dueDate: "desc" },
  });

  const quizzes = assignments.filter(
    (a: (typeof assignments)[number]) =>
      Array.isArray(a.questions) && (a.questions as unknown[]).length > 0
  );

  const rows = quizzes.map((quiz: (typeof quizzes)[number]) => ({
    ...quiz,
    actions: (
      <>
        <FormContainer table="assignment" type="update" data={quiz} />
        <FormContainer table="assignment" type="delete" id={quiz.id} />
      </>
    ),
  }));

  return (
    <div className="flex-1 p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">
          Quiz Management
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Create and manage quizzes for your classes. A quiz is an assignment
          with auto-graded questions attached - turn on the quiz builder in
          the form below to add them.
        </p>
      </div>
      <TeacherQuizManagement
        quizzes={rows}
        createButton={<FormContainer table="assignment" type="create" />}
      />
    </div>
  );
};

export default QuizPage;
