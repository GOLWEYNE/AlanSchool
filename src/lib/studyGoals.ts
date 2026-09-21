import prisma from "./prisma";

// Study goals live in their own table (prisma/migrations/*_add_study_goals).
// New tables only reach the production database when someone runs
// `prisma migrate deploy`, which this project's Vercel build does not do, so
// the first use creates the (additive, idempotent) table itself if it is
// missing. The SQL below is the same as the migration file's.

/** How many goals one student can keep - the tracker is meant to stay light. */
export const MAX_STUDY_GOALS = 30;

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS "StudyGoal" (
    "id" SERIAL NOT NULL,
    "studentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subjectId" INTEGER,
    "targetDate" TIMESTAMP(3),
    "progress" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StudyGoal_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StudyGoal_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudyGoal_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE
)`;

const CREATE_INDEX_SQL = `CREATE INDEX IF NOT EXISTS "StudyGoal_studentId_idx" ON "StudyGoal"("studentId")`;

const isMissingTableError = (error: unknown) => {
  const code = (error as { code?: string } | null)?.code;
  if (code === "P2021") return true;
  const message = String((error as { message?: string } | null)?.message ?? error);
  return /StudyGoal/.test(message) && /does not exist|42P01/i.test(message);
};

let creating: Promise<void> | null = null;

const createTable = () => {
  creating ??= (async () => {
    try {
      await prisma.$executeRawUnsafe(CREATE_TABLE_SQL);
      await prisma.$executeRawUnsafe(CREATE_INDEX_SQL);
    } catch (error) {
      creating = null; // let the next request try again
      throw error;
    }
  })();
  return creating;
};

/**
 * Runs a StudyGoal query; if the table does not exist yet, creates it and
 * retries once.
 */
export async function withStudyGoalTable<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (!isMissingTableError(error)) throw error;
    await createTable();
    return run();
  }
}

export type StudyGoalView = {
  id: number;
  title: string;
  subjectId: number | null;
  subjectName: string | null;
  /** ISO instant (school-time midnight of the target day), or null. */
  targetDate: string | null;
  progress: number;
  /** ISO instant, or null while the goal is still open. */
  completedAt: string | null;
};

/** A student's goals: open ones first (soonest target date first), done ones last. */
export async function getStudyGoals(studentId: string): Promise<StudyGoalView[]> {
  const rows = await withStudyGoalTable(() =>
    prisma.studyGoal.findMany({
      where: { studentId },
      include: { subject: { select: { name: true } } },
    })
  );

  const views = rows.map((g) => ({
    id: g.id,
    title: g.title,
    subjectId: g.subjectId,
    subjectName: g.subject?.name ?? null,
    targetDate: g.targetDate ? g.targetDate.toISOString() : null,
    progress: g.progress,
    completedAt: g.completedAt ? g.completedAt.toISOString() : null,
    createdAt: g.createdAt.getTime(),
  }));

  views.sort((a, b) => {
    const aDone = a.completedAt !== null;
    const bDone = b.completedAt !== null;
    if (aDone !== bDone) return aDone ? 1 : -1;
    if (aDone && bDone) return (b.completedAt ?? "").localeCompare(a.completedAt ?? "");
    const aDate = a.targetDate ?? "9999";
    const bDate = b.targetDate ?? "9999";
    if (aDate !== bDate) return aDate.localeCompare(bDate);
    return b.createdAt - a.createdAt;
  });

  return views.map(({ createdAt: _createdAt, ...rest }) => rest);
}
