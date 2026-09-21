import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import prisma from "@/lib/prisma";
import { getUserRole } from "@/lib/auth";
import TeacherStudentWork from "@/components/TeacherStudentWork";

const StudentWorkPage = async () => {
  const { userId, sessionClaims } = await auth();
  const role = getUserRole(sessionClaims);

  if (!userId || role !== "teacher") {
    return notFound();
  }

  const t = await getTranslations("Assessments");

  return (
    <div className="flex-1 p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">
          {t("pages.studentWorkTitle")}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">{t("pages.studentWorkDesc")}</p>
      </div>
      <TeacherStudentWork />
    </div>
  );
};

export default StudentWorkPage;
