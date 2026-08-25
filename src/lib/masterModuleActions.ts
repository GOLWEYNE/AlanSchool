"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import prisma from "./prisma";
import { getUserRole } from "./auth";
import {
      AttendanceBulkSchema,
      AttendanceRecordSchema,
      BehaviorLogSchema,
      ClubAttendanceSchema,
      ClubEnrollmentSchema,
      ClubSchema,
      ClubSessionSchema,
      ConferenceBookingSchema,
      ConferenceSlotSchema,
      LessonRoomSchema,
      MessageSchema,
      PermissionResponseSchema,
      PermissionSlipSchema,
      PortfolioItemSchema,
      ReportCardBulkGenerateSchema,
      ReportCardGenerateSchema,
      SubmissionCreateSchema,
      SubmissionGradeSchema,
      TicketCommentSchema,
      TicketSchema,
      TicketStatusSchema,
} from "./masterModuleSchemas";

type CurrentState = { success: boolean; error: boolean; message?: string };

const getCurrentRole = () => {
      const { sessionClaims } = auth();
      return getUserRole(sessionClaims);
};

const getCurrentUserId = () => {
      const { userId } = auth();
      return userId;
};

const isAdmin = () => getCurrentRole() === "admin";
const isAdminOrTeacher = () => {
      const role = getCurrentRole();
      return role === "admin" || role === "teacher";
};

const rejectUnauthorized = (): CurrentState => ({
      success: false,
      error: true,
      message: "You are not authorized to perform this action.",
});
const fail = (message?: string): CurrentState => ({
      success: false,
      error: true,
      message,
});
const ok = (): CurrentState => ({ success: true, error: false });

// A parent may only act on behalf of a student that is actually their
// child. Cheap ownership check reused across several modules below.
const parentOwnsStudent = async (parentId: string, studentId: string) => {
      const student = await prisma.student.findFirst({
              where: { id: studentId, parentId },
              select: { id: true },
      });
      return !!student;
};

// =====================================================================
// Module 1: Online Exam & Assignment Submission Portal
// =====================================================================

export const submitWork = async (
      currentState: CurrentState,
      data: SubmissionCreateSchema
    ) => {
      const role = getCurrentRole();
      const userId = getCurrentUserId();
      if (role !== "student" || !userId) return rejectUnauthorized();
      if (!data.examId && !data.assignmentId) {
              return fail("Select an exam or assignment to submit for.");
      }

      try {
              let due: Date | undefined;
              if (data.examId) {
                        const exam = await prisma.exam.findUnique({ where: { id: data.examId } });
                        if (!exam) return fail("Exam not found.");
                        due = exam.endTime;
              }
              if (data.assignmentId) {
                        const assignment = await prisma.assignment.findUnique({
                                    where: { id: data.assignmentId },
                        });
                        if (!assignment) return fail("Assignment not found.");
                        due = assignment.dueDate;
              }

        const isLate = due ? new Date() > due : false;

        await prisma.studentSubmission.create({
                  data: {
                              examId: data.examId,
                              assignmentId: data.assignmentId,
                              studentId: userId,
                              fileUrl: data.fileUrl || null,
                              content: data.content || null,
                              submittedAt: new Date(),
                              status: isLate ? "LATE" : "SUBMITTED",
                  },
        });

        revalidatePath("/dashboard/list/assignments");
              revalidatePath("/dashboard/list/exams");
              return ok();
      } catch (err) {
              console.log(err);
              return fail();
      }
};

export const gradeSubmission = async (
      currentState: CurrentState,
      data: SubmissionGradeSchema
    ) => {
      if (!isAdminOrTeacher()) return rejectUnauthorized();
      try {
              await prisma.studentSubmission.update({
                        where: { id: data.id },
                        data: {
                                    grade: data.grade,
                                    feedback: data.feedback || null,
            status: "GRADED",
                                    gradedAt: new Date(),
                                    gradedById: getCurrentUserId() ?? undefined,
                        },
              });
              revalidatePath("/dashboard/list/assignments");
              revalidatePath("/dashboard/list/exams");
              return ok();
      } catch (err) {
              console.log(err);
              return fail();
      }
};

// =====================================================================
// Module 2: Automated Attendance Tracker
// =====================================================================

// Prisma's generated WhereUniqueInput for a compound @@unique that
// includes a nullable field (lessonId here) does not accept `null` —
// Postgres unique indexes don't treat NULLs as equal, so Prisma can't
// use it as a lookup key. We look the row up manually instead of using
// upsert's compound-unique shortcut.
const upsertAttendanceRecord = async (args: {
      studentId: string;
      classId: number;
      lessonId?: number;
      date: Date;
      status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
      note?: string;
      markedById?: string;
}) => {
      const existing = await prisma.attendanceRecord.findFirst({
              where: {
                        studentId: args.studentId,
                        date: args.date,
                        lessonId: args.lessonId ?? null,
              },
              select: { id: true },
      });

      if (existing) {
              return prisma.attendanceRecord.update({
                        where: { id: existing.id },
                        data: { status: args.status, note: args.note || null },
              });
      }

      return prisma.attendanceRecord.create({
              data: {
                        studentId: args.studentId,
                        classId: args.classId,
                        lessonId: args.lessonId,
                        date: args.date,
                        status: args.status,
                        note: args.note || null,
                        markedById: args.markedById,
              },
      });
};

export const recordAttendance = async (
      currentState: CurrentState,
      data: AttendanceRecordSchema
    ) => {
      if (!isAdminOrTeacher()) return rejectUnauthorized();
      try {
              await upsertAttendanceRecord({
                        studentId: data.studentId,
                        classId: data.classId,
                        lessonId: data.lessonId,
                        date: data.date,
                        status: data.status,
                        note: data.note,
                        markedById: getCurrentUserId() ?? undefined,
              });
              revalidatePath("/dashboard/list/attendance");
              return ok();
      } catch (err) {
              console.log(err);
              return fail();
      }
};

// Log a full class's attendance for a single day/period in one call —
// backs the matrix-grid UI so a teacher can submit a whole class at once.
export const recordAttendanceBulk = async (
      currentState: CurrentState,
      data: AttendanceBulkSchema
    ) => {
      if (!isAdminOrTeacher()) return rejectUnauthorized();
      const markedById = getCurrentUserId() ?? undefined;
      try {
              for (const r of data.records) {
                        await upsertAttendanceRecord({
                                    studentId: r.studentId,
                                    classId: data.classId,
                                    lessonId: data.lessonId,
                                    date: data.date,
                                    status: r.status,
                                    note: r.note,
                                    markedById,
                        });
              }
              revalidatePath("/dashboard/list/attendance");
              return ok();
      } catch (err) {
              console.log(err);
              return fail();
      }
};

// =====================================================================
// Module 3: Behavior Feedback & Communication Hub
// =====================================================================

export const createBehaviorLog = async (
      currentState: CurrentState,
      data: BehaviorLogSchema
    ) => {
      if (!isAdminOrTeacher()) return rejectUnauthorized();
      const userId = getCurrentUserId();
      if (!userId) return rejectUnauthorized();
      try {
              await prisma.behaviorLog.create({
                        data: {
                                    studentId: data.studentId,
                                    teacherId: userId,
                                    type: data.type,
                                    title: data.title,
                                    description: data.description,
                                    visibleToParent: data.visibleToParent ?? true,
                        },
              });
              revalidatePath("/dashboard/list/students");
              return ok();
      } catch (err) {
              console.log(err);
              return fail();
      }
};

export const deleteBehaviorLog = async (
      currentState: CurrentState,
      formData: FormData
    ) => {
      if (!isAdminOrTeacher()) return rejectUnauthorized();
      const id = formData.get("id") as string;
      try {
              await prisma.behaviorLog.delete({ where: { id: parseInt(id) } });
              revalidatePath("/dashboard/list/students");
              return ok();
      } catch (err) {
              console.log(err);
              return fail();
      }
};

// Every role table (Admin/Teacher/Student/Parent) shares Clerk user ids,
// so the sender is simply "whoever is currently authenticated."
export const sendMessage = async (
      currentState: CurrentState,
      data: MessageSchema
    ) => {
      const role = getCurrentRole();
      const userId = getCurrentUserId();
      if (!userId || !role) return rejectUnauthorized();
      try {
              await prisma.message.create({
                        data: {
                                    senderId: userId,
                                    senderRole: role,
                                    receiverId: data.receiverId,
                                    receiverRole: data.receiverRole,
                                    studentId: data.studentId || null,
                                    content: data.content,
                        },
              });
              revalidatePath("/dashboard/list/announcements");
              return ok();
      } catch (err) {
              console.log(err);
              return fail();
      }
};

export const markMessageRead = async (
      currentState: CurrentState,
      formData: FormData
    ) => {
      const userId = getCurrentUserId();
      if (!userId) return rejectUnauthorized();
      const id = formData.get("id") as string;
      try {
              await prisma.message.update({
                        where: { id: parseInt(id) },
                        data: { readAt: new Date() },
              });
              return ok();
      } catch (err) {
              console.log(err);
              return fail();
      }
};

// =====================================================================
// Module 4: Remote Parent Master Dashboard — permission slips
// =====================================================================

export const createPermissionSlip = async (
      currentState: CurrentState,
      data: PermissionSlipSchema
    ) => {
      if (!isAdminOrTeacher()) return rejectUnauthorized();
      const userId = getCurrentUserId();
      if (!userId) return rejectUnauthorized();
      try {
              const slip = await prisma.permissionSlip.create({
                        data: {
                                    title: data.title,
                                    description: data.description,
                                    eventDate: data.eventDate,
                                    classId: data.classId || null,
                                    createdById: userId,
                        },
              });

        // Auto-create a pending response row for every student the slip
        // applies to, so parents see it immediately in their dashboard.
        const students = await prisma.student.findMany({
                  where: data.classId ? { classId: data.classId } : {},
                  select: { id: true, parentId: true },
        });
              if (students.length) {
                        await prisma.permissionResponse.createMany({
                                    data: students.map((s) => ({
                                                  permissionSlipId: slip.id,
                                                  studentId: s.id,
                                                  parentId: s.parentId,
                                    })),
                                    skipDuplicates: true,
                        });
              }

        revalidatePath("/dashboard/parent");
              return ok();
      } catch (err) {
              console.log(err);
              return fail();
      }
};

export const respondToPermissionSlip = async (
      currentState: CurrentState,
      data: PermissionResponseSchema
    ) => {
      const role = getCurrentRole();
      const userId = getCurrentUserId();
      if (role !== "parent" || !userId) return rejectUnauthorized();
      try {
              const response = await prisma.permissionResponse.findUnique({
                        where: { id: data.id },
              });
              if (!response || response.parentId !== userId) return rejectUnauthorized();

        await prisma.permissionResponse.update({
                  where: { id: data.id },
                  data: {
                              status: data.status,
                              signatureDataUrl: data.signatureDataUrl || null,
                              respondedAt: new Date(),
                  },
        });
              revalidatePath("/dashboard/parent");
              return ok();
      } catch (err) {
              console.log(err);
              return fail();
      }
};

// =====================================================================
// Module 5: Student Digital Portfolio & Achievement Showcase
// =====================================================================

export const createPortfolioItem = async (
      currentState: CurrentState,
      data: PortfolioItemSchema
    ) => {
      const role = getCurrentRole();
      const userId = getCurrentUserId();
      if (!userId) return rejectUnauthorized();
      if (role === "student" && data.studentId !== userId) return rejectUnauthorized();
      if (!isAdminOrTeacher() && role !== "student") return rejectUnauthorized();

      try {
              await prisma.portfolioItem.create({
                        data: {
                                    studentId: data.studentId,
                                    title: data.title,
                                    description: data.description || null,
                                    category: data.category,
                                    fileUrl: data.fileUrl || null,
                                    imageUrl: data.imageUrl || null,
                                    schoolYear: data.schoolYear,
                                    dateAchieved: data.dateAchieved,
                        },
              });
              revalidatePath("/dashboard/list/students");
              return ok();
      } catch (err) {
              console.log(err);
              return fail();
      }
};

export const deletePortfolioItem = async (
      currentState: CurrentState,
      formData: FormData
    ) => {
      const role = getCurrentRole();
      const userId = getCurrentUserId();
      const id = formData.get("id") as string;
      try {
              const item = await prisma.portfolioItem.findUnique({
                        where: { id: parseInt(id) },
              });
              if (!item) return fail("Not found.");
              if (!isAdminOrTeacher() && !(role === "student" && item.studentId === userId)) {
                        return rejectUnauthorized();
              }
              await prisma.portfolioItem.delete({ where: { id: parseInt(id) } });
              revalidatePath("/dashboard/list/students");
              return ok();
      } catch (err) {
              console.log(err);
              return fail();
      }
};

// =====================================================================
// Module 6: Automated Report Card Generation & Digital Archiving
// =====================================================================

// Shared by the single-student and class-wide (bulk) generation actions
// below. Computes GPA / attendance rate / behavior summary, upserts the
// ReportCard row, and stamps a stable pdfUrl pointing at the on-demand
// PDF route (the PDF itself is rendered lazily on request, not stored
// as a static file).
const buildReportCardForStudent = async (
      studentId: string,
      term: ReportCardGenerateSchema["term"],
      schoolYear: string,
      generatedById?: string
    ) => {
      const [results, attendance] = await Promise.all([
                prisma.result.findMany({ where: { studentId } }),
                prisma.attendanceRecord.findMany({ where: { studentId } }),
              ]);

      const gpa = results.length
        ? results.reduce((sum, r) => sum + r.score, 0) / results.length
          : null;
      const attendanceRate = attendance.length
        ? (attendance.filter((a) => a.status === "PRESENT").length /
                     attendance.length) *
                  100
                : null;

      const behaviorLogs = await prisma.behaviorLog.findMany({
                where: { studentId },
                orderBy: { date: "desc" },
                take: 5,
      });
      const behaviorSummary = behaviorLogs.length
        ? behaviorLogs.map((b) => `${b.type}: ${b.title}`).join("; ")
                : null;

      const reportCard = await prisma.reportCard.upsert({
                where: {
                            studentId_term_schoolYear: {
                                          studentId,
                                          term,
                                          schoolYear,
                            },
                },
                update: {
                            gpa,
                            attendanceRate,
                            behaviorSummary,
                            generatedAt: new Date(),
                            generatedById: generatedById ?? undefined,
                },
                create: {
                            studentId,
                            term,
                            schoolYear,
                            gpa,
                            attendanceRate,
                            behaviorSummary,
                            generatedById: generatedById ?? undefined,
                },
      });

      const pdfUrl = `/api/report-cards/${reportCard.id}/pdf`;
      if (reportCard.pdfUrl !== pdfUrl) {
                await prisma.reportCard.update({
                          where: { id: reportCard.id },
                          data: { pdfUrl },
                });
      }

      return reportCard;
};

export const generateReportCard = async (
      currentState: CurrentState,
      data: ReportCardGenerateSchema
    ) => {
      if (!isAdminOrTeacher()) return rejectUnauthorized();
      try {
              await buildReportCardForStudent(
                        data.studentId,
                        data.term,
                        data.schoolYear,
                        getCurrentUserId() ?? undefined
              );

        revalidatePath("/dashboard/list/results");
              revalidatePath("/dashboard/list/students");
              revalidatePath("/dashboard/list/report-cards");
              return ok();
      } catch (err) {
              console.log(err);
              return fail();
      }
};

export const generateReportCardsForClass = async (
      currentState: CurrentState,
      data: ReportCardBulkGenerateSchema
    ) => {
      if (!isAdminOrTeacher()) return rejectUnauthorized();
      try {
              const students = await prisma.student.findMany({
                        where: { classId: data.classId },
                        select: { id: true },
              });

        if (!students.length) return fail("No students found in this class.");

              const generatedById = getCurrentUserId() ?? undefined;
              for (const student of students) {
                        await buildReportCardForStudent(
                                  student.id,
                                  data.term,
                                  data.schoolYear,
                                  generatedById
                        );
              }

        revalidatePath("/dashboard/list/results");
              revalidatePath("/dashboard/list/students");
              revalidatePath("/dashboard/list/report-cards");
              return ok();
      } catch (err) {
              console.log(err);
              return fail();
      }
};

// =====================================================================
// Module 7: Personalized Timetable & Classroom Locator
// =====================================================================

export const setLessonRoom = async (
      currentState: CurrentState,
      data: LessonRoomSchema
    ) => {
      if (!isAdminOrTeacher()) return rejectUnauthorized();
      try {
              await prisma.lesson.update({
                        where: { id: data.id },
                        data: { room: data.room },
              });
              revalidatePath("/dashboard/list/lessons");
              return ok();
      } catch (err) {
              console.log(err);
              return fail();
      }
};

// =====================================================================
// Module 8: Lost & Found / Student Support Ticketing System
// =====================================================================

export const createTicket = async (
      currentState: CurrentState,
      data: TicketSchema
    ) => {
      const role = getCurrentRole();
      const userId = getCurrentUserId();
      if (!userId || !role) return rejectUnauthorized();
      try {
              await prisma.ticket.create({
                        data: {
                                    title: data.title,
                                    description: data.description,
                                    category: data.category,
                                    priority: data.priority ?? "MEDIUM",
                                    studentId: data.studentId || null,
                                    createdById: userId,
                                    createdByRole: role,
                        },
              });
              revalidatePath("/dashboard/list/announcements");
              return ok();
      } catch (err) {
              console.log(err);
              return fail();
      }
};

export const updateTicketStatus = async (
      currentState: CurrentState,
      data: TicketStatusSchema
    ) => {
      if (!isAdminOrTeacher()) return rejectUnauthorized();
      try {
              await prisma.ticket.update({
                        where: { id: data.id },
                        data: {
                                    status: data.status,
                                    assignedToId: data.assignedToId || undefined,
                                    resolvedAt: data.status === "RESOLVED" || data.status === "CLOSED"
                                      ? new Date()
                                                  : null,
                        },
              });
              revalidatePath("/dashboard/list/announcements");
              return ok();
      } catch (err) {
              console.log(err);
              return fail();
      }
};

export const addTicketComment = async (
      currentState: CurrentState,
      data: TicketCommentSchema
    ) => {
      const role = getCurrentRole();
      const userId = getCurrentUserId();
      if (!userId || !role) return rejectUnauthorized();
      try {
              await prisma.ticketComment.create({
                        data: {
                                    ticketId: data.ticketId,
                                    authorId: userId,
                                    authorRole: role,
                                    message: data.message,
                        },
              });
              revalidatePath("/dashboard/list/announcements");
              return ok();
      } catch (err) {
              console.log(err);
              return fail();
      }
};

// =====================================================================
// Module 9: Parent-Teacher Conference Scheduling Hub
// =====================================================================

export const createConferenceSlot = async (
      currentState: CurrentState,
      data: ConferenceSlotSchema
    ) => {
      const role = getCurrentRole();
      const userId = getCurrentUserId();
      if (role !== "teacher" || !userId) return rejectUnauthorized();
      try {
              await prisma.conferenceSlot.create({
                        data: {
                                    teacherId: userId,
                                    startTime: data.startTime,
                                    endTime: data.endTime,
                                    location: data.location ?? "IN_PERSON",
                        },
              });
              revalidatePath("/dashboard/teacher");
              return ok();
      } catch (err) {
              console.log(err);
              return fail();
      }
};

export const deleteConferenceSlot = async (
      currentState: CurrentState,
      formData: FormData
    ) => {
      const role = getCurrentRole();
      const userId = getCurrentUserId();
      const id = formData.get("id") as string;
      try {
              const slot = await prisma.conferenceSlot.findUnique({
                        where: { id: parseInt(id) },
              });
              if (!slot) return fail("Not found.");
              if (role !== "admin" && slot.teacherId !== userId) return rejectUnauthorized();
              await prisma.conferenceSlot.delete({ where: { id: parseInt(id) } });
              revalidatePath("/dashboard/teacher");
              return ok();
      } catch (err) {
              console.log(err);
              return fail();
      }
};

// 15-minute parent-teacher conference booking. Bound in a transaction so
// two parents can never double-book the same slot.
export const bookConferenceSlot = async (
      currentState: CurrentState,
      data: ConferenceBookingSchema
    ) => {
      const role = getCurrentRole();
      const userId = getCurrentUserId();
      if (role !== "parent" || !userId) return rejectUnauthorized();
      if (!(await parentOwnsStudent(userId, data.studentId))) {
              return rejectUnauthorized();
      }
      try {
              await prisma.$transaction(async (tx) => {
                        const slot = await tx.conferenceSlot.findUnique({
                                    where: { id: data.slotId },
                        });
                        if (!slot || slot.isBooked) {
                                    throw new Error("This slot is no longer available.");
                        }
                        await tx.conferenceBooking.create({
                                    data: {
                                                  slotId: data.slotId,
                                                  studentId: data.studentId,
                                                  parentId: userId,
                                                  notes: data.notes || null,
                                    },
                        });
                        await tx.conferenceSlot.update({
                                    where: { id: data.slotId },
                                    data: { isBooked: true },
                        });
              });
              revalidatePath("/dashboard/parent");
              return ok();
      } catch (err) {
              console.log(err);
              return fail(err instanceof Error ? err.message : undefined);
      }
};

export const cancelConferenceBooking = async (
      currentState: CurrentState,
      formData: FormData
    ) => {
      const role = getCurrentRole();
      const userId = getCurrentUserId();
      const id = formData.get("id") as string;
      try {
              const booking = await prisma.conferenceBooking.findUnique({
                        where: { id: parseInt(id) },
              });
              if (!booking) return fail("Not found.");
              if (role !== "admin" && booking.parentId !== userId) return rejectUnauthorized();

        await prisma.$transaction([
                  prisma.conferenceBooking.delete({ where: { id: parseInt(id) } }),
                  prisma.conferenceSlot.update({
                              where: { id: booking.slotId },
                              data: { isBooked: false },
                  }),
                ]);
              revalidatePath("/dashboard/parent");
              return ok();
      } catch (err) {
              console.log(err);
              return fail();
      }
};

// =====================================================================
// Module 10: Extracurricular Activities & Club Management
// =====================================================================

export const createClub = async (currentState: CurrentState, data: ClubSchema) => {
      if (!isAdmin()) return rejectUnauthorized();
      try {
              await prisma.club.create({
                        data: {
                                    name: data.name,
                                    category: data.category,
                                    description: data.description || null,
                                    capacity: data.capacity,
                                    schedule: data.schedule || null,
                                    location: data.location || null,
                                    instructorId: data.instructorId || null,
                        },
              });
              revalidatePath("/dashboard/list/classes");
              return ok();
      } catch (err) {
              console.log(err);
              return fail();
      }
};

export const updateClub = async (currentState: CurrentState, data: ClubSchema) => {
      if (!isAdmin() || !data.id) return rejectUnauthorized();
      try {
              await prisma.club.update({
                        where: { id: data.id },
                        data: {
                                    name: data.name,
                                    category: data.category,
                                    description: data.description || null,
                                    capacity: data.capacity,
                                    schedule: data.schedule || null,
                                    location: data.location || null,
                                    instructorId: data.instructorId || null,
                        },
              });
              revalidatePath("/dashboard/list/classes");
              return ok();
      } catch (err) {
              console.log(err);
              return fail();
      }
};

export const deleteClub = async (currentState: CurrentState, formData: FormData) => {
      if (!isAdmin()) return rejectUnauthorized();
      const id = formData.get("id") as string;
      try {
              await prisma.club.delete({ where: { id: parseInt(id) } });
              revalidatePath("/dashboard/list/classes");
              return ok();
      } catch (err) {
              console.log(err);
              return fail();
      }
};

export const enrollInClub = async (
      currentState: CurrentState,
      data: ClubEnrollmentSchema
    ) => {
      const role = getCurrentRole();
      const userId = getCurrentUserId();
      if (!userId) return rejectUnauthorized();
      if (role === "parent" && !(await parentOwnsStudent(userId, data.studentId))) {
              return rejectUnauthorized();
      }
      if (role === "student" && data.studentId !== userId) return rejectUnauthorized();
      if (!["admin", "teacher", "parent", "student"].includes(role)) {
              return rejectUnauthorized();
      }

      try {
              const club = await prisma.club.findUnique({
                        where: { id: data.clubId },
                        include: { _count: { select: { enrollments: true } } },
              });
              if (!club) return fail("Club not found.");

        const status = club._count.enrollments >= club.capacity ? "WAITLISTED" : "ACTIVE";

        await prisma.clubEnrollment.create({
                  data: { clubId: data.clubId, studentId: data.studentId, status },
        });
              revalidatePath("/dashboard/list/classes");
              return ok();
      } catch (err) {
              console.log(err);
              return fail("Already enrolled, or this club is unavailable.");
      }
};

export const withdrawFromClub = async (
      currentState: CurrentState,
      formData: FormData
    ) => {
      const role = getCurrentRole();
      const userId = getCurrentUserId();
      const id = formData.get("id") as string;
      try {
              const enrollment = await prisma.clubEnrollment.findUnique({
                        where: { id: parseInt(id) },
              });
              if (!enrollment) return fail("Not found.");
              if (
                        !isAdminOrTeacher() &&
                        !(role === "student" && enrollment.studentId === userId) &&
                        !(role === "parent" && userId && (await parentOwnsStudent(userId, enrollment.studentId)))
                      ) {
                        return rejectUnauthorized();
              }
              await prisma.clubEnrollment.update({
                        where: { id: parseInt(id) },
                        data: { status: "WITHDRAWN" },
              });
              revalidatePath("/dashboard/list/classes");
              return ok();
      } catch (err) {
              console.log(err);
              return fail();
      }
};

export const createClubSession = async (
      currentState: CurrentState,
      data: ClubSessionSchema
    ) => {
      if (!isAdminOrTeacher()) return rejectUnauthorized();
      try {
              await prisma.clubSession.create({
                        data: {
                                    clubId: data.clubId,
                                    date: data.date,
                                    startTime: data.startTime,
                                    endTime: data.endTime,
                        },
              });
              revalidatePath("/dashboard/list/classes");
              return ok();
      } catch (err) {
              console.log(err);
              return fail();
      }
};

export const recordClubAttendance = async (
      currentState: CurrentState,
      data: ClubAttendanceSchema
    ) => {
      if (!isAdminOrTeacher()) return rejectUnauthorized();
      try {
              await prisma.clubAttendance.upsert({
                        where: {
                                    clubSessionId_studentId: {
                                                  clubSessionId: data.clubSessionId,
                                                  studentId: data.studentId,
                                    },
                        },
                        update: { status: data.status },
                        create: {
                                    clubSessionId: data.clubSessionId,
                                    studentId: data.studentId,
                                    status: data.status,
                        },
              });
              revalidatePath("/dashboard/list/classes");
              return ok();
      } catch (err) {
              console.log(err);
              return fail();
      }
};
