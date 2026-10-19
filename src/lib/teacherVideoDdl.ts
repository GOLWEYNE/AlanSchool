// Generated from prisma/migrations/*add_teacher_recordings_live/migration.sql.
// Idempotent DDL used by ensureTeacherVideo() so saved recordings and live
// streaming work on first deploy even before `prisma migrate deploy` has been
// run against the production database.
export const TEACHER_VIDEO_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS "TeacherRecording" (
    "id" SERIAL NOT NULL,
    "teacherId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "durationSec" INTEGER NOT NULL DEFAULT 0,
    "bytes" INTEGER NOT NULL DEFAULT 0,
    "sharedWithParents" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeacherRecording_pkey" PRIMARY KEY ("id")
)`,
  `CREATE INDEX IF NOT EXISTS "TeacherRecording_teacherId_createdAt_idx" ON "TeacherRecording"("teacherId", "createdAt")`,
  `CREATE TABLE IF NOT EXISTS "TeacherLive" (
    "teacherId" TEXT NOT NULL,
    "title" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeacherLive_pkey" PRIMARY KEY ("teacherId")
)`,
];
