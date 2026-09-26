-- Class Locator: the room number of each class. Purely additive, own table
-- so existing Class queries are untouched. Idempotent (also created lazily by
-- src/lib/classLocator.ts because the Vercel build does not run migrations).
CREATE TABLE IF NOT EXISTS "ClassLocator" (
    "classId" INTEGER NOT NULL,
    "roomNumber" TEXT NOT NULL,
    CONSTRAINT "ClassLocator_pkey" PRIMARY KEY ("classId"),
    CONSTRAINT "ClassLocator_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
