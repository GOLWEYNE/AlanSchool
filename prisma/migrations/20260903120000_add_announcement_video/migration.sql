-- Featured Video Announcement: adds a new, standalone table for the
-- dashboard-wide broadcast video. Nothing existing is touched, so this
-- migration is safe to run against the live production database without
-- downtime or data loss.

-- CreateTable
CREATE TABLE "AnnouncementVideo" (
      "id" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "videoUrl" TEXT NOT NULL,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnnouncementVideo_pkey" PRIMARY KEY ("id")
  );
