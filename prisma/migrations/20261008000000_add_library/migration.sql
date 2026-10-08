-- School library. Every statement is idempotent (IF NOT EXISTS) because the app
-- also creates these tables on first use (see src/lib/library.ts ensureLibrary),
-- so running `prisma migrate deploy` before or after that is always safe.

CREATE TABLE IF NOT EXISTS "LibraryBook" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'FICTION',
    "gradeLevel" TEXT,
    "language" TEXT,
    "description" TEXT,
    "coverUrl" TEXT,
    "shelf" TEXT,
    "copies" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LibraryBook_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "LibraryBook_category_idx" ON "LibraryBook"("category");

CREATE TABLE IF NOT EXISTS "LibraryLoan" (
    "id" SERIAL NOT NULL,
    "bookId" INTEGER NOT NULL,
    "studentId" TEXT NOT NULL,
    "borrowedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "returnedAt" TIMESTAMP(3),
    "recordedBy" TEXT,
    CONSTRAINT "LibraryLoan_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LibraryLoan_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "LibraryBook"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "LibraryLoan_studentId_idx" ON "LibraryLoan"("studentId");
CREATE INDEX IF NOT EXISTS "LibraryLoan_bookId_idx" ON "LibraryLoan"("bookId");
CREATE INDEX IF NOT EXISTS "LibraryLoan_returnedAt_idx" ON "LibraryLoan"("returnedAt");

CREATE TABLE IF NOT EXISTS "LibraryReview" (
    "id" SERIAL NOT NULL,
    "bookId" INTEGER NOT NULL,
    "studentId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LibraryReview_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LibraryReview_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "LibraryBook"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "LibraryReview_status_idx" ON "LibraryReview"("status");
CREATE INDEX IF NOT EXISTS "LibraryReview_bookId_idx" ON "LibraryReview"("bookId");

CREATE TABLE IF NOT EXISTS "LibraryPost" (
    "id" SERIAL NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'NEWS',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "imageUrl" TEXT,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LibraryPost_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "LibraryPost_kind_createdAt_idx" ON "LibraryPost"("kind", "createdAt");

CREATE TABLE IF NOT EXISTS "LibraryPhoto" (
    "id" SERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LibraryPhoto_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LibraryRequest" (
    "id" SERIAL NOT NULL,
    "studentId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "reply" TEXT,
    "suggestedBookId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "repliedAt" TIMESTAMP(3),
    CONSTRAINT "LibraryRequest_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LibraryRequest_suggestedBookId_fkey" FOREIGN KEY ("suggestedBookId") REFERENCES "LibraryBook"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "LibraryRequest_studentId_idx" ON "LibraryRequest"("studentId");
CREATE INDEX IF NOT EXISTS "LibraryRequest_status_idx" ON "LibraryRequest"("status");

CREATE TABLE IF NOT EXISTS "LibrarySettings" (
    "id" INTEGER NOT NULL,
    "librarianName" TEXT,
    "librarianImg" TEXT,
    "librarianTeacherId" TEXT,
    "intro" TEXT,
    "goals" TEXT,
    "hours" TEXT,
    "featuredBookId" INTEGER,
    "featuredNote" TEXT,
    "featuredSetAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LibrarySettings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LibrarySettings_featuredBookId_fkey" FOREIGN KEY ("featuredBookId") REFERENCES "LibraryBook"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
