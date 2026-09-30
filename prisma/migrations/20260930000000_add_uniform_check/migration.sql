-- Uniform check: one row per student per day, recorded by the class supervisor.
CREATE TYPE "UniformStatus" AS ENUM ('FULL', 'PARTIAL', 'NONE');

CREATE TABLE "UniformCheck" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "status" "UniformStatus" NOT NULL,
    "missingItems" TEXT[],
    "note" TEXT,
    "studentId" TEXT NOT NULL,
    "classId" INTEGER NOT NULL,
    "checkedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UniformCheck_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UniformCheck_studentId_date_key" ON "UniformCheck"("studentId", "date");
CREATE INDEX "UniformCheck_classId_date_idx" ON "UniformCheck"("classId", "date");

ALTER TABLE "UniformCheck" ADD CONSTRAINT "UniformCheck_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UniformCheck" ADD CONSTRAINT "UniformCheck_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UniformCheck" ADD CONSTRAINT "UniformCheck_checkedById_fkey" FOREIGN KEY ("checkedById") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
