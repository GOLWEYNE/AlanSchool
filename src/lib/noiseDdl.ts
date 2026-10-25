// Mirrors prisma/migrations/*add_noise_monitor/migration.sql.
// Idempotent DDL used by ensureNoise() so the noise monitor works on first deploy even
// before `prisma migrate deploy` has been run against the production database.
// Every statement is safe to run repeatedly.
export const NOISE_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS "NoiseMinute" (
"id" SERIAL NOT NULL,
"classId" INTEGER NOT NULL,
"minute" TIMESTAMP(3) NOT NULL,
"seconds" INTEGER NOT NULL,
"sumDb" DOUBLE PRECISION NOT NULL,
"maxDb" DOUBLE PRECISION NOT NULL,
"overSeconds" INTEGER NOT NULL,
"yellowSeconds" INTEGER NOT NULL,
CONSTRAINT "NoiseMinute_pkey" PRIMARY KEY ("id"),
CONSTRAINT "NoiseMinute_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE
)`,
  `CREATE TABLE IF NOT EXISTS "NoiseSetting" (
"id" INTEGER NOT NULL DEFAULT 1,
"limitDb" INTEGER NOT NULL DEFAULT 65,
"yellowMargin" INTEGER NOT NULL DEFAULT 10,
CONSTRAINT "NoiseSetting_pkey" PRIMARY KEY ("id")
)`,
  `CREATE TABLE IF NOT EXISTS "NoiseDevice" (
"classId" INTEGER NOT NULL,
"deviceId" TEXT NOT NULL,
"lastSeenAt" TIMESTAMP(3) NOT NULL,
CONSTRAINT "NoiseDevice_pkey" PRIMARY KEY ("classId"),
CONSTRAINT "NoiseDevice_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE
)`,
  `CREATE INDEX IF NOT EXISTS "NoiseMinute_minute_idx" ON "NoiseMinute"("minute")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "NoiseMinute_classId_minute_key" ON "NoiseMinute"("classId", "minute")`,
];
