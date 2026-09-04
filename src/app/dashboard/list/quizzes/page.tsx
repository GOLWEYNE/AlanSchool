import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { getUserRole } from "@/lib/auth";
import TeacherQuizManagement from "@/components/TeacherQuizManagement";

const QuizPage = async () => {
  const { userId, sessionClaims } = await auth();
  const role = getUserRole(sessionClaims);

  if (!userId || role !== "teacher") {
    return notFound();
  }

  return (
    <div className="flex-1 p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">
          Quiz Management
        </h1>
        <p className="text-gray-600 dark:text-gray-400">Create, edit, and manage quizzes for your classes</p>
      </div>
      <TeacherQuizManagement />
    </div>
  );
};

export default QuizPage;
