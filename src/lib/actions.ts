"use server";

import { revalidatePath } from "next/cache";
import {
  AnnouncementSchema,
  AssignmentSchema,
  ClassSchema,
  ClubSchema,
  ExamSchema,
  EventSchema,
  LessonSchema,
  ParentSchema,
  ResultSchema,
  StudentSchema,
  SubjectSchema,
  TeacherSchema,
} from "./formValidationSchemas";
import prisma from "./prisma";
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
  if (!isAdminOrTeacher()) return rejectUnauthorized();
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
  if (!isAdminOrTeacher()) return rejectUnauthorized();
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
  if (!isAdminOrTeacher()) return rejectUnauthorized();
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
  // const { userId, sessionClaims } = auth();
  // const role = (sessionClaims?.metadata as { role?: string })?.role;

  try {
    // if (role === "teacher") {
    //   const teacherLesson = await prisma.lesson.findFirst({
    //     where: {
    //       teacherId: userId!,
    //       id: data.lessonId,
    //     },
    //   });

    //   if (!teacherLesson) {
    //     return { success: false, error: true };
    //   }
    // }

    await prisma.exam.create({
      data: {
        title: data.title,
        startTime: data.startTime,
        endTime: data.endTime,
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
  // const { userId, sessionClaims } = auth();
  // const role = (sessionClaims?.metadata as { role?: string })?.role;

  try {
    // if (role === "teacher") {
    //   const teacherLesson = await prisma.lesson.findFirst({
    //     where: {
    //       teacherId: userId!,
    //       id: data.lessonId,
    //     },
    //   });

    //   if (!teacherLesson) {
    //     return { success: false, error: true };
    //   }
    // }

    await prisma.exam.update({
      where: {
        id: data.id,
      },
      data: {
        title: data.title,
        startTime: data.startTime,
        endTime: data.endTime,
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
  if (!isAdmin()) return rejectUnauthorized();
  const id = data.get("id") as string;

  // const { userId, sessionClaims } = auth();
  // const role = (sessionClaims?.metadata as { role?: string })?.role;

  try {
    await prisma.exam.delete({
      where: {
        id: parseInt(id),
        // ...(role === "teacher" ? { lesson: { teacherId: userId! } } : {}),
      },
    });

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
  if (!isAdminOrTeacher()) return rejectUnauthorized();
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
        startDate: data.startDate,
        dueDate: data.dueDate,
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
        startDate: data.startDate,
        dueDate: data.dueDate,
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
  if (!isAdmin()) return rejectUnauthorized();
  const id = data.get("id") as string;

  try {
    await prisma.assignment.delete({
      where: { id: parseInt(id) },
    });

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
  if (!isAdmin()) return rejectUnauthorized();
  const id = data.get("id") as string;

  try {
    await prisma.result.delete({
      where: { id: parseInt(id) },
    });

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
