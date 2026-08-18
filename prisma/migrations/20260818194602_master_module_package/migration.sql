-- Master Module Package: additive migration for all 10 advanced modules.
-- Every statement below either ADDS a nullable/defaulted column to an
-- existing table, or CREATEs a brand-new table/type. Nothing is dropped,
-- renamed, or made NOT NULL on existing data, so this migration is safe
-- to run against the live production database without downtime or data
-- loss.

-- ================= Additive columns on existing tables =================

-- Module 7: Personalized Timetable & Classroom Locator
ALTER TABLE "Lesson" ADD COLUMN     "room" TEXT;

-- Module 1: Online Exam & Assignment Submission Portal
ALTER TABLE "Exam" ADD COLUMN     "description" TEXT,
ADD COLUMN     "totalMarks" INTEGER,
ADD COLUMN     "durationMinutes" INTEGER,
ADD COLUMN     "instructionsFileUrl" TEXT;

ALTER TABLE "Assignment" ADD COLUMN     "description" TEXT,
ADD COLUMN     "totalMarks" INTEGER,
ADD COLUMN     "instructionsFileUrl" TEXT;

-- ============================ New Enums ================================

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'SUBMITTED', 'LATE', 'GRADED', 'MISSING');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');

-- CreateEnum
CREATE TYPE "BehaviorType" AS ENUM ('POSITIVE', 'CONCERN', 'INCIDENT');

-- CreateEnum
CREATE TYPE "PermissionStatus" AS ENUM ('PENDING', 'SIGNED', 'DECLINED');

-- CreateEnum
CREATE TYPE "PortfolioCategory" AS ENUM ('CERTIFICATE', 'PROJECT', 'MILESTONE', 'ACHIEVEMENT', 'EXTRACURRICULAR');

-- CreateEnum
CREATE TYPE "Term" AS ENUM ('TERM_1', 'TERM_2', 'TERM_3');

-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('TECHNICAL', 'LOST_ITEM', 'ACADEMIC', 'OTHER');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ConferenceLocation" AS ENUM ('ONLINE', 'IN_PERSON');

-- CreateEnum
CREATE TYPE "ClubCategory" AS ENUM ('DANCING', 'PIANO', 'CHESS', 'HANDICRAFTS', 'FOOTBALL', 'VOLLEYBALL', 'BASKETBALL', 'TENNIS', 'TABLE_TENNIS', 'OTHER');

-- CreateEnum
CREATE TYPE "ClubEnrollmentStatus" AS ENUM ('ACTIVE', 'WAITLISTED', 'WITHDRAWN');

-- ============================ New Tables ================================

-- CreateTable
CREATE TABLE "StudentSubmission" (
      "id" SERIAL NOT NULL,
      "fileUrl" TEXT,
      "content" TEXT,
      "submittedAt" TIMESTAMP(3),
      "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
      "grade" INTEGER,
      "feedback" TEXT,
      "gradedAt" TIMESTAMP(3),
      "gradedById" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      "examId" INTEGER,
      "assignmentId" INTEGER,
      "studentId" TEXT NOT NULL,

    CONSTRAINT "StudentSubmission_pkey" PRIMARY KEY ("id")
  );

-- CreateTable
CREATE TABLE "AttendanceRecord" (
      "id" SERIAL NOT NULL,
      "date" TIMESTAMP(3) NOT NULL,
      "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
      "note" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      "studentId" TEXT NOT NULL,
      "classId" INTEGER NOT NULL,
      "lessonId" INTEGER,
      "markedById" TEXT,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
  );

-- CreateTable
CREATE TABLE "BehaviorLog" (
      "id" SERIAL NOT NULL,
      "type" "BehaviorType" NOT NULL,
      "title" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "visibleToParent" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "studentId" TEXT NOT NULL,
      "teacherId" TEXT NOT NULL,

    CONSTRAINT "BehaviorLog_pkey" PRIMARY KEY ("id")
  );

-- CreateTable
CREATE TABLE "Message" (
      "id" SERIAL NOT NULL,
      "senderId" TEXT NOT NULL,
      "senderRole" TEXT NOT NULL,
      "receiverId" TEXT NOT NULL,
      "receiverRole" TEXT NOT NULL,
      "studentId" TEXT,
      "content" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "readAt" TIMESTAMP(3),

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
  );

-- CreateTable
CREATE TABLE "PermissionSlip" (
      "id" SERIAL NOT NULL,
      "title" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "eventDate" TIMESTAMP(3),
      "createdById" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "classId" INTEGER,

    CONSTRAINT "PermissionSlip_pkey" PRIMARY KEY ("id")
  );

-- CreateTable
CREATE TABLE "PermissionResponse" (
      "id" SERIAL NOT NULL,
      "status" "PermissionStatus" NOT NULL DEFAULT 'PENDING',
      "signatureDataUrl" TEXT,
      "respondedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "permissionSlipId" INTEGER NOT NULL,
      "studentId" TEXT NOT NULL,
      "parentId" TEXT NOT NULL,

    CONSTRAINT "PermissionResponse_pkey" PRIMARY KEY ("id")
  );

-- CreateTable
CREATE TABLE "PortfolioItem" (
      "id" SERIAL NOT NULL,
      "title" TEXT NOT NULL,
      "description" TEXT,
      "category" "PortfolioCategory" NOT NULL,
      "fileUrl" TEXT,
      "imageUrl" TEXT,
      "schoolYear" TEXT NOT NULL,
      "dateAchieved" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "studentId" TEXT NOT NULL,

    CONSTRAINT "PortfolioItem_pkey" PRIMARY KEY ("id")
  );

-- CreateTable
CREATE TABLE "ReportCard" (
      "id" SERIAL NOT NULL,
      "term" "Term" NOT NULL,
      "schoolYear" TEXT NOT NULL,
      "gpa" DOUBLE PRECISION,
      "attendanceRate" DOUBLE PRECISION,
      "behaviorSummary" TEXT,
      "pdfUrl" TEXT,
      "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "generatedById" TEXT,
      "studentId" TEXT NOT NULL,

    CONSTRAINT "ReportCard_pkey" PRIMARY KEY ("id")
  );

-- CreateTable
CREATE TABLE "Ticket" (
      "id" SERIAL NOT NULL,
      "title" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "category" "TicketCategory" NOT NULL,
      "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
      "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
      "createdById" TEXT NOT NULL,
      "createdByRole" TEXT NOT NULL,
      "assignedToId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      "resolvedAt" TIMESTAMP(3),
      "studentId" TEXT,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
  );

-- CreateTable
CREATE TABLE "TicketComment" (
      "id" SERIAL NOT NULL,
      "authorId" TEXT NOT NULL,
      "authorRole" TEXT NOT NULL,
      "message" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "ticketId" INTEGER NOT NULL,

    CONSTRAINT "TicketComment_pkey" PRIMARY KEY ("id")
  );

-- CreateTable
CREATE TABLE "ConferenceSlot" (
      "id" SERIAL NOT NULL,
      "startTime" TIMESTAMP(3) NOT NULL,
      "endTime" TIMESTAMP(3) NOT NULL,
      "location" "ConferenceLocation" NOT NULL DEFAULT 'IN_PERSON',
      "isBooked" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "teacherId" TEXT NOT NULL,

    CONSTRAINT "ConferenceSlot_pkey" PRIMARY KEY ("id")
  );

-- CreateTable
CREATE TABLE "ConferenceBooking" (
      "id" SERIAL NOT NULL,
      "notes" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "slotId" INTEGER NOT NULL,
      "studentId" TEXT NOT NULL,
      "parentId" TEXT NOT NULL,

    CONSTRAINT "ConferenceBooking_pkey" PRIMARY KEY ("id")
  );

-- CreateTable
CREATE TABLE "Club" (
      "id" SERIAL NOT NULL,
      "name" TEXT NOT NULL,
      "category" "ClubCategory" NOT NULL,
      "description" TEXT,
      "capacity" INTEGER NOT NULL,
      "schedule" TEXT,
      "location" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "instructorId" TEXT,

    CONSTRAINT "Club_pkey" PRIMARY KEY ("id")
  );

-- CreateTable
CREATE TABLE "ClubEnrollment" (
      "id" SERIAL NOT NULL,
      "status" "ClubEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
      "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "clubId" INTEGER NOT NULL,
      "studentId" TEXT NOT NULL,

    CONSTRAINT "ClubEnrollment_pkey" PRIMARY KEY ("id")
  );

-- CreateTable
CREATE TABLE "ClubSession" (
      "id" SERIAL NOT NULL,
      "date" TIMESTAMP(3) NOT NULL,
      "startTime" TIMESTAMP(3) NOT NULL,
      "endTime" TIMESTAMP(3) NOT NULL,
      "clubId" INTEGER NOT NULL,

    CONSTRAINT "ClubSession_pkey" PRIMARY KEY ("id")
  );

-- CreateTable
CREATE TABLE "ClubAttendance" (
      "id" SERIAL NOT NULL,
      "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
      "clubSessionId" INTEGER NOT NULL,
      "studentId" TEXT NOT NULL,

    CONSTRAINT "ClubAttendance_pkey" PRIMARY KEY ("id")
  );

-- ======================= Indexes & Unique Constraints ===================

-- CreateIndex
CREATE INDEX "StudentSubmission_studentId_idx" ON "StudentSubmission"("studentId");

-- CreateIndex
CREATE INDEX "StudentSubmission_examId_idx" ON "StudentSubmission"("examId");

-- CreateIndex
CREATE INDEX "StudentSubmission_assignmentId_idx" ON "StudentSubmission"("assignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_studentId_date_lessonId_key" ON "AttendanceRecord"("studentId", "date", "lessonId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_classId_date_idx" ON "AttendanceRecord"("classId", "date");

-- CreateIndex
CREATE INDEX "BehaviorLog_studentId_date_idx" ON "BehaviorLog"("studentId", "date");

-- CreateIndex
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");

-- CreateIndex
CREATE INDEX "Message_receiverId_idx" ON "Message"("receiverId");

-- CreateIndex
CREATE INDEX "Message_studentId_idx" ON "Message"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "PermissionResponse_permissionSlipId_studentId_key" ON "PermissionResponse"("permissionSlipId", "studentId");

-- CreateIndex
CREATE INDEX "PortfolioItem_studentId_schoolYear_idx" ON "PortfolioItem"("studentId", "schoolYear");

-- CreateIndex
CREATE UNIQUE INDEX "ReportCard_studentId_term_schoolYear_key" ON "ReportCard"("studentId", "term", "schoolYear");

-- CreateIndex
CREATE INDEX "Ticket_status_idx" ON "Ticket"("status");

-- CreateIndex
CREATE INDEX "Ticket_createdById_idx" ON "Ticket"("createdById");

-- CreateIndex
CREATE INDEX "TicketComment_ticketId_idx" ON "TicketComment"("ticketId");

-- CreateIndex
CREATE INDEX "ConferenceSlot_teacherId_startTime_idx" ON "ConferenceSlot"("teacherId", "startTime");

-- CreateIndex
CREATE UNIQUE INDEX "ConferenceBooking_slotId_key" ON "ConferenceBooking"("slotId");

-- CreateIndex
CREATE UNIQUE INDEX "Club_name_key" ON "Club"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ClubEnrollment_clubId_studentId_key" ON "ClubEnrollment"("clubId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ClubAttendance_clubSessionId_studentId_key" ON "ClubAttendance"("clubSessionId", "studentId");

-- ============================ Foreign Keys ===============================

-- AddForeignKey
ALTER TABLE "StudentSubmission" ADD CONSTRAINT "StudentSubmission_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSubmission" ADD CONSTRAINT "StudentSubmission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSubmission" ADD CONSTRAINT "StudentSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BehaviorLog" ADD CONSTRAINT "BehaviorLog_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BehaviorLog" ADD CONSTRAINT "BehaviorLog_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionSlip" ADD CONSTRAINT "PermissionSlip_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionResponse" ADD CONSTRAINT "PermissionResponse_permissionSlipId_fkey" FOREIGN KEY ("permissionSlipId") REFERENCES "PermissionSlip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionResponse" ADD CONSTRAINT "PermissionResponse_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionResponse" ADD CONSTRAINT "PermissionResponse_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioItem" ADD CONSTRAINT "PortfolioItem_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketComment" ADD CONSTRAINT "TicketComment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConferenceSlot" ADD CONSTRAINT "ConferenceSlot_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConferenceBooking" ADD CONSTRAINT "ConferenceBooking_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "ConferenceSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConferenceBooking" ADD CONSTRAINT "ConferenceBooking_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConferenceBooking" ADD CONSTRAINT "ConferenceBooking_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Club" ADD CONSTRAINT "Club_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubEnrollment" ADD CONSTRAINT "ClubEnrollment_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubEnrollment" ADD CONSTRAINT "ClubEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubSession" ADD CONSTRAINT "ClubSession_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubAttendance" ADD CONSTRAINT "ClubAttendance_clubSessionId_fkey" FOREIGN KEY ("clubSessionId") REFERENCES "ClubSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubAttendance" ADD CONSTRAINT "ClubAttendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
