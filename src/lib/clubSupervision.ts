import prisma from "@/lib/prisma";

// Idempotent DDL, kept in sync with
// prisma/migrations/*_add_club_supervision/migration.sql. The production
// database does not run `prisma migrate deploy` on every release, so (like the
// Library) the club-supervision tables create themselves on first use and the
// feature works straight after deploy. `prisma migrate deploy` stays safe too.
const CLUB_SUPERVISION_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS "ClubSupervisor" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clubId" INTEGER NOT NULL,
    "teacherId" TEXT NOT NULL,
    CONSTRAINT "ClubSupervisor_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ClubSupervisor_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClubSupervisor_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ClubSupervisor_clubId_teacherId_key" ON "ClubSupervisor"("clubId", "teacherId")`,
  `CREATE INDEX IF NOT EXISTS "ClubSupervisor_teacherId_idx" ON "ClubSupervisor"("teacherId")`,
  `CREATE TABLE IF NOT EXISTS "ClubUniformCheck" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "status" "UniformStatus" NOT NULL,
    "missingItems" TEXT[],
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "clubId" INTEGER NOT NULL,
    "studentId" TEXT NOT NULL,
    "checkedById" TEXT,
    CONSTRAINT "ClubUniformCheck_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ClubUniformCheck_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClubUniformCheck_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClubUniformCheck_checkedById_fkey" FOREIGN KEY ("checkedById") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ClubUniformCheck_clubId_studentId_date_key" ON "ClubUniformCheck"("clubId", "studentId", "date")`,
  `CREATE INDEX IF NOT EXISTS "ClubUniformCheck_clubId_date_idx" ON "ClubUniformCheck"("clubId", "date")`,
  // Every existing club instructor becomes a supervisor of their club.
  `INSERT INTO "ClubSupervisor" ("clubId", "teacherId")
   SELECT "id", "instructorId" FROM "Club" WHERE "instructorId" IS NOT NULL
   ON CONFLICT DO NOTHING`,
];

let ready = false;
let pending: Promise<boolean> | null = null;

async function prepareTables(): Promise<boolean> {
  try {
    await prisma.clubSupervisor.count();
    await prisma.clubUniformCheck.count();
    return true;
  } catch {
    try {
      for (const statement of CLUB_SUPERVISION_DDL) {
        await prisma.$executeRawUnsafe(statement);
      }
      await prisma.clubSupervisor.count();
      await prisma.clubUniformCheck.count();
      return true;
    } catch (error) {
      console.error("[clubs] could not prepare supervision tables", error);
      return false;
    }
  }
}

export async function ensureClubSupervision(): Promise<boolean> {
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

export type ClubSupervisorLite = { id: string; name: string; surname: string };

// Teacher ids supervising each club (lead instructor included), keyed by club id.
export async function getClubSupervisors(
  clubIds: number[]
): Promise<Map<number, ClubSupervisorLite[]>> {
  const result = new Map<number, ClubSupervisorLite[]>();
  if (clubIds.length === 0) return result;

  const clubs = await prisma.club.findMany({
    where: { id: { in: clubIds } },
    select: { id: true, instructor: { select: { id: true, name: true, surname: true } } },
  });
  for (const club of clubs) {
    result.set(club.id, club.instructor ? [club.instructor] : []);
  }

  if (await ensureClubSupervision()) {
    const rows = await prisma.clubSupervisor.findMany({
      where: { clubId: { in: clubIds } },
      orderBy: { createdAt: "asc" },
      select: {
        clubId: true,
        teacher: { select: { id: true, name: true, surname: true } },
      },
    });
    for (const row of rows) {
      const list = result.get(row.clubId) ?? [];
      if (!list.some((t) => t.id === row.teacher.id)) list.push(row.teacher);
      result.set(row.clubId, list);
    }
  }
  return result;
}

// Ids of the clubs a teacher supervises (as lead instructor or co-supervisor).
export async function getSupervisedClubIds(teacherId: string | null | undefined): Promise<number[]> {
  if (!teacherId) return [];
  const ids = new Set<number>();
  const led = await prisma.club.findMany({
    where: { instructorId: teacherId },
    select: { id: true },
  });
  led.forEach((c) => ids.add(c.id));
  if (await ensureClubSupervision()) {
    const rows = await prisma.clubSupervisor.findMany({
      where: { teacherId },
      select: { clubId: true },
    });
    rows.forEach((r) => ids.add(r.clubId));
  }
  return Array.from(ids);
}

// Admins manage every club; a teacher only the clubs they supervise.
export async function canSuperviseClub(
  role: string,
  userId: string | null | undefined,
  clubId: number
): Promise<boolean> {
  if (role === "admin") return true;
  if (role !== "teacher" || !userId) return false;
  const ids = await getSupervisedClubIds(userId);
  return ids.includes(clubId);
}

// Replaces a club's supervisors. The lead instructor (if any) is always kept.
export async function setClubSupervisors(
  clubId: number,
  teacherIds: string[],
  leadId?: string | null
): Promise<void> {
  if (!(await ensureClubSupervision())) return;
  const wanted = Array.from(new Set([...(leadId ? [leadId] : []), ...teacherIds].filter(Boolean)));
  const valid = await prisma.teacher.findMany({
    where: { id: { in: wanted } },
    select: { id: true },
  });
  const validIds = valid.map((t) => t.id);
  await prisma.$transaction([
    prisma.clubSupervisor.deleteMany({ where: { clubId, teacherId: { notIn: validIds } } }),
    prisma.clubSupervisor.createMany({
      data: validIds.map((teacherId) => ({ clubId, teacherId })),
      skipDuplicates: true,
    }),
  ]);
}
