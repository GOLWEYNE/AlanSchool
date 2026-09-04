-- Exam & Assignment upload/submission portal (v2): additive migration.
-- Adds file display names, an optional structured auto-grade quiz, and
-- per-student targeting to Exam/Assignment, plus a matching answers field
-- and one-submission-per-student uniqueness on StudentSubmission. Nothing
-- is dropped, renamed, or made NOT NULL on existing data.

-- ================= Additive columns on existing tables =================

ALTER TABLE "Exam" ADD COLUMN     "instructionsFileName" TEXT,
ADD COLUMN     "questions" JSONB,
ADD COLUMN     "targetStudentIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Assignment" ADD COLUMN     "instructionsFileName" TEXT,
ADD COLUMN     "questions" JSONB,
ADD COLUMN     "targetStudentIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "StudentSubmission" ADD COLUMN     "fileName" TEXT,
ADD COLUMN     "answers" JSONB;

-- ============================ New indexes ===============================

-- CreateIndex
CREATE UNIQUE INDEX "StudentSubmission_examId_studentId_key" ON "StudentSubmission"("examId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentSubmission_assignmentId_studentId_key" ON "StudentSubmission"("assignmentId", "studentId");
