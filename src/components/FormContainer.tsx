import prisma from "@/lib/prisma";
import FormModal from "./FormModal";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getUserRole } from "@/lib/auth";

export type FormContainerProps = {
  table:
    | "teacher"
    | "student"
    | "parent"
    | "subject"
    | "class"
    | "lesson"
    | "exam"
    | "assignment"
    | "result"
    | "attendance"
    | "event"
    | "announcement"
    | "club";
  type: "create" | "update" | "delete";
  data?: any;
  id?: number | string;
};

const FormContainer = async ({ table, type, data, id }: FormContainerProps) => {
  let relatedData = {};

  const user = await currentUser();
  const { userId, sessionClaims } = auth();
  const role = getUserRole(
    sessionClaims,
    ((user?.publicMetadata as { role?: string } | undefined)?.role ?? "") as string
  );
  const currentUserId = userId;

  // Centralized permission guard for all create/update/delete modals.
  if (role === "student" || role === "parent") {
    return null;
  }

  if (role === "teacher") {
    // Per the permission matrix, a teacher's create/update/delete rights
    // are restricted strictly to exams, assignments, results, and lesson
    // scheduling for their own classes — never subjects, classes, or user
    // accounts (those stay admin-only).
    const teacherFullCrudTables = ["exam", "assignment", "result"];
    const teacherCreateUpdateOnlyTables = ["lesson"];

    const allowed =
      teacherFullCrudTables.includes(table) ||
      (teacherCreateUpdateOnlyTables.includes(table) &&
        (type === "create" || type === "update"));

    if (!allowed) {
      return null;
    }
  }

  if (role !== "admin" && role !== "teacher") {
    return null;
  }

  if (type !== "delete") {
    switch (table) {
      case "subject":
        const subjectTeachers = await prisma.teacher.findMany({
          select: { id: true, name: true, surname: true },
        });
        relatedData = { teachers: subjectTeachers };
        break;
      case "lesson":
        const lessonSubjects = await prisma.subject.findMany({
          select: { id: true, name: true },
        });
        const lessonClasses = await prisma.class.findMany({
          select: { id: true, name: true },
        });
        const lessonTeachers = await prisma.teacher.findMany({
          select: { id: true, name: true, surname: true },
        });
        relatedData = {
          subjects: lessonSubjects,
          classes: lessonClasses,
          teachers: lessonTeachers,
        };
        break;
      case "class":
        const classGrades = await prisma.grade.findMany({
          select: { id: true, level: true },
        });
        const classTeachers = await prisma.teacher.findMany({
          select: { id: true, name: true, surname: true },
        });
        relatedData = { teachers: classTeachers, grades: classGrades };
        break;
      case "teacher":
        const teacherSubjects = await prisma.subject.findMany({
          select: { id: true, name: true },
        });
        relatedData = { subjects: teacherSubjects };
        break;
      case "student":
        const studentGrades = await prisma.grade.findMany({
          select: { id: true, level: true },
        });
        const studentClasses = await prisma.class.findMany({
          include: { _count: { select: { students: true } } },
        });
        relatedData = { classes: studentClasses, grades: studentGrades };
        break;
      case "parent":
        relatedData = {};
        break;
      case "exam": {
        const examLessons = await prisma.lesson.findMany({
          where: {
            ...(role === "teacher" ? { teacherId: currentUserId! } : {}),
          },
          select: { id: true, name: true, classId: true },
        });
        // Every student across every class the lessons above belong to, so
        // the "specific students" picker can filter client-side as the
        // teacher switches which lesson (and therefore which class) the
        // exam is for, with no extra round trip.
        const examStudents = await prisma.student.findMany({
          where: { classId: { in: examLessons.map((l) => l.classId) } },
          select: { id: true, name: true, surname: true, classId: true },
        });
        relatedData = { lessons: examLessons, students: examStudents };
        break;
      }
      case "assignment": {
        const assignmentLessons = await prisma.lesson.findMany({
          where: {
            ...(role === "teacher" ? { teacherId: currentUserId! } : {}),
          },
          select: { id: true, name: true, classId: true },
        });
        const assignmentStudents = await prisma.student.findMany({
          where: { classId: { in: assignmentLessons.map((l) => l.classId) } },
          select: { id: true, name: true, surname: true, classId: true },
        });
        relatedData = { lessons: assignmentLessons, students: assignmentStudents };
        break;
      }
      case "result":
        const resultStudents = await prisma.student.findMany({
          select: { id: true, name: true, surname: true },
        });
        const resultExams = await prisma.exam.findMany({
          where: {
            ...(role === "teacher"
              ? { lesson: { teacherId: currentUserId! } }
              : {}),
          },
          select: { id: true, title: true },
        });
        const resultAssignments = await prisma.assignment.findMany({
          where: {
            ...(role === "teacher"
              ? { lesson: { teacherId: currentUserId! } }
              : {}),
          },
          select: { id: true, title: true },
        });
        relatedData = {
          students: resultStudents,
          exams: resultExams,
          assignments: resultAssignments,
        };
        break;
      case "event":
        const eventClasses = await prisma.class.findMany({
          select: { id: true, name: true },
        });
        relatedData = { classes: eventClasses };
        break;
      case "announcement":
        const announcementClasses = await prisma.class.findMany({
          select: { id: true, name: true },
        });
        relatedData = { classes: announcementClasses };
        break;
      case "club":
        const clubTeachers = await prisma.teacher.findMany({
          select: { id: true, name: true, surname: true },
        });
        relatedData = { teachers: clubTeachers };
        break;

      default:
        break;
    }
  }

  return (
    <div className="">
      <FormModal
        table={table}
        type={type}
        data={data}
        id={id}
        relatedData={relatedData}
      />
    </div>
  );
};

export default FormContainer;
