"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import prisma from "./prisma";
import { getUserRole } from "./auth";
import { notifyUser } from "./notify";
import { getTranslations } from "next-intl/server";
import { fromWallClock, schoolDayRange } from "./schoolTime";
import {
      AttendanceBulkSchema,
      AttendanceRecordSchema,
      BehaviorLogSchema,
      CheckInScanSchema,
      checkInScanSchema,
      ClubAttendanceBulkSchema,
      clubAttendanceBulkSchema,
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
import { sanitizeForBadge } from "./barcode39";

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

// Server-action messages surface in toasts, so they follow the NEXT_LOCALE
// cookie the same way page content does.
const sm = async (key: string, values?: Record<string, string | number>) =>
  (await getTranslations("ServerMessages"))(key, values);

const rejectUnauthorized = async (): Promise<CurrentState> => ({
      success: false,
      error: true,
      message: await sm("notAuthorized"),
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
              return fail(await sm("selectWork"));
      }

      try {
              let due: Date | undefined;
              if (data.examId) {
                        const exam = await prisma.exam.findUnique({ where: { id: data.examId } });
                        if (!exam) return fail(await sm("examNotFound"));
                        due = exam.endTime;
              }
              if (data.assignmentId) {
                        const assignment = await prisma.assignment.findUnique({
                                    where: { id: data.assignmentId },
                        });
                        if (!assignment) return fail(await sm("assignmentNotFound"));
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
// Which statuses are worth interrupting a parent for. EXCUSED is a known,
// approved absence - not an alert.
const ALERTABLE_STATUSES = new Set(["ABSENT", "LATE"]);

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
              select: { id: true, status: true },
      });

      // Only worth a parent alert the moment a record *becomes* Absent/Late -
      // not on every re-save of an already-alerted status, and never for a
      // record that was already Absent/Late before this call.
      const shouldAlert =
              ALERTABLE_STATUSES.has(args.status) && existing?.status !== args.status;

      const record = existing
              ? await prisma.attendanceRecord.update({
                        where: { id: existing.id },
                        data: { status: args.status, note: args.note || null },
                })
              : await prisma.attendanceRecord.create({
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

      return { record, shouldAlert };
};

const ATTENDANCE_STATUS_LABEL: Record<string, string> = {
      ABSENT: "absent",
      LATE: "late",
};

// Fires a real Message to the student's parent the moment they're marked
// Absent/Late - it lands in the parent's existing Messages inbox and the
// navbar notification bell (which already polls unread Message rows), so
// this needed no new delivery mechanism, just a new sender of a Message.
const notifyParentOfAttendance = async (args: {
      studentId: string;
      classId: number;
      status: "ABSENT" | "LATE";
      date: Date;
      senderId: string;
      senderRole: string;
}) => {
      try {
              const [student, cls] = await Promise.all([
                        prisma.student.findUnique({
                                  where: { id: args.studentId },
                                  select: { name: true, surname: true, parentId: true },
                        }),
                        prisma.class.findUnique({ where: { id: args.classId }, select: { name: true } }),
              ]);
              if (!student) return;

              const statusLabel = ATTENDANCE_STATUS_LABEL[args.status] ?? args.status.toLowerCase();
              const dateLabel = args.date.toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
              });

              await prisma.message.create({
                      data: {
                                senderId: args.senderId,
                                senderRole: args.senderRole,
                                receiverId: student.parentId,
                                receiverRole: "parent",
                                studentId: args.studentId,
                                content: `${student.name} ${student.surname} was marked ${statusLabel} for ${
                                        cls?.name ?? "class"
                                } on ${dateLabel}.`,
                      },
              });
      } catch (err) {
              // An alert that fails to send should never block attendance from
              // being saved - log it and move on.
              console.log("notifyParentOfAttendance failed:", err);
      }
};

export const recordAttendance = async (
      currentState: CurrentState,
      data: AttendanceRecordSchema
    ) => {
      if (!isAdminOrTeacher()) return rejectUnauthorized();
      const senderId = getCurrentUserId();
      const senderRole = getCurrentRole();
      // AttendanceRecord.markedById is a foreign key into Teacher, not a
      // generic "whoever is signed in" column - an admin's Clerk id has no
      // row there, so passing it unconditionally throws a foreign key
      // violation (P2003) and the whole save fails. Only attribute the
      // record to a teacher when a teacher actually marked it; leave it
      // null for an admin (the column is optional).
      const markedById = senderRole === "teacher" ? senderId ?? undefined : undefined;
      try {
              const { shouldAlert } = await upsertAttendanceRecord({
                        studentId: data.studentId,
                        classId: data.classId,
                        lessonId: data.lessonId,
                        date: data.date,
                        status: data.status,
                        note: data.note,
                        markedById,
              });
              if (shouldAlert && senderId) {
                      await notifyParentOfAttendance({
                              studentId: data.studentId,
                              classId: data.classId,
                              status: data.status as "ABSENT" | "LATE",
                              date: data.date,
                              senderId,
                              senderRole,
                      });
              }
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
      const senderId = getCurrentUserId();
      const senderRole = getCurrentRole();
      // See recordAttendance above: markedById is a Teacher-only foreign
      // key, so an admin's id must never be passed as one. The parent
      // alert must still fire either way, so it's gated on senderId
      // (anyone authorized to mark attendance), not on markedById.
      const markedById = senderRole === "teacher" ? senderId ?? undefined : undefined;
      try {
              const toAlert: { studentId: string; status: "ABSENT" | "LATE" }[] = [];
              for (const r of data.records) {
                        const { shouldAlert } = await upsertAttendanceRecord({
                                    studentId: r.studentId,
                                    classId: data.classId,
                                    lessonId: data.lessonId,
                                    date: data.date,
                                    status: r.status,
                                    note: r.note,
                                    markedById,
                        });
                        if (shouldAlert) {
                                  toAlert.push({ studentId: r.studentId, status: r.status as "ABSENT" | "LATE" });
                        }
              }
              if (senderId && toAlert.length > 0) {
                      await Promise.all(
                              toAlert.map((a) =>
                                      notifyParentOfAttendance({
                                              studentId: a.studentId,
                                              classId: data.classId,
                                              status: a.status,
                                              date: data.date,
                                              senderId,
                                              senderRole,
                                      })
                              )
                      );
              }
              revalidatePath("/dashboard/list/attendance");
              return ok();
      } catch (err) {
              console.log(err);
              return fail();
      }
};

// Called directly (not via useFormState) from CheckInScanner every time a
// badge is scanned, so it needs its own runtime validation - unlike the
// form-backed actions above, no react-hook-form + zodResolver stands in
// front of this one. Resolves the scanned Code 39 text to a student by
// comparing it against sanitizeForBadge(student.id) for the class's roster
// (see barcode39.ts for why the badge encodes a sanitized id rather than
// username or a new dedicated field), then marks them Present via the same
// upsertAttendanceRecord path the matrix form uses - so a scanned check-in
// and a manual one are always the same underlying record, and a teacher
// can freely mix both for one class/day.
export const checkInAttendance = async (
      input: CheckInScanSchema
    ): Promise<CurrentState & { studentName?: string; alreadyMarked?: boolean }> => {
      if (!isAdminOrTeacher()) return rejectUnauthorized();
      const parsed = checkInScanSchema.safeParse(input);
      if (!parsed.success) return fail(await sm("invalidCheckin"));
      const { code, classId, date } = parsed.data;

      const role = getCurrentRole();
      const senderId = getCurrentUserId();

      const cls = await prisma.class.findUnique({
              where: { id: classId },
              select: {
                        id: true,
                        supervisorId: true,
                        lessons: { select: { teacherId: true } },
              },
      });
      if (!cls) return fail(await sm("classNotFound"));
      if (role === "teacher") {
              const allowed =
                        cls.supervisorId === senderId ||
                        cls.lessons.some((l) => l.teacherId === senderId);
              if (!allowed) return rejectUnauthorized();
      }

      const scanned = sanitizeForBadge(code);
      const roster = await prisma.student.findMany({
              where: { classId },
              select: { id: true, name: true, surname: true },
      });
      const match = roster.find((s) => sanitizeForBadge(s.id) === scanned);
      if (!match) return fail(await sm("noBadgeMatch"));

      try {
              const existing = await prisma.attendanceRecord.findFirst({
                        where: { studentId: match.id, date, lessonId: null },
                        select: { status: true },
              });
              const markedById = role === "teacher" ? senderId ?? undefined : undefined;
              await upsertAttendanceRecord({
                        studentId: match.id,
                        classId,
                        date,
                        status: "PRESENT",
                        markedById,
              });
              revalidatePath("/dashboard/list/attendance");
              return {
                        success: true,
                        error: false,
                        studentName: `${match.name} ${match.surname}`,
                        alreadyMarked: existing?.status === "PRESENT",
              };
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
      // BehaviorLog.teacherId is a hard foreign key into Teacher - an
      // admin's Clerk id has no row there, so passing it unconditionally
      // (as this used to) throws a foreign key violation (P2003) and the
      // create silently fails for every admin-authored entry. A teacher
      // always logs as themselves; an admin must pick a real teacher from
      // the form instead.
      const role = getCurrentRole();
      const teacherId = role === "teacher" ? userId : data.teacherId;
      if (!teacherId) return fail(await sm("chooseTeacher"));
      try {
              await prisma.behaviorLog.create({
                        data: {
                                    studentId: data.studentId,
                                    teacherId,
                                    type: data.type,
                                    title: data.title,
                                    description: data.description,
                                    visibleToParent: data.visibleToParent ?? true,
                        },
              });
              revalidatePath("/dashboard/list/students");
              revalidatePath("/dashboard/list/behavior-log");
              return ok();
      } catch (err) {
              console.log(err);
              return fail();
      }
};

export const updateBehaviorLog = async (
      currentState: CurrentState,
      data: BehaviorLogSchema
    ) => {
      if (!isAdminOrTeacher()) return rejectUnauthorized();
      if (!data.id) return fail();
      try {
              await prisma.behaviorLog.update({
                        where: { id: data.id },
                        data: {
                                    studentId: data.studentId,
                                    type: data.type,
                                    title: data.title,
                                    description: data.description,
                                    visibleToParent: data.visibleToParent ?? true,
                        },
              });
              revalidatePath("/dashboard/list/students");
              revalidatePath("/dashboard/list/behavior-log");
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
              revalidatePath("/dashboard/list/behavior-log");
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
              revalidatePath("/dashboard/list/messages");
              revalidatePath("/dashboard/list/announcements");
              await notifyUser(data.receiverId, {
                        title: "New message",
                        body: data.content.length > 140 ? `${data.content.slice(0, 140)}…` : data.content,
                        url: "/dashboard/list/messages",
              });
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
              if (!item) return fail(await sm("notFound"));
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

        if (!students.length) return fail(await sm("noStudentsInClass"));

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
      const actorId = getCurrentUserId();
      try {
              const updated = await prisma.ticket.update({
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

              const recipients = new Set([updated.createdById, updated.assignedToId].filter(
                        (id): id is string => Boolean(id) && id !== actorId
              ));
              await Promise.all(
                        Array.from(recipients).map((id) =>
                                    notifyUser(id, {
                                                title: `Ticket update: ${updated.title}`,
                                                body: `Status is now ${updated.status.toLowerCase().replace("_", " ")}.`,
                                                url: `/dashboard/list/tickets/${updated.id}`,
                                    })
                        )
              );
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

              const ticket = await prisma.ticket.findUnique({
                        where: { id: data.ticketId },
                        select: { title: true, createdById: true, assignedToId: true },
              });
              if (ticket) {
                        const recipients = new Set([ticket.createdById, ticket.assignedToId].filter(
                                    (id): id is string => Boolean(id) && id !== userId
                        ));
                        await Promise.all(
                                    Array.from(recipients).map((id) =>
                                                notifyUser(id, {
                                                            title: `New comment: ${ticket.title}`,
                                                            body: data.message.length > 140 ? `${data.message.slice(0, 140)}…` : data.message,
                                                            url: `/dashboard/list/tickets/${data.ticketId}`,
                                                })
                                    )
                        );
              }
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
              if (!slot) return fail(await sm("notFound"));
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
              if (!booking) return fail(await sm("notFound"));
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
              revalidatePath("/dashboard/list/clubs");
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
              revalidatePath("/dashboard/list/clubs");
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
              revalidatePath("/dashboard/list/clubs");
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
              // (clubId, studentId) is a unique constraint, so a student who
              // previously withdrew already has a row — reuse it instead of
              // trying to create a duplicate, which would always fail.
              const existing = await prisma.clubEnrollment.findUnique({
                        where: { clubId_studentId: { clubId: data.clubId, studentId: data.studentId } },
              });
              if (existing && existing.status !== "WITHDRAWN") {
                        return fail(await sm("alreadyEnrolled"));
              }

              // Only ACTIVE seats count against capacity — a WAITLISTED or
              // WITHDRAWN row must never block a new join.
              const club = await prisma.club.findUnique({
                        where: { id: data.clubId },
                        include: { _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } },
              });
              if (!club) return fail(await sm("clubNotFound"));

        const status = club._count.enrollments >= club.capacity ? "WAITLISTED" : "ACTIVE";

        if (existing) {
                  await prisma.clubEnrollment.update({
                            where: { id: existing.id },
                            data: { status, enrolledAt: new Date() },
                  });
        } else {
                  await prisma.clubEnrollment.create({
                            data: { clubId: data.clubId, studentId: data.studentId, status },
                  });
        }
              revalidatePath("/dashboard/list/clubs");
              return ok();
      } catch (err) {
              console.log(err);
              return fail(await sm("enrollUnavailable"));
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
              if (!enrollment) return fail(await sm("notFound"));
              if (
                        !isAdminOrTeacher() &&
                        !(role === "student" && enrollment.studentId === userId) &&
                        !(role === "parent" && userId && (await parentOwnsStudent(userId, enrollment.studentId)))
                      ) {
                        return rejectUnauthorized();
              }

              await prisma.$transaction(async (tx) => {
                        await tx.clubEnrollment.update({
                                    where: { id: parseInt(id) },
                                    data: { status: "WITHDRAWN" },
                        });

                        // Freeing an ACTIVE seat promotes whoever has waited longest,
                        // so a withdrawal never leaves an open seat with a waitlist.
                        if (enrollment.status === "ACTIVE") {
                                    const nextInLine = await tx.clubEnrollment.findFirst({
                                                where: { clubId: enrollment.clubId, status: "WAITLISTED" },
                                                orderBy: { enrolledAt: "asc" },
                                    });
                                    if (nextInLine) {
                                                await tx.clubEnrollment.update({
                                                            where: { id: nextInLine.id },
                                                            data: { status: "ACTIVE" },
                                                });
                                    }
                        }
              });

              revalidatePath("/dashboard/list/clubs");
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
      if (!(await canManageClub(data.clubId))) return rejectUnauthorized();
      try {
              await prisma.clubSession.create({
                        data: {
                                    clubId: data.clubId,
                                    date: data.date,
                                    startTime: data.startTime,
                                    endTime: data.endTime,
                        },
              });
              revalidatePath("/dashboard/list/clubs/attendance");
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
      const clubSession = await prisma.clubSession.findUnique({
              where: { id: data.clubSessionId },
              select: { clubId: true },
      });
      if (!clubSession || !(await canManageClub(clubSession.clubId))) return rejectUnauthorized();
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
              revalidatePath("/dashboard/list/clubs/attendance");
              return ok();
      } catch (err) {
              console.log(err);
              return fail();
      }
};

// Instructors may only take attendance for clubs they run; admins for any.
const canManageClub = async (clubId: number) => {
      const role = getCurrentRole();
      if (role === "admin") return true;
      if (role !== "teacher") return false;
      const userId = getCurrentUserId();
      if (!userId) return false;
      const club = await prisma.club.findFirst({
              where: { id: clubId, instructorId: userId },
              select: { id: true },
      });
      return !!club;
};

// Marks a whole club meeting in one submit - the club counterpart of
// recordAttendanceBulk. The ClubSession for that school day is reused if one
// exists (its times are updated to what the instructor entered) or created
// on the fly, then every row is upserted on the (session, student) unique.
export const recordClubAttendanceBulk = async (
      currentState: CurrentState,
      data: ClubAttendanceBulkSchema
    ) => {
      const parsed = clubAttendanceBulkSchema.safeParse(data);
      if (!parsed.success) return fail(await sm("invalidInput"));
      const input = parsed.data;
      if (!(await canManageClub(input.clubId))) return rejectUnauthorized();

      const [y, m, d] = input.date.split("-").map(Number);
      const [sh, smin] = input.startTime.split(":").map(Number);
      const [eh, emin] = input.endTime.split(":").map(Number);
      const day = { year: y, month: m, day: d };
      const [dayStart, dayEnd] = schoolDayRange(input.date);

      try {
              // Only students who are (or were) enrolled in this club can be marked.
              const enrolled = await prisma.clubEnrollment.findMany({
                        where: { clubId: input.clubId },
                        select: { studentId: true },
              });
              const allowed = new Set(enrolled.map((e) => e.studentId));
              const records = input.records.filter((r) => allowed.has(r.studentId));

              await prisma.$transaction(async (tx) => {
                        const times = {
                                    date: fromWallClock(day),
                                    startTime: fromWallClock({ ...day, hour: sh, minute: smin }),
                                    endTime: fromWallClock({ ...day, hour: eh, minute: emin }),
                        };
                        const existing = await tx.clubSession.findFirst({
                                    where: { clubId: input.clubId, date: { gte: dayStart, lt: dayEnd } },
                                    orderBy: { startTime: "asc" },
                                    select: { id: true },
                        });
                        const session = existing
                                    ? await tx.clubSession.update({ where: { id: existing.id }, data: times })
                                    : await tx.clubSession.create({ data: { clubId: input.clubId, ...times } });

                        for (const r of records) {
                                    await tx.clubAttendance.upsert({
                                                where: {
                                                            clubSessionId_studentId: {
                                                                        clubSessionId: session.id,
                                                                        studentId: r.studentId,
                                                            },
                                                },
                                                update: { status: r.status },
                                                create: {
                                                            clubSessionId: session.id,
                                                            studentId: r.studentId,
                                                            status: r.status,
                                                },
                                    });
                        }
              });

              revalidatePath("/dashboard/list/clubs/attendance");
              revalidatePath("/dashboard/list/clubs");
              return ok();
      } catch (err) {
              console.log(err);
              return fail();
      }
};
