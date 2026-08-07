import TeacherForm from "@/components/forms/TeacherForm";
import { getUserRole } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";

const TeacherEditPage = async ({
  params: { id },
}: {
  params: { id: string };
}) => {
  const { userId, sessionClaims } = auth();
  const role = getUserRole(sessionClaims);

  if (role === "teacher" && userId !== id) {
    redirect(`/dashboard/edit/teacher/${userId}`);
  }

  const teacher = await prisma.teacher.findUnique({
    where: { id },
    include: { subjects: true },
  });

  if (!teacher) {
    return notFound();
  }

  const subjectOptions = await prisma.subject.findMany({
    select: { id: true, name: true },
  });

  const teacherData = {
    ...teacher,
    subjects: teacher.subjects.map((subject) => String(subject.id)),
  };

  return (
    <div className="p-4">
      <div className="bg-white rounded-md p-6 shadow-sm">
        <h1 className="text-2xl font-semibold mb-4">Edit Teacher</h1>
        <TeacherForm
          type="update"
          data={teacherData}
          setOpen={() => {}}
          relatedData={{ subjects: subjectOptions }}
        />
      </div>
    </div>
  );
};

export default TeacherEditPage;
