// Generated from prisma/migrations/*add_duty_roster/migration.sql.
// Idempotent DDL used by ensureDuty() so the duty roster works on first deploy even
// before `prisma migrate deploy` has been run against the production database.
export const DUTY_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS "DutyTeacher" (
    "id" SERIAL NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameOriginal" TEXT,
    "teacherId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DutyTeacher_pkey" PRIMARY KEY ("id")
)`,
  `CREATE TABLE IF NOT EXISTS "DutySlot" (
    "id" SERIAL NOT NULL,
    "floor" INTEGER NOT NULL,
    "weekday" INTEGER NOT NULL,
    "block" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    CONSTRAINT "DutySlot_pkey" PRIMARY KEY ("id")
)`,
  `CREATE TABLE IF NOT EXISTS "DutyAssignment" (
    "id" SERIAL NOT NULL,
    "slotId" INTEGER NOT NULL,
    "dutyTeacherId" INTEGER NOT NULL,
    CONSTRAINT "DutyAssignment_pkey" PRIMARY KEY ("id")
)`,
  `CREATE TABLE IF NOT EXISTS "DutyNotificationLog" (
    "id" SERIAL NOT NULL,
    "assignmentId" INTEGER,
    "date" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "channels" TEXT NOT NULL DEFAULT '',
    "inApp" BOOLEAN NOT NULL DEFAULT true,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    CONSTRAINT "DutyNotificationLog_pkey" PRIMARY KEY ("id")
)`,
  `CREATE TABLE IF NOT EXISTS "DutyDayOff" (
    "date" TEXT NOT NULL,
    "reason" TEXT,
    CONSTRAINT "DutyDayOff_pkey" PRIMARY KEY ("date")
)`,
  `CREATE TABLE IF NOT EXISTS "DutySettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "leadMinutes" INTEGER NOT NULL DEFAULT 10,
    "notifyAtStart" BOOLEAN NOT NULL DEFAULT true,
    "timeZone" TEXT NOT NULL DEFAULT 'Asia/Almaty',
    CONSTRAINT "DutySettings_pkey" PRIMARY KEY ("id")
)`,
  `CREATE TABLE IF NOT EXISTS "DutyPreference" (
    "userId" TEXT NOT NULL,
    "inApp" BOOLEAN NOT NULL DEFAULT true,
    "push" BOOLEAN NOT NULL DEFAULT true,
    "email" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "DutyPreference_pkey" PRIMARY KEY ("userId")
)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "DutyTeacher_nameEn_key" ON "DutyTeacher"("nameEn")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "DutyTeacher_teacherId_key" ON "DutyTeacher"("teacherId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "DutySlot_floor_weekday_block_startTime_key" ON "DutySlot"("floor", "weekday", "block", "startTime")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "DutyAssignment_slotId_dutyTeacherId_key" ON "DutyAssignment"("slotId", "dutyTeacherId")`,
  `CREATE INDEX IF NOT EXISTS "DutyAssignment_dutyTeacherId_idx" ON "DutyAssignment"("dutyTeacherId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "DutyNotificationLog_assignmentId_date_kind_key" ON "DutyNotificationLog"("assignmentId", "date", "kind")`,
  `CREATE INDEX IF NOT EXISTS "DutyNotificationLog_userId_readAt_idx" ON "DutyNotificationLog"("userId", "readAt")`,
  `DO $$ BEGIN
  ALTER TABLE "DutyTeacher" ADD CONSTRAINT "DutyTeacher_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$`,
  `DO $$ BEGIN
  ALTER TABLE "DutyAssignment" ADD CONSTRAINT "DutyAssignment_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "DutySlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$`,
  `DO $$ BEGIN
  ALTER TABLE "DutyAssignment" ADD CONSTRAINT "DutyAssignment_dutyTeacherId_fkey" FOREIGN KEY ("dutyTeacherId") REFERENCES "DutyTeacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$`,
  `DO $$ BEGIN
  ALTER TABLE "DutyNotificationLog" ADD CONSTRAINT "DutyNotificationLog_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "DutyAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$`,
];
