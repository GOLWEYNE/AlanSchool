-- Weekly IELTS / SAT mock test scores shown on the report card. Additive only.
CREATE TABLE IF NOT EXISTS "MockTestScore" (
    "id" SERIAL NOT NULL,
    "studentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "sections" JSONB,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MockTestScore_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MockTestScore_studentId_takenAt_idx" ON "MockTestScore"("studentId", "takenAt");
