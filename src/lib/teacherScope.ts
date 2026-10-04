import prisma from "./prisma";
import { Prisma } from "@/generated/prisma/client";

// Teacher data scope.
//
// A teacher may only work with the students (and those students' parents) in
// classes that are theirs. A class is "theirs" when the teacher is its
// supervisor (homeroom teacher) OR teaches at least one lesson in it.
// Admins are never scoped - callers only apply these helpers when
// role === "teacher".
//
// Everything here is derived from the database on every call, so a change of
// supervisor or a new lesson takes effect immediately.

export const teacherClassWhere = (teacherId: string): Prisma.ClassWhereInput => ({
  OR: [{ supervisorId: teacherId }, { lessons: { some: { teacherId } } }],
});

export const getTeacherClassIds = async (teacherId: string): Promise<number[]> => {
  const rows = await prisma.class.findMany({
    where: teacherClassWhere(teacherId),
    select: { id: true },
  });
  return rows.map((r: { id: number }) => r.id);
};

// Prisma filters for list pages. An empty class list matches nothing, so a
// teacher with no classes sees empty lists - never everyone.
export const teacherStudentWhere = (classIds: number[]): Prisma.StudentWhereInput => ({
  classId: { in: classIds },
});

export const teacherParentWhere = (classIds: number[]): Prisma.ParentWhereInput => ({
  students: { some: { classId: { in: classIds } } },
});

// Point checks for detail pages and server actions.
export const teacherCanAccessClass = async (
  teacherId: string,
  classId: number
): Promise<boolean> => {
  const found = await prisma.class.findFirst({
    where: { id: classId, ...teacherClassWhere(teacherId) },
    select: { id: true },
  });
  return !!found;
};

export const teacherCanAccessStudent = async (
  teacherId: string,
  studentId: string
): Promise<boolean> => {
  const found = await prisma.student.findFirst({
    where: { id: studentId, class: teacherClassWhere(teacherId) },
    select: { id: true },
  });
  return !!found;
};

export const teacherCanAccessParent = async (
  teacherId: string,
  parentId: string
): Promise<boolean> => {
  const found = await prisma.parent.findFirst({
    where: { id: parentId, students: { some: { class: teacherClassWhere(teacherId) } } },
    select: { id: true },
  });
  return !!found;
};
