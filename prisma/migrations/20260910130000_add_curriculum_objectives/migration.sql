-- Curriculum & learning-objectives tracker: additive migration. Adds a new
-- CurriculumObjective table plus its many-to-many links to Lesson and Exam
-- (implicit-relation join tables, matching the naming/shape Prisma already
-- generated for the existing "_SubjectToTeacher" join table). Nothing
-- existing is dropped, renamed, or made NOT NULL.

-- ================= New table =================

CREATE TABLE "CurriculumObjective" (
    "id" SERIAL NOT NULL,
    "code" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "strand" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "gradeId" INTEGER,

    CONSTRAINT "CurriculumObjective_pkey" PRIMARY KEY ("id")
);

-- ================= Join tables (implicit many-to-many) =================

CREATE TABLE "_CurriculumObjectiveToExam" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_CurriculumObjectiveToExam_AB_pkey" PRIMARY KEY ("A","B")
);

CREATE TABLE "_CurriculumObjectiveToLesson" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_CurriculumObjectiveToLesson_AB_pkey" PRIMARY KEY ("A","B")
);

-- ================= Indexes =================

CREATE INDEX "CurriculumObjective_subjectId_idx" ON "CurriculumObjective"("subjectId");

CREATE INDEX "CurriculumObjective_gradeId_idx" ON "CurriculumObjective"("gradeId");

CREATE INDEX "_CurriculumObjectiveToExam_B_index" ON "_CurriculumObjectiveToExam"("B");

CREATE INDEX "_CurriculumObjectiveToLesson_B_index" ON "_CurriculumObjectiveToLesson"("B");

-- ================= Foreign keys =================

ALTER TABLE "CurriculumObjective" ADD CONSTRAINT "CurriculumObjective_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CurriculumObjective" ADD CONSTRAINT "CurriculumObjective_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "_CurriculumObjectiveToExam" ADD CONSTRAINT "_CurriculumObjectiveToExam_A_fkey" FOREIGN KEY ("A") REFERENCES "CurriculumObjective"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_CurriculumObjectiveToExam" ADD CONSTRAINT "_CurriculumObjectiveToExam_B_fkey" FOREIGN KEY ("B") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_CurriculumObjectiveToLesson" ADD CONSTRAINT "_CurriculumObjectiveToLesson_A_fkey" FOREIGN KEY ("A") REFERENCES "CurriculumObjective"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_CurriculumObjectiveToLesson" ADD CONSTRAINT "_CurriculumObjectiveToLesson_B_fkey" FOREIGN KEY ("B") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
