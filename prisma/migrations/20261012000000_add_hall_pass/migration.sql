-- Digital hall pass: destinations, passes, restricted groups and their members.
CREATE TYPE "PassStatus" AS ENUM ('ACTIVE', 'RETURNED', 'AUTO_CLOSED');

CREATE TABLE "PassDestination" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "maxMinutes" INTEGER NOT NULL DEFAULT 10,
    "maxConcurrent" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PassDestination_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HallPass" (
    "id" SERIAL NOT NULL,
    "studentId" TEXT NOT NULL,
    "destinationId" INTEGER NOT NULL,
    "classId" INTEGER NOT NULL,
    "gradeLevel" INTEGER NOT NULL,
    "maxMinutes" INTEGER NOT NULL,
    "status" "PassStatus" NOT NULL DEFAULT 'ACTIVE',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnedAt" TIMESTAMP(3),
    "endedById" TEXT,
    "endedByRole" TEXT,

    CONSTRAINT "HallPass_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RestrictedGroup" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "RestrictedGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GroupMember" (
    "id" SERIAL NOT NULL,
    "groupId" INTEGER NOT NULL,
    "studentId" TEXT NOT NULL,

    CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PassDestination_name_key" ON "PassDestination"("name");
CREATE INDEX "HallPass_status_idx" ON "HallPass"("status");
CREATE INDEX "HallPass_issuedAt_idx" ON "HallPass"("issuedAt");
CREATE INDEX "HallPass_studentId_issuedAt_idx" ON "HallPass"("studentId", "issuedAt");
CREATE UNIQUE INDEX "RestrictedGroup_name_key" ON "RestrictedGroup"("name");
CREATE UNIQUE INDEX "GroupMember_groupId_studentId_key" ON "GroupMember"("groupId", "studentId");
CREATE INDEX "GroupMember_studentId_idx" ON "GroupMember"("studentId");

-- A student can only have one pass open at a time (guards against double taps / races).
CREATE UNIQUE INDEX "HallPass_one_active_per_student" ON "HallPass"("studentId") WHERE "status" = 'ACTIVE';

ALTER TABLE "HallPass" ADD CONSTRAINT "HallPass_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HallPass" ADD CONSTRAINT "HallPass_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "PassDestination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HallPass" ADD CONSTRAINT "HallPass_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "RestrictedGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Starter destinations (editable by admins).
INSERT INTO "PassDestination" ("name", "maxMinutes", "sortOrder") VALUES
    ('Lower Level Bathroom', 10, 1),
    ('Upper Level Bathroom', 10, 2),
    ('Nurse''s Office', 15, 3),
    ('Office', 10, 4)
ON CONFLICT ("name") DO NOTHING;
