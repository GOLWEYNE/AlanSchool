// Generated from prisma/migrations/*add_mock_test_scores/migration.sql.
// Idempotent DDL used by ensureMockTests() so IELTS/SAT mock scores work on first deploy even
// before `prisma migrate deploy` has been run against the production database.
export const MOCK_TEST_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS "MockTestScore" (
    "id" SERIAL NOT NULL,
    "studentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "sections" JSONB,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MockTestScore_pkey" PRIMARY KEY ("id")
)`,
  `CREATE INDEX IF NOT EXISTS "MockTestScore_studentId_takenAt_idx" ON "MockTestScore"("studentId", "takenAt")`,
];
