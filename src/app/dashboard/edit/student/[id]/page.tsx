import StudentEditForm from "@/components/forms/StudentEditForm";
import { getUserRole } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { sortRelatedData } from "@/lib/sort";

// Dedicated student edit page (same pattern as /dashboard/edit/teacher/[id]).
// Admin only: the route is also guarded in routeAccessMap, this check is a
// second layer so the page never renders for anyone else.
const StudentEditPage = async ({
  params: { id },
}: {
  params: { id: string };
}) => {
  const t = await getTranslations("Forms.student");
  const { sessionClaims } = auth();
  const role = getUserRole(sessionClaims);

  if (role !== "admin") {
    redirect(`/dashboard/list/students/${id}`);
  }

  const student = await prisma.student.findUnique({ where: { id } });
  if (!student) return notFound();

  const grades = await prisma.grade.findMany({
    select: { id: true, level: true },
  });
  const classes = await prisma.class.findMany({
    include: { _count: { select: { students: true } } },
  });

  return (
    <div className="p-4">
      <div className="bg-white rounded-md p-6 shadow-sm dark:bg-slate-900">
        <h1 className="text-2xl font-semibold mb-4 dark:text-blue-100">
          {t("editTitle")}
        </h1>
        <StudentEditForm
          studentId={student.id}
          data={student}
          relatedData={sortRelatedData({ grades, classes })}
        />
      </div>
    </div>
  );
};

export default StudentEditPage;
