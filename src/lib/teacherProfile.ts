import prisma from "@/lib/prisma";

// Shared constants for the teacher profile (kept here, not in the "use server"
// actions file, which may only export async functions).

export const POSITIONS = [
  "SUBJECT_TEACHER",
  "CLASS_SUPERVISOR",
  "CLUB_SUPERVISOR",
  "HEAD_OF_DEPARTMENT",
  "DEPUTY_DIRECTOR",
  "DIRECTOR",
  "LIBRARIAN",
  "OTHER",
] as const;
export type PositionKey = (typeof POSITIONS)[number];

export const OBJECTIVE_STATUSES = ["PLANNED", "IN_PROGRESS", "ACHIEVED"] as const;
export type ObjectiveStatus = (typeof OBJECTIVE_STATUSES)[number];

export const TERMS = [1, 2, 3, 4] as const;

export type Achievement = { title: string; year?: number | null; note?: string };

// Idempotent DDL, kept in sync with prisma/migrations/*_add_teacher_profile.
// Like the Library and club supervision, the tables create themselves on first
// use because production does not run `prisma migrate deploy` on every release.
const TEACHER_PROFILE_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS "TeacherProfile" (
    "teacherId" TEXT NOT NULL,
    "photoUrl" TEXT,
    "position" TEXT,
    "department" TEXT,
    "yearJoined" INTEGER,
    "about" TEXT,
    "education" TEXT,
    "previousSchools" TEXT,
    "yearsExperience" INTEGER,
    "certificates" TEXT,
    "achievements" JSONB,
    "vision" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeacherProfile_pkey" PRIMARY KEY ("teacherId"),
    CONSTRAINT "TeacherProfile_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "TeacherObjective" (
    "id" SERIAL NOT NULL,
    "schoolYear" TEXT NOT NULL,
    "term" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "teacherId" TEXT NOT NULL,
    CONSTRAINT "TeacherObjective_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TeacherObjective_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "TeacherObjective_teacherId_schoolYear_idx" ON "TeacherObjective"("teacherId", "schoolYear")`,
];

let ready = false;
let pending: Promise<boolean> | null = null;

async function prepareTables(): Promise<boolean> {
  try {
    await prisma.teacherProfile.count();
    await prisma.teacherObjective.count();
    return true;
  } catch {
    try {
      for (const statement of TEACHER_PROFILE_DDL) {
        await prisma.$executeRawUnsafe(statement);
      }
      await prisma.teacherProfile.count();
      await prisma.teacherObjective.count();
      return true;
    } catch (error) {
      console.error("[teacher-profile] could not prepare tables", error);
      return false;
    }
  }
}

export async function ensureTeacherProfile(): Promise<boolean> {
  if (ready) return true;
  if (!pending) {
    pending = prepareTables().finally(() => {
      pending = null;
    });
  }
  const ok = await pending;
  if (ok) ready = true;
  return ok;
}

// True when a signed-in teacher still has to complete their profile. It is
// deliberately forgiving so it can never lock anyone out: if the tables can't
// be prepared, or the user has no Teacher record, nobody is sent to the form.
export async function teacherNeedsProfile(teacherId: string): Promise<boolean> {
  try {
    if (!(await ensureTeacherProfile())) return false;
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { id: true, profile: { select: { completedAt: true } } },
    });
    if (!teacher) return false;
    return !teacher.profile?.completedAt;
  } catch (error) {
    console.error("[teacher-profile] gate check failed", error);
    return false;
  }
}

export function parseAchievements(value: unknown): Achievement[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => {
      const item = v as Partial<Achievement> | null;
      if (!item || typeof item.title !== "string" || !item.title.trim()) return null;
      return {
        title: item.title,
        year: typeof item.year === "number" ? item.year : null,
        note: typeof item.note === "string" ? item.note : "",
      } as Achievement;
    })
    .filter((v): v is Achievement => v !== null);
}
