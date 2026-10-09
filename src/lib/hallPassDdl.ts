// Generated from prisma/migrations/*add_hall_pass/migration.sql.
// Idempotent DDL used by ensureHallPass() so the hall pass works on first deploy even
// before `prisma migrate deploy` has been run against the production database.
// Every statement is safe to run repeatedly.
export const HALL_PASS_DDL: string[] = [
  `DO $$ BEGIN
     CREATE TYPE "PassStatus" AS ENUM ('ACTIVE', 'RETURNED', 'AUTO_CLOSED');
   EXCEPTION WHEN duplicate_object THEN NULL;
   END $$`,
  `CREATE TABLE IF NOT EXISTS "PassDestination" (
     "id" SERIAL NOT NULL,
     "name" TEXT NOT NULL,
     "maxMinutes" INTEGER NOT NULL DEFAULT 10,
     "maxConcurrent" INTEGER,
     "active" BOOLEAN NOT NULL DEFAULT true,
     "sortOrder" INTEGER NOT NULL DEFAULT 0,
     CONSTRAINT "PassDestination_pkey" PRIMARY KEY ("id")
   )`,
  `CREATE TABLE IF NOT EXISTS "HallPass" (
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
     CONSTRAINT "HallPass_pkey" PRIMARY KEY ("id"),
     CONSTRAINT "HallPass_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE,
     CONSTRAINT "HallPass_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "PassDestination"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
     CONSTRAINT "HallPass_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE
   )`,
  `CREATE TABLE IF NOT EXISTS "RestrictedGroup" (
     "id" SERIAL NOT NULL,
     "name" TEXT NOT NULL,
     "note" TEXT,
     "active" BOOLEAN NOT NULL DEFAULT true,
     CONSTRAINT "RestrictedGroup_pkey" PRIMARY KEY ("id")
   )`,
  `CREATE TABLE IF NOT EXISTS "GroupMember" (
     "id" SERIAL NOT NULL,
     "groupId" INTEGER NOT NULL,
     "studentId" TEXT NOT NULL,
     CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("id"),
     CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "RestrictedGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE,
     CONSTRAINT "GroupMember_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "PassDestination_name_key" ON "PassDestination"("name")`,
  `CREATE INDEX IF NOT EXISTS "HallPass_status_idx" ON "HallPass"("status")`,
  `CREATE INDEX IF NOT EXISTS "HallPass_issuedAt_idx" ON "HallPass"("issuedAt")`,
  `CREATE INDEX IF NOT EXISTS "HallPass_studentId_issuedAt_idx" ON "HallPass"("studentId", "issuedAt")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "RestrictedGroup_name_key" ON "RestrictedGroup"("name")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "GroupMember_groupId_studentId_key" ON "GroupMember"("groupId", "studentId")`,
  `CREATE INDEX IF NOT EXISTS "GroupMember_studentId_idx" ON "GroupMember"("studentId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "HallPass_one_active_per_student" ON "HallPass"("studentId") WHERE "status" = 'ACTIVE'`,
  // Starter destinations (editable by admins); only runs together with the table creation above.
  `INSERT INTO "PassDestination" ("name", "maxMinutes", "sortOrder") VALUES
     ('Lower Level Bathroom', 10, 1),
     ('Upper Level Bathroom', 10, 2),
     ('Nurse''s Office', 15, 3),
     ('Office', 10, 4)
   ON CONFLICT ("name") DO NOTHING`,
];
