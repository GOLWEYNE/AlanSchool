import { z } from "zod";

// =====================================================================
// Zod validation schemas for the Master Module Package (10 advanced
// modules). Kept in a separate file from formValidationSchemas.ts so the
// existing, already-working forms/schemas are never touched.
// =====================================================================

// ---- Module 1: Online Exam & Assignment Submission Portal ----------

export const submissionGradeSchema = z.object({
    id: z.coerce.number(),
    grade: z.coerce.number().min(0, { message: "Grade is required!" }),
    feedback: z.string().optional().or(z.literal("")),
});

export type SubmissionGradeSchema = z.infer<typeof submissionGradeSchema>;

export const submissionCreateSchema = z.object({
    examId: z.coerce.number().optional(),
    assignmentId: z.coerce.number().optional(),
    studentId: z.string().min(1, { message: "Student is required!" }),
    fileUrl: z.string().optional().or(z.literal("")),
    content: z.string().optional().or(z.literal("")),
});

export type SubmissionCreateSchema = z.infer<typeof submissionCreateSchema>;

// ---- Module 2: Automated Attendance Tracker -------------------------

export const attendanceRecordSchema = z.object({
    studentId: z.string().min(1),
    classId: z.coerce.number(),
    lessonId: z.coerce.number().optional(),
    date: z.coerce.date(),
    status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
    note: z.string().optional().or(z.literal("")),
});

export type AttendanceRecordSchema = z.infer<typeof attendanceRecordSchema>;

export const attendanceBulkSchema = z.object({
    classId: z.coerce.number(),
    lessonId: z.coerce.number().optional(),
    date: z.coerce.date(),
    records: z.array(
          z.object({
                  studentId: z.string().min(1),
                  status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
                  note: z.string().optional().or(z.literal("")),
          })
        ),
});

export type AttendanceBulkSchema = z.infer<typeof attendanceBulkSchema>;

// ---- Module 3: Behavior Feedback & Communication Hub -----------------

export const behaviorLogSchema = z.object({
    id: z.coerce.number().optional(),
    studentId: z.string().min(1, { message: "Student is required!" }),
    type: z.enum(["POSITIVE", "CONCERN", "INCIDENT"]),
    title: z.string().min(1, { message: "Title is required!" }),
    description: z.string().min(1, { message: "Description is required!" }),
    visibleToParent: z.coerce.boolean().optional(),
});

export type BehaviorLogSchema = z.infer<typeof behaviorLogSchema>;

export const messageSchema = z.object({
    receiverId: z.string().min(1, { message: "Recipient is required!" }),
    receiverRole: z.enum(["admin", "teacher", "student", "parent"]),
    studentId: z.string().optional().or(z.literal("")),
    content: z.string().min(1, { message: "Message cannot be empty!" }),
});

export type MessageSchema = z.infer<typeof messageSchema>;

// ---- Module 4: Remote Parent Master Dashboard (permission slips) -----

export const permissionSlipSchema = z.object({
    id: z.coerce.number().optional(),
    title: z.string().min(1, { message: "Title is required!" }),
    description: z.string().min(1, { message: "Description is required!" }),
    eventDate: z.coerce.date().optional(),
    classId: z.preprocess(
          (value) => (value === "" ? undefined : value),
          z.coerce.number().optional()
        ),
});

export type PermissionSlipSchema = z.infer<typeof permissionSlipSchema>;

export const permissionResponseSchema = z.object({
    id: z.coerce.number(),
    status: z.enum(["SIGNED", "DECLINED"]),
    signatureDataUrl: z.string().optional().or(z.literal("")),
});

export type PermissionResponseSchema = z.infer<typeof permissionResponseSchema>;

// ---- Module 5: Student Digital Portfolio -----------------------------

export const portfolioItemSchema = z.object({
    id: z.coerce.number().optional(),
    studentId: z.string().min(1, { message: "Student is required!" }),
    title: z.string().min(1, { message: "Title is required!" }),
    description: z.string().optional().or(z.literal("")),
    category: z.enum([
          "CERTIFICATE",
          "PROJECT",
          "MILESTONE",
          "ACHIEVEMENT",
          "EXTRACURRICULAR",
        ]),
    fileUrl: z.string().optional().or(z.literal("")),
    imageUrl: z.string().optional().or(z.literal("")),
    schoolYear: z.string().min(1, { message: "School year is required!" }),
    dateAchieved: z.coerce.date().optional(),
});

export type PortfolioItemSchema = z.infer<typeof portfolioItemSchema>;

// ---- Module 6: Automated Report Card Generation ----------------------

export const reportCardGenerateSchema = z.object({
    studentId: z.string().min(1, { message: "Student is required!" }),
    term: z.enum(["TERM_1", "TERM_2", "TERM_3"]),
    schoolYear: z.string().min(1, { message: "School year is required!" }),
});

export type ReportCardGenerateSchema = z.infer<typeof reportCardGenerateSchema>;

// ---- Module 7: Classroom Locator (Lesson.room) -----------------------

export const lessonRoomSchema = z.object({
    id: z.coerce.number(),
    room: z.string().min(1, { message: "Room is required!" }),
});

export type LessonRoomSchema = z.infer<typeof lessonRoomSchema>;

// ---- Module 8: Support / Lost & Found Ticketing ----------------------

export const ticketSchema = z.object({
    id: z.coerce.number().optional(),
    title: z.string().min(1, { message: "Title is required!" }),
    description: z.string().min(1, { message: "Description is required!" }),
    category: z.enum(["TECHNICAL", "LOST_ITEM", "ACADEMIC", "OTHER"]),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
    studentId: z.string().optional().or(z.literal("")),
});

export type TicketSchema = z.infer<typeof ticketSchema>;

export const ticketStatusSchema = z.object({
    id: z.coerce.number(),
    status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]),
    assignedToId: z.string().optional().or(z.literal("")),
});

export type TicketStatusSchema = z.infer<typeof ticketStatusSchema>;

export const ticketCommentSchema = z.object({
    ticketId: z.coerce.number(),
    message: z.string().min(1, { message: "Comment cannot be empty!" }),
});

export type TicketCommentSchema = z.infer<typeof ticketCommentSchema>;

// ---- Module 9: Parent-Teacher Conference Scheduling ------------------

export const conferenceSlotSchema = z.object({
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
    location: z.enum(["ONLINE", "IN_PERSON"]).optional(),
});

export type ConferenceSlotSchema = z.infer<typeof conferenceSlotSchema>;

export const conferenceBookingSchema = z.object({
    slotId: z.coerce.number(),
    studentId: z.string().min(1, { message: "Student is required!" }),
    notes: z.string().optional().or(z.literal("")),
});

export type ConferenceBookingSchema = z.infer<typeof conferenceBookingSchema>;

// ---- Module 10: Extracurricular Activities & Club Management --------

export const clubSchema = z.object({
    id: z.coerce.number().optional(),
    name: z.string().min(1, { message: "Club name is required!" }),
    category: z.enum([
          "DANCING",
          "PIANO",
          "CHESS",
          "HANDICRAFTS",
          "FOOTBALL",
          "VOLLEYBALL",
          "BASKETBALL",
          "TENNIS",
          "TABLE_TENNIS",
          "OTHER",
        ]),
    description: z.string().optional().or(z.literal("")),
    capacity: z.coerce.number().min(1, { message: "Capacity is required!" }),
    schedule: z.string().optional().or(z.literal("")),
    location: z.string().optional().or(z.literal("")),
    instructorId: z.string().optional().or(z.literal("")),
});

export type ClubSchema = z.infer<typeof clubSchema>;

export const clubEnrollmentSchema = z.object({
    clubId: z.coerce.number(),
    studentId: z.string().min(1, { message: "Student is required!" }),
});

export type ClubEnrollmentSchema = z.infer<typeof clubEnrollmentSchema>;

export const clubSessionSchema = z.object({
    clubId: z.coerce.number(),
    date: z.coerce.date(),
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
});

export type ClubSessionSchema = z.infer<typeof clubSessionSchema>;

export const clubAttendanceSchema = z.object({
    clubSessionId: z.coerce.number(),
    studentId: z.string().min(1),
    status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
});

export type ClubAttendanceSchema = z.infer<typeof clubAttendanceSchema>;
