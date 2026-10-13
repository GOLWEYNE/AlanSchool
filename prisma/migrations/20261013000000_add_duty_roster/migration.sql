-- Duty roster + notifications. Additive only.
CREATE TABLE "DutyTeacher" (
    "id" SERIAL NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameOriginal" TEXT,
    "teacherId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DutyTeacher_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DutySlot" (
    "id" SERIAL NOT NULL,
    "floor" INTEGER NOT NULL,
    "weekday" INTEGER NOT NULL,
    "block" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    CONSTRAINT "DutySlot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DutyAssignment" (
    "id" SERIAL NOT NULL,
    "slotId" INTEGER NOT NULL,
    "dutyTeacherId" INTEGER NOT NULL,
    CONSTRAINT "DutyAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DutyNotificationLog" (
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
);

CREATE TABLE "DutyDayOff" (
    "date" TEXT NOT NULL,
    "reason" TEXT,
    CONSTRAINT "DutyDayOff_pkey" PRIMARY KEY ("date")
);

CREATE TABLE "DutySettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "leadMinutes" INTEGER NOT NULL DEFAULT 10,
    "notifyAtStart" BOOLEAN NOT NULL DEFAULT true,
    "timeZone" TEXT NOT NULL DEFAULT 'Asia/Almaty',
    CONSTRAINT "DutySettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DutyPreference" (
    "userId" TEXT NOT NULL,
    "inApp" BOOLEAN NOT NULL DEFAULT true,
    "push" BOOLEAN NOT NULL DEFAULT true,
    "email" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "DutyPreference_pkey" PRIMARY KEY ("userId")
);

CREATE UNIQUE INDEX "DutyTeacher_nameEn_key" ON "DutyTeacher"("nameEn");
CREATE UNIQUE INDEX "DutyTeacher_teacherId_key" ON "DutyTeacher"("teacherId");
CREATE UNIQUE INDEX "DutySlot_floor_weekday_block_startTime_key" ON "DutySlot"("floor", "weekday", "block", "startTime");
CREATE UNIQUE INDEX "DutyAssignment_slotId_dutyTeacherId_key" ON "DutyAssignment"("slotId", "dutyTeacherId");
CREATE INDEX "DutyAssignment_dutyTeacherId_idx" ON "DutyAssignment"("dutyTeacherId");
CREATE UNIQUE INDEX "DutyNotificationLog_assignmentId_date_kind_key" ON "DutyNotificationLog"("assignmentId", "date", "kind");
CREATE INDEX "DutyNotificationLog_userId_readAt_idx" ON "DutyNotificationLog"("userId", "readAt");

ALTER TABLE "DutyTeacher" ADD CONSTRAINT "DutyTeacher_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DutyAssignment" ADD CONSTRAINT "DutyAssignment_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "DutySlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DutyAssignment" ADD CONSTRAINT "DutyAssignment_dutyTeacherId_fkey" FOREIGN KEY ("dutyTeacherId") REFERENCES "DutyTeacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DutyNotificationLog" ADD CONSTRAINT "DutyNotificationLog_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "DutyAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
