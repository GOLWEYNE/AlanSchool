-- Library Studio: announcements + "Watch & listen" spaces. Idempotent (see src/lib/library.ts).

ALTER TABLE "LibrarySettings" ADD COLUMN IF NOT EXISTS "spotlightVideoUrl" TEXT;
ALTER TABLE "LibrarySettings" ADD COLUMN IF NOT EXISTS "spotlightVideoTitle" TEXT;
ALTER TABLE "LibrarySettings" ADD COLUMN IF NOT EXISTS "spotlightAudioUrl" TEXT;
ALTER TABLE "LibrarySettings" ADD COLUMN IF NOT EXISTS "spotlightAudioTitle" TEXT;

CREATE TABLE IF NOT EXISTS "LibraryAnnouncement" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "month" TEXT,
    "eventAt" TIMESTAMP(3),
    "audience" TEXT NOT NULL DEFAULT 'ALL',
    "gradeLevels" INTEGER[],
    "classIds" INTEGER[],
    "studentIds" TEXT[],
    "bookIds" INTEGER[],
    "photoUrls" TEXT[],
    "videoUrl" TEXT,
    "audioUrl" TEXT,
    "audioTitle" TEXT,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LibraryAnnouncement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "LibraryAnnouncement_createdAt_idx" ON "LibraryAnnouncement"("createdAt");
CREATE INDEX IF NOT EXISTS "LibraryAnnouncement_type_idx" ON "LibraryAnnouncement"("type");
