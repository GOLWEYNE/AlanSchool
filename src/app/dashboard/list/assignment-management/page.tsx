import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import prisma from "@/lib/prisma";
import { getUserRole } from "@/lib/auth";
import FormContainer from "@/components/FormContainer";
import TeacherAssignmentManagement from "@/components/TeacherAssignmentManagement";

const AssignmentManagementPage = async () => {
  const { userId, sessionClaims } = await auth();
  const role = getUserRole(sessionClaims);

  if (!userId || role !== "teacher") {
    return notFound();
  }

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

  // Rendered here (server) for the same reason as exam-management: FormContainer
  // fetches its own Prisma relatedData and can't live inside a "use client" file.
  const rows = assignments.map((assignment: (typeof assignments)[number]) => ({
    ...assignment,
    actions: (
      <>
        <FormContainer table="assignment" type="update" data={assignment} />
        <FormContainer table="assignment" type="delete" id={assignment.id} />
      </>
    ),
  }));

  const t = await getTranslations("Assessments");

  return (
    <div className="flex-1 p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">
          {t("mgmt.assignmentTitle")}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {t("pages.assignmentManagementDesc")}
        </p>
      </div>
      <TeacherAssignmentManagement
        assignments={rows}
        createButton={<FormContainer table="assignment" type="create" />}
      />
    </div>
  );
};

export default AssignmentManagementPage;
