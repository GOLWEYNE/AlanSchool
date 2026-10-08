-- Club supervision: several teachers can supervise a club; supervisors take the
-- club's attendance and its uniform check.
CREATE TABLE "ClubSupervisor" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clubId" INTEGER NOT NULL,
    "teacherId" TEXT NOT NULL,

    CONSTRAINT "ClubSupervisor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClubSupervisor_clubId_teacherId_key" ON "ClubSupervisor"("clubId", "teacherId");
CREATE INDEX "ClubSupervisor_teacherId_idx" ON "ClubSupervisor"("teacherId");

ALTER TABLE "ClubSupervisor" ADD CONSTRAINT "ClubSupervisor_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClubSupervisor" ADD CONSTRAINT "ClubSupervisor_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ClubUniformCheck" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "status" "UniformStatus" NOT NULL,
    "missingItems" TEXT[],
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "clubId" INTEGER NOT NULL,
    "studentId" TEXT NOT NULL,
    "checkedById" TEXT,

    CONSTRAINT "ClubUniformCheck_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClubUniformCheck_clubId_studentId_date_key" ON "ClubUniformCheck"("clubId", "studentId", "date");
CREATE INDEX "ClubUniformCheck_clubId_date_idx" ON "ClubUniformCheck"("clubId", "date");

ALTER TABLE "ClubUniformCheck" ADD CONSTRAINT "ClubUniformCheck_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClubUniformCheck" ADD CONSTRAINT "ClubUniformCheck_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClubUniformCheck" ADD CONSTRAINT "ClubUniformCheck_checkedById_fkey" FOREIGN KEY ("checkedById") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Every existing club instructor becomes a supervisor of their club.
INSERT INTO "ClubSupervisor" ("clubId", "teacherId")
SELECT "id", "instructorId" FROM "Club" WHERE "instructorId" IS NOT NULL
ON CONFLICT DO NOTHING;
