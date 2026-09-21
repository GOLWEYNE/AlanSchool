-- Study Planner: adds a table for students' personal study goals.
-- Purely additive - nothing existing is dropped, renamed or made NOT NULL.
-- Written with IF NOT EXISTS so it is safe to run even if the app already
-- created the table on first use (see src/lib/studyGoals.ts).

CREATE TABLE IF NOT EXISTS "StudyGoal" (
    "id" SERIAL NOT NULL,
    "studentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subjectId" INTEGER,
    "targetDate" TIMESTAMP(3),
    "progress" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyGoal_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StudyGoal_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudyGoal_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "StudyGoal_studentId_idx" ON "StudyGoal"("studentId");
