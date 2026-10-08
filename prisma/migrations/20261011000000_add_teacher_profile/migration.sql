-- Teacher profile completed on first login, plus per-term objectives.
CREATE TABLE "TeacherProfile" (
    "teacherId" TEXT NOT NULL,
    "photoUrl" TEXT,
    "position" TEXT,
    "department" TEXT,
    "yearJoined" INTEGER,
    "about" TEXT,
    "education" TEXT,
    "previousSchools" TEXT,
    "yearsExperience" INTEGER,
    "certificates" TEXT,
    "achievements" JSONB,
    "vision" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherProfile_pkey" PRIMARY KEY ("teacherId")
);

CREATE TABLE "TeacherObjective" (
    "id" SERIAL NOT NULL,
    "schoolYear" TEXT NOT NULL,
    "term" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "teacherId" TEXT NOT NULL,

    CONSTRAINT "TeacherObjective_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TeacherObjective_teacherId_schoolYear_idx" ON "TeacherObjective"("teacherId", "schoolYear");

ALTER TABLE "TeacherProfile" ADD CONSTRAINT "TeacherProfile_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherObjective" ADD CONSTRAINT "TeacherObjective_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
