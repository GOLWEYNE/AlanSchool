-- Optional rubric grading for project/essay-style assignments: additive
-- migration. Nothing is dropped, renamed, or made NOT NULL on existing
-- data.

-- ================= Additive columns on existing tables =================

ALTER TABLE "Assignment" ADD COLUMN     "rubric" JSONB;

ALTER TABLE "StudentSubmission" ADD COLUMN     "rubricScores" JSONB;
