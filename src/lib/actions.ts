"use server";

import { revalidatePath } from "next/cache";
import {
  AnnouncementSchema,
  AssignmentSchema,
  ClassSchema,
  ClubSchema,
  ExamSchema,
  EventSchema,
  FeaturedVideoSchema,
  GradeSubmissionSchema,
  LessonSchema,
  ParentSchema,
  QuizQuestion,
  ResultSchema,
  StudentSchema,
  SubjectSchema,
  SubmissionSchema,
  TeacherSchema,
} from "./formValidationSchemas";
import prisma from "./prisma";
import { Prisma } from "@/generated/prisma/client";
import { clerkClient } from "@clerk/nextjs/server";
import { auth } from "@clerk/nextjs/server";
import { getUserRole } from "./auth";

type CurrentState = { success: boolean; error: boolean };

const getCurrentRole = () => {
  const { sessionClaims } = auth();
  return getUserRole(sessionClaims);
};

const isReadOnlyRole = (role: string) => {
  return role === "student" || role === "parent";
};

const isAdmin = () => {
  const role = getCurrentRole();
  return !isReadOnlyRole(role) && role === "admin";
};

const isAdminOrTeacher = () => {
  const role = getCurrentRole();
  if (isReadOnlyRole(role)) return false;
  return role === "admin" || role === "teacher";
};

const rejectUnauthorized = () => ({ success: false, error: true });

export const createSubject = async (
  currentState: CurrentState,
  data: SubjectSchema
) => {
  // Subjects are an admin-only concern — teachers get read access to
  // subjects via their assigned lessons/classes, but cannot create them.
  if (!isAdmin()) return rejectUnauthorized();
  try {
    await prisma.subject.create({
      data: {
        name: data.name,
        teachers: {
          connect: data.teachers.map((teacherId) => ({ id: teacherId })),
        },
      },
    });

    // revalidatePath("/list/subjects");
    return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true };
  }
};

export const updateSubject = async (
  currentState: CurrentState,
  data: SubjectSchema
) => {
  if (!isAdmin()) return rejectUnauthorized();
  try {
    await prisma.subject.update({
      where: {
        id: data.id,
      },
      data: {
        name: data.name,
        teachers: {
          set: data.teachers.map((teacherId) => ({ id: teacherId })),
        },
      },
    });

    // revalidatePath("/list/subjects");
    return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true };
  }
};

export const deleteSubject = async (
  currentState: CurrentState,
  data: FormData
) => {
  if (!isAdmin()) return rejectUnauthorized();
  const id = data.get("id") as string;
  try {
    await prisma.subject.delete({
      where: {
        id: parseInt(id),
      },
    });

    // revalidatePath("/list/subjects");
    return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true };
  }
};

export const createClass = async (
  currentState: CurrentState,
  data: ClassSchema
) => {
  if (!isAdmin()) return rejectUnauthorized();
  try {
    await prisma.class.create({
      data,
    });

    // revalidatePath("/list/class");
    return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true };
  }
};

export const updateClass = async (
  currentState: CurrentState,
  data: ClassSchema
) => {
  if (!isAdmin()) return rejectUnauthorized();
  try {
    await prisma.class.update({
      where: {
        id: data.id,
      },
      data,
    });

    // revalidatePath("/list/class");
    return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true };
  }
};

export const deleteClass = async (
  currentState: CurrentState,
  data: FormData
) => {
  if (!isAdmin()) return rejectUnauthorized();
  const id = data.get("id") as string;
  try {
    await prisma.class.delete({
      where: {
        id: parseInt(id),
      },
    });

    // revalidatePath("/list/class");
    return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true };
  }
};

export const createClub = async (
  currentState: CurrentState,
  data: ClubSchema
) => {
  if (!isAdmin()) return rejectUnauthorized();
  try {
    await prisma.club.create({
      data: {
        name: data.name,
        category: data.category,
        description: data.description || undefined,
        capacity: data.capacity,
        schedule: data.schedule || undefined,
        location: data.location || undefined,
        instructorId: data.instructorId || undefined,
      },
    });

    return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true };
  }
};

export const updateClub = async (
  currentState: CurrentState,
  data: ClubSchema
) => {
  if (!isAdmin()) return rejectUnauthorized();
  try {
    await prisma.club.update({
      where: {
        id: data.id,
      },
      data: {
        name: data.name,
        category: data.category,
        description: data.description || undefined,
        capacity: data.capacity,
        schedule: data.schedule || undefined,
        location: data.location || undefined,
        instructorId: data.instructorId || undefined,
      },
    });

    return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true };
  }
};

export const deleteClub = async (
  currentState: CurrentState,
  data: FormData
) => {
  if (!isAdmin()) return rejectUnauthorized();
  const id = data.get("id") as string;
  try {
    await prisma.club.delete({
      where: {
        id: parseInt(id),
      },
    });

    return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true };
  }
};

export const createTeacher = async (
  currentState: CurrentState,
  data: TeacherSchema
) => {
  if (!isAdmin()) return rejectUnauthorized();
  try {
    const user = await clerkClient.users.createUser({
      username: data.username,
      password: data.password,
      firstName: data.name,
      lastName: data.surname,
      publicMetadata:{role:"teacher"}
    });

    await prisma.teacher.create({
      data: {
        id: user.id,
        username: data.username,
        name: data.name,
        surname: data.surname,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address,
        img: data.img || null,
        bloodType: data.bloodType,
        sex: data.sex,
        birthday: data.birthday,
        subjects: {
          connect: data.subjects?.map((subjectId: string) => ({
            id: parseInt(subjectId),
          })),
        },
      },
    });

    // revalidatePath("/list/teachers");
    return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true };
  }
};

export const updateTeacher = async (
  currentState: CurrentState,
  data: TeacherSchema
) => {
  if (!data.id) {
    return { success: false, error: true };
  }

  const { userId, sessionClaims } = auth();
  const role = getUserRole(sessionClaims);

  if (isReadOnlyRole(role) || (role !== "admin" && role !== "teacher")) {
    return rejectUnauthorized();
  }

  if (role === "teacher" && userId !== data.id) {
    return rejectUnauthorized();
  }

  try {
    const user = await clerkClient.users.updateUser(data.id, {
      username: data.username,
      ...(data.password !== "" && { password: data.password }),
      firstName: data.name,
      lastName: data.surname,
    });

    await prisma.teacher.update({
      where: {
        id: data.id,
      },
      data: {
        ...(data.password !== "" && { password: data.password }),
        username: data.username,
        name: data.name,
        surname: data.surname,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address,
        img: data.img || null,
        bloodType: data.bloodType,
        sex: data.sex,
        birthday: data.birthday,
        subjects: {
          set: data.subjects?.map((subjectId: string) => ({
            id: parseInt(subjectId),
          })),
        },
      },
    });
    // revalidatePath("/list/teachers");
    return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true };
  }
};

export const deleteTeacher = async (
  currentState: CurrentState,
  data: FormData
) => {
  const id = data.get("id") as string;
  const { userId, sessionClaims } = auth();
  const role = getUserRole(sessionClaims);
  if (isReadOnlyRole(role) || (role !== "admin" && role !== "teacher")) {
    return rejectUnauthorized();
  }
  if (role === "teacher" && userId !== id) {
    return rejectUnauthorized();
  }
  try {
        try {
      await clerkClient.users.deleteUser(id);
    } catch (clerkErr) {
      // Some teachers are seeded straight into the database (QA/test
      // records, imports, etc.) and never get a matching Clerk user, so
      // Clerk's deleteUser call fails for them every time. Don't let a
      // missing (or already-removed) Clerk account block deleting the
      // school record itself.
      console.log(
        "deleteTeacher: Clerk deleteUser failed, continuing with DB delete:",
        clerkErr
      );
    }

    await prisma.teacher.delete({
      where: {
        id: id,
      },
    });

    // revalidatePath("/list/teachers");
    return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true };
  }
};

export const createStudent = async (
  currentState: CurrentState,
  data: StudentSchema
) => {
  // Creating student accounts is an admin-only user-management action.
  if (!isAdmin()) return rejectUnauthorized();
  console.log(data);
  try {
    const classItem = await prisma.class.findUnique({
      where: { id: data.classId },
      include: { _count: { select: { students: true } } },
    });

    if (classItem && classItem.capacity === classItem._count.students) {
      return { success: false, error: true };
    }

    const user = await clerkClient.users.createUser({
      username: data.username,
      password: data.password,
      firstName: data.name,
      lastName: data.surname,
      publicMetadata:{role:"student"}
    });

    await prisma.student.create({
      data: {
        id: user.id,
        username: data.username,
        name: data.name,
        surname: data.surname,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address,
        img: data.img || null,
        bloodType: data.bloodType,
        sex: data.sex,
        birthday: data.birthday,
        gradeId: data.gradeId,
        classId: data.classId,
        parentId: data.parentId,
      },
    });

    // revalidatePath("/list/students");
    return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true };
  }
};

export const updateStudent = async (
  currentState: CurrentState,
  data: StudentSchema
) => {
  if (!isAdmin()) return rejectUnauthorized();
  if (!data.id) {
    return { success: false, error: true };
  }
  try {
    const user = await clerkClient.users.updateUser(data.id, {
      username: data.username,
      ...(data.password !== "" && { password: data.password }),
      firstName: data.name,
      lastName: data.surname,
    });

    await prisma.student.update({
      where: {
        id: data.id,
      },
      data: {
        ...(data.password !== "" && { password: data.password }),
        username: data.username,
        name: data.name,
        surname: data.surname,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address,
        img: data.img || null,
        bloodType: data.bloodType,
        sex: data.sex,
        birthday: data.birthday,
        gradeId: data.gradeId,
        classId: data.classId,
        parentId: data.parentId,
      },
    });
    // revalidatePath("/list/students");
    return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true };
  }
};

export const deleteStudent = async (
  currentState: CurrentState,
  data: FormData
) => {
  if (!isAdmin()) return rejectUnauthorized();
  const id = data.get("id") as string;
  try {
        try {
      await clerkClient.users.deleteUser(id);
    } catch (clerkErr) {
      // See deleteTeacher: some records have no matching Clerk user
      // (seeded/imported directly), so don't let that block the DB delete.
      console.log(
        "deleteStudent: Clerk deleteUser failed, continuing with DB delete:",
        clerkErr
      );
    }

    await prisma.student.delete({
      where: {
        id: id,
      },
    });

    // revalidatePath("/list/students");
    return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true };
  }
};

export const createExam = async (
  currentState: CurrentState,
  data: ExamSchema
) => {
  if (!isAdminOrTeacher()) return rejectUnauthorized();
  const { userId } = auth();
  const role = getCurrentRole();

  try {
    // A teacher may only create exams on lessons they actually teach.
    if (role === "teacher") {
      const teacherLesson = await prisma.lesson.findFirst({
        where: {
          teacherId: userId!,
          id: data.lessonId,
        },
      });

      if (!teacherLesson) {
        return rejectUnauthorized();
      }
    }

    await prisma.exam.create({
      data: {
        title: data.title,
        description: data.description || null,
        startTime: data.startTime,
        endTime: data.endTime,
        totalMarks: data.totalMarks ?? null,
        durationMinutes: data.durationMinutes ?? null,
        instructionsFileUrl: data.instructionsFileUrl || null,
        instructionsFileName: data.instructionsFileName || null,
        questions: data.questions ?? Prisma.DbNull,
        targetStudentIds: data.targetStudentIds ?? [],
        lessonId: data.lessonId,
      },
    });

    // revalidatePath("/list/subjects");
    return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true };
  }
};

export const updateExam = async (
  currentState: CurrentState,
  data: ExamSchema
) => {
  if (!isAdminOrTeacher()) return rejectUnauthorized();
  const { userId } = auth();
  const role = getCurrentRole();

  try {
    // A teacher may only update exams on lessons they actually teach.
    if (role === "teacher") {
      const teacherLesson = await prisma.lesson.findFirst({
        where: {
          teacherId: userId!,
          id: data.lessonId,
        },
      });

      if (!teacherLesson) {
        return rejectUnauthorized();
      }
    }

    await prisma.exam.update({
      where: {
        id: data.id,
      },
      data: {
        title: data.title,
        description: data.description || null,
        startTime: data.startTime,
        endTime: data.endTime,
        totalMarks: data.totalMarks ?? null,
        durationMinutes: data.durationMinutes ?? null,
        instructionsFileUrl: data.instructionsFileUrl || null,
        instructionsFileName: data.instructionsFileName || null,
        questions: data.questions ?? Prisma.DbNull,
        targetStudentIds: data.targetStudentIds ?? [],
        lessonId: data.lessonId,
      },
    });

    // revalidatePath("/list/subjects");
    return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true };
  }
};

export const deleteExam = async (
  currentState: CurrentState,
  data: FormData
) => {
  // Teachers have full CRUD on exams, but strictly scoped to their own
  // lessons; admins can delete any exam.
  if (!isAdminOrTeacher()) return rejectUnauthorized();
  const id = data.get("id") as string;

  const { userId } = auth();
  const role = getCurrentRole();

  try {
    // Prisma's delete() only accepts a unique where-clause, so ownership
    // scoping for teachers is done via deleteMany + a relation filter; if
    // the exam isn't theirs, the filter matches nothing and count is 0.
    const { count } = await prisma.exam.deleteMany({
      where: {
        id: parseInt(id),
        ...(role === "teacher" ? { lesson: { teacherId: userId! } } : {}),
      },
    });

    if (count === 0) return rejectUnauthorized();

    // revalidatePath("/list/subjects");
    return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true };
  }
};

export const createParent = async (
  currentState: CurrentState,
  data: ParentSchema
) => {
  // Creating parent accounts is an admin-only user-management action.
  if (!isAdmin()) return rejectUnauthorized();
  try {
    const user = await clerkClient.users.createUser({
      username: data.username,
      password: data.password,
      firstName: data.name,
      lastName: data.surname,
      publicMetadata: { role: "parent" },
    });

    await prisma.parent.create({
      data: {
        id: user.id,
        username: data.username,
        name: data.name,
        surname: data.surname,
        email: data.email || null,
        phone: data.phone,
        address: data.address,
      },
    });

    return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true };
  }
};

export const updateParent = async (
  currentState: CurrentState,
  data: ParentSchema
) => {
  if (!isAdmin()) return rejectUnauthorized();
  if (!data.id) {
    return { success: false, error: true };
  }

  try {
    await clerkClient.users.updateUser(data.id, {
      username: data.username,
      ...(data.password !== "" && { password: data.password }),
      firstName: data.name,
      lastName: data.surname,
    });

    await prisma.parent.update({
      where: { id: data.id },
      data: {
        username: data.username,
        name: data.name,
        surname: data.surname,
        email: data.email || null,
        phone: data.phone,
        address: data.address,
      },
    });

    return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true };
  }
};

export const deleteParent = async (
  currentState: CurrentState,
  data: FormData
) => {
  if (!isAdmin()) return rejectUnauthorized();
  const id = data.get("id") as string;

  try {
        try {
      await clerkClient.users.deleteUser(id);
    } catch (clerkErr) {
      // See deleteTeacher: some records have no matching Clerk user
      // (seeded/imported directly), so don't let that block the DB delete.
      console.log(
        "deleteParent: Clerk deleteUser failed, continuing with DB delete:",
        clerkErr
      );
    }

    await prisma.parent.delete({
      where: { id },
    });

    return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true };
  }
};

export const createAssignment = async (
  currentState: CurrentState,
  data: AssignmentSchema
) => {
  const { userId, sessionClaims } = auth();
  const role = getUserRole(sessionClaims);

  if (isReadOnlyRole(role) || (role !== "admin" && role !== "teacher")) {
    return rejectUnauthorized();
  }

  try {
    if (role === "teacher") {
      const teacherLesson = await prisma.lesson.findFirst({
        where: {
          id: data.lessonId,
          teacherId: userId!,
        },
      });

      if (!teacherLesson) {
        return { success: false, error: true };
      }
    }

    await prisma.assignment.create({
      data: {
        title: data.title,
        description: data.description || null,
        startDate: data.startDate,
        dueDate: data.dueDate,
        totalMarks: data.totalMarks ?? null,
        instructionsFileUrl: data.instructionsFileUrl || null,
        instructionsFileName: data.instructionsFileName || null,
        questions: data.questions ?? Prisma.DbNull,
        targetStudentIds: data.targetStudentIds ?? [],
        lessonId: data.lessonId,
      },
    });

    return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true };
  }
};

export const updateAssignment = async (
  currentState: CurrentState,
  data: AssignmentSchema
) => {
  if (!data.id) {
    return { success: false, error: true };
  }

  const { userId, sessionClaims } = auth();
  const role = getUserRole(sessionClaims);

  if (isReadOnlyRole(role) || (role !== "admin" && role !== "teacher")) {
    return rejectUnauthorized();
  }

  try {
    if (role === "teacher") {
      const teacherLesson = await prisma.lesson.findFirst({
        where: {
          id: data.lessonId,
          teacherId: userId!,
        },
      });

      if (!teacherLesson) {
        return { success: false, error: true };
      }
    }

    await prisma.assignment.update({
      where: { id: data.id },
      data: {
        title: data.title,
        description: data.description || null,
        startDate: data.startDate,
        dueDate: data.dueDate,
        totalMarks: data.totalMarks ?? null,
        instructionsFileUrl: data.instructionsFileUrl || null,
        instructionsFileName: data.instructionsFileName || null,
        questions: data.questions ?? Prisma.DbNull,
        targetStudentIds: data.targetStudentIds ?? [],
        lessonId: data.lessonId,
      },
    });

    return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true };
  }
};

export const deleteAssignment = async (
  currentState: CurrentState,
  data: FormData
) => {
  // Teachers have full CRUD on assignments, scoped to their own lessons.
  if (!isAdminOrTeacher()) return rejectUnauthorized();
  const id = data.get("id") as string;
  const { userId } = auth();
  const role = getCurrentRole();

  try {
    const { count } = await prisma.assignment.deleteMany({
      where: {
        id: parseInt(id),
        ...(role === "teacher" ? { lesson: { teacherId: userId! } } : {}),
      },
    });

    if (count === 0) return rejectUnauthorized();

    return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true };
  }
};

export const createResult = async (
  currentState: CurrentState,
  data: ResultSchema
) => {
  const { userId, sessionClaims } = auth();
  const role = getUserRole(sessionClaims);

  if (isReadOnlyRole(role) || (role !== "admin" && role !== "teacher")) {
    return rejectUnauthorized();
  }

  try {
    if (!data.examId && !data.assignmentId) {
      return { success: false, error: true };
    }

    if (role === "teacher") {
      if (data.examId) {
        const exam = await prisma.exam.findFirst({
          where: { id: data.examId, lesson: { teacherId: userId! } },
        });
        if (!exam) return { success: false, error: true };
      }

      if (data.assignmentId) {
        const assignment = await prisma.assignment.findFirst({
          where: { id: data.assignmentId, lesson: { teacherId: userId! } },
        });
        if (!assignment) return { success: false, error: true };
      }
    }

    await prisma.result.create({
      data: {
        score: data.score,
        studentId: data.studentId,
        examId: data.examId,
        assignmentId: data.assignmentId,
      },
    });

    return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true };
  }
};

export const updateResult = async (
  currentState: CurrentState,
  data: ResultSchema
) => {
  if (!data.id) {
    return { success: false, error: true };
  }

  const { userId, sessionClaims } = auth();
  const role = getUserRole(sessionClaims);

  if (isReadOnlyRole(role) || (role !== "admin" && role !== "teacher")) {
    return rejectUnauthorized();
  }

  try {
    if (!data.examId && !data.assignmentId) {
      return { success: false, error: true };
    }

    if (role === "teacher") {
      if (data.examId) {
        const exam = await prisma.exam.findFirst({
          where: { id: data.examId, lesson: { teacherId: userId! } },
        });
        if (!exam) return { success: false, error: true };
      }

      if (data.assignmentId) {
        const assignment = await prisma.assignment.findFirst({
          where: { id: data.assignmentId, lesson: { teacherId: userId! } },
        });
        if (!assignment) return { success: false, error: true };
      }
    }

    await prisma.result.update({
      where: { id: data.id },
      data: {
        score: data.score,
        studentId: data.studentId,
        examId: data.examId,
        assignmentId: data.assignmentId,
      },
    });

    return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true };
  }
};

export const deleteResult = async (
  currentState: CurrentState,
  data: FormData
) => {
  // Teachers have full CRUD on results, scoped to exams/assignments on
  // lessons they teach.
  if (!isAdminOrTeacher()) return rejectUnauthorized();
  const id = data.get("id") as string;
  const { userId } = auth();
  const role = getCurrentRole();

  try {
    const { count } = await prisma.result.deleteMany({
      where: {
        id: parseInt(id),
        ...(role === "teacher"
          ? {
              OR: [
                { exam: { lesson: { teacherId: userId! } } },
                { assignment: { lesson: { teacherId: userId! } } },
              ],
            }
          : {}),
      },
    });

    if (count === 0) return rejectUnauthorized();

    return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true };
  }
};

export const createEvent = async (
  currentState: CurrentState,
  data: EventSchema
) => {
  if (!isAdmin()) return rejectUnauthorized();
  try {
    await prisma.event.create({
      data: {
        title: data.title,
        description: data.description,
        startTime: data.startTime,
        endTime: data.endTime,
        classId: data.classId || null,
      },
    });

    return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true };
  }
};

export const updateEvent = async (
  currentState: CurrentState,
  data: EventSchema
) => {
  if (!isAdmin()) return rejectUnauthorized();
  if (!data.id) {
    return { success: false, error: true };
  }

  try {
    await prisma.event.update({
      where: { id: data.id },
      data: {
        title: data.title,
        description: data.description,
        startTime: data.startTime,
        endTime: data.endTime,
        classId: data.classId || null,
      },
    });

    return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true };
  }
};

export const deleteEvent = async (
  currentState: CurrentState,
  data: FormData
) => {
  if (!isAdmin()) return rejectUnauthorized();
  const id = data.get("id") as string;

  try {
    await prisma.event.delete({
      where: { id: parseInt(id) },
    });

    return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true };
  }
};

export const createAnnouncement = async (
  currentState: CurrentState,
  data: AnnouncementSchema
) => {
  if (!isAdmin()) return rejectUnauthorized();
  try {
    await prisma.announcement.create({
      data: {
        title: data.title,
        description: data.description,
        date: data.date,
        classId: data.classId || null,
      },
    });

    return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true };
  }
};

export const updateAnnouncement = async (
  currentState: CurrentState,
  data: AnnouncementSchema
) => {
  if (!isAdmin()) return rejectUnauthorized();
  if (!data.id) {
    return { success: false, error: true };
  }

  try {
    await prisma.announcement.update({
      where: { id: data.id },
      data: {
        title: data.title,
        description: data.description,
        date: data.date,
        classId: data.classId || null,
      },
    });

    return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true };
  }
};

export const deleteAnnouncement = async (
  currentState: CurrentState,
  data: FormData
) => {
  if (!isAdmin()) return rejectUnauthorized();
  const id = data.get("id") as string;

  try {
    await prisma.announcement.delete({
      where: { id: parseInt(id) },
    });

    return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true };
  }
};


export const createLesson = async (
  currentState: CurrentState,
  data: LessonSchema
  ) => {
  const { userId, sessionClaims } = auth();
  const role = getUserRole(sessionClaims);
  if (isReadOnlyRole(role) || (role !== "admin" && role !== "teacher")) {
    return rejectUnauthorized();
  }
  if (role === "teacher" && data.teacherId !== userId) {
    return rejectUnauthorized();
  }

  try {
    await prisma.lesson.create({
      data: {
        name: data.name,
        day: data.day,
        startTime: data.startTime,
        endTime: data.endTime,
        subjectId: data.subjectId,
        classId: data.classId,
        teacherId: data.teacherId,
      },
    });

  return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true };
  }
};

export const updateLesson = async (
  currentState: CurrentState,
  data: LessonSchema
  ) => {
  if (!data.id) {
    return { success: false, error: true };
  }

  const { userId, sessionClaims } = auth();
  const role = getUserRole(sessionClaims);
  if (isReadOnlyRole(role) || (role !== "admin" && role !== "teacher")) {
    return rejectUnauthorized();
  }

  try {
    if (role === "teacher") {
      const existingLesson = await prisma.lesson.findFirst({
        where: { id: data.id, teacherId: userId! },
      });
      if (!existingLesson || data.teacherId !== userId) {
        return { success: false, error: true };
      }
    }

  await prisma.lesson.update({
    where: { id: data.id },
    data: {
      name: data.name,
      day: data.day,
      startTime: data.startTime,
      endTime: data.endTime,
      subjectId: data.subjectId,
      classId: data.classId,
      teacherId: data.teacherId,
    },
  });

  return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true };
  }
};

// Featured Video Announcement: Admin-only. Every save creates a fresh
// AnnouncementVideo row and deactivates whatever was active before, so
// FeaturedVideoPlayer can always just fetch the single isActive row while
// the school keeps a lightweight history of past broadcasts.
export const createFeaturedVideo = async (
  currentState: CurrentState,
  data: FeaturedVideoSchema
) => {
  if (!isAdmin()) return rejectUnauthorized();
  try {
    await prisma.announcementVideo.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    await prisma.announcementVideo.create({
      data: {
        title: data.title,
        videoUrl: data.videoUrl,
        isActive: true,
      },
    });

    revalidatePath("/dashboard");
    return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true };
  }
};

export const deactivateFeaturedVideo = async (
  currentState: CurrentState,
  data: FormData
) => {
  if (!isAdmin()) return rejectUnauthorized();
  const id = data.get("id") as string;
  try {
    await prisma.announcementVideo.update({
      where: { id },
      data: { isActive: false },
    });

    revalidatePath("/dashboard");
    return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true };
  }
};

export const deleteLesson = async (
  currentState: CurrentState,
  data: FormData
  ) => {
  if (!isAdmin()) {
    return rejectUnauthorized();
  }
  const id = data.get("id") as string;

  try {
    await prisma.lesson.delete({
      where: { id: parseInt(id) },
    });

  return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true };
  }
};

// ---- Online exam & assignment submission portal ------------------------

export type SubmissionActionState = {
  success: boolean;
  error: boolean;
  message?: string;
  autoScore?: number;
  autoTotal?: number;
};

// Keeps the shared gradebook (Result) in sync whenever a submission gets a
// grade, whether from a teacher typing a score or a quiz auto-grading
// itself. There's no DB-level uniqueness on Result (a teacher could
// already have hand-entered one via the classic Result form), so this
// looks the row up first rather than relying on upsert.
const syncResultScore = async (
  studentId: string,
  examId: number | null,
  assignmentId: number | null,
  score: number
) => {
  const existing = await prisma.result.findFirst({
    where: examId ? { examId, studentId } : { assignmentId: assignmentId!, studentId },
  });

  if (existing) {
    await prisma.result.update({ where: { id: existing.id }, data: { score } });
  } else {
    await prisma.result.create({
      data: {
        score,
        studentId,
        examId: examId ?? undefined,
        assignmentId: assignmentId ?? undefined,
      },
    });
  }
};

// A student uploading their completed file, and/or answering an
// auto-graded quiz, for one exam or assignment. Enforces that the work is
// actually assigned to them and that the deadline hasn't passed - once
// startTime/endTime (exam) or dueDate (assignment) is behind "now", the
// submission is refused outright rather than merely marked late.
export const submitStudentWork = async (
  currentState: SubmissionActionState,
  data: SubmissionSchema
): Promise<SubmissionActionState> => {
  const { userId, sessionClaims } = auth();
  const role = getUserRole(sessionClaims);

  if (role !== "student" || !userId) {
    return { success: false, error: true, message: "Only students can submit work." };
  }

  if (!data.examId && !data.assignmentId) {
    return { success: false, error: true, message: "Missing exam or assignment." };
  }

  if (!data.fileUrl && (!data.answers || data.answers.length === 0)) {
    return {
      success: false,
      error: true,
      message: "Attach a file or answer the questions before submitting.",
    };
  }

  try {
    const work = data.examId
      ? await prisma.exam.findUnique({
          where: { id: data.examId },
          include: { lesson: { select: { classId: true } } },
        })
      : await prisma.assignment.findUnique({
          where: { id: data.assignmentId },
          include: { lesson: { select: { classId: true } } },
        });

    if (!work) {
      return { success: false, error: true, message: "This exam or assignment no longer exists." };
    }

    const student = await prisma.student.findUnique({
      where: { id: userId },
      select: { classId: true },
    });
    if (!student) {
      return { success: false, error: true, message: "Student record not found." };
    }

    const targeted =
      work.targetStudentIds.length === 0
        ? student.classId === work.lesson.classId
        : work.targetStudentIds.includes(userId);

    if (!targeted) {
      return { success: false, error: true, message: "This isn't assigned to you." };
    }

    const deadline = data.examId ? (work as { endTime: Date }).endTime : (work as { dueDate: Date }).dueDate;
    if (new Date() > new Date(deadline)) {
      return {
        success: false,
        error: true,
        message: "The deadline has passed - submissions are closed for this one.",
      };
    }

    const questions = (work.questions as unknown as QuizQuestion[] | null) ?? null;
    let grade: number | null = null;
    let status: "SUBMITTED" | "GRADED" = "SUBMITTED";
    let autoScore: number | undefined;
    let autoTotal: number | undefined;

    if (questions && questions.length > 0 && data.answers) {
      let score = 0;
      let total = 0;
      questions.forEach((q, i) => {
        const points = q.points ?? 1;
        total += points;
        if (data.answers?.[i] === q.correctIndex) score += points;
      });
      grade = score;
      status = "GRADED";
      autoScore = score;
      autoTotal = total;
    }

    const now = new Date();
    const submissionData = {
      fileUrl: data.fileUrl || null,
      fileName: data.fileName || null,
      answers: data.answers ?? undefined,
      submittedAt: now,
      status,
      grade,
      gradedAt: status === "GRADED" ? now : null,
      feedback: status === "GRADED" ? "Auto-graded by the system." : null,
    };

    await prisma.studentSubmission.upsert({
      where: data.examId
        ? { examId_studentId: { examId: data.examId, studentId: userId } }
        : { assignmentId_studentId: { assignmentId: data.assignmentId!, studentId: userId } },
      create: {
        examId: data.examId ?? null,
        assignmentId: data.assignmentId ?? null,
        studentId: userId,
        ...submissionData,
      },
      update: submissionData,
    });

    if (status === "GRADED" && grade !== null) {
      await syncResultScore(userId, data.examId ?? null, data.assignmentId ?? null, grade);
    }

    revalidatePath("/dashboard/list/exams");
    revalidatePath("/dashboard/list/assignments");
    revalidatePath("/dashboard/list/results");

    return { success: true, error: false, autoScore, autoTotal };
  } catch (err) {
    console.log(err);
    return { success: false, error: true, message: "Something went wrong - please try again." };
  }
};

// A teacher/admin hand-grading one student's file submission (work that
// isn't an auto-graded quiz). Mirrors the score into Result so it shows
// up wherever the rest of the app already reads grades from.
export const gradeSubmission = async (
  currentState: CurrentState,
  data: GradeSubmissionSchema
) => {
  if (!isAdminOrTeacher()) return rejectUnauthorized();
  const { userId } = auth();
  const role = getCurrentRole();

  try {
    const submission = await prisma.studentSubmission.findUnique({
      where: { id: data.submissionId },
      include: {
        exam: { select: { lesson: { select: { teacherId: true } } } },
        assignment: { select: { lesson: { select: { teacherId: true } } } },
      },
    });

    if (!submission) return rejectUnauthorized();

    if (role === "teacher") {
      const teacherId =
        submission.exam?.lesson.teacherId ?? submission.assignment?.lesson.teacherId;
      if (teacherId !== userId) return rejectUnauthorized();
    }

    await prisma.studentSubmission.update({
      where: { id: data.submissionId },
      data: {
        grade: data.grade,
        feedback: data.feedback || null,
        status: "GRADED",
        gradedAt: new Date(),
        gradedById: userId!,
      },
    });

    await syncResultScore(
      submission.studentId,
      submission.examId,
      submission.assignmentId,
      data.grade
    );

    revalidatePath("/dashboard/list/exams");
    revalidatePath("/dashboard/list/assignments");
    revalidatePath("/dashboard/list/results");

    return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true };
  }
};
