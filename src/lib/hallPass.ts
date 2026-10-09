import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { HALL_PASS_DDL } from "@/lib/hallPassDdl";
import { schoolDayRange } from "@/lib/schoolTime";
import { getTeacherClassIds } from "@/lib/teacherScope";
import {
  HISTORY_EXPORT_LIMIT,
  HISTORY_PAGE_SIZE,
  isValidYmd,
  schoolDayStart,
  type ActivePassesPayload,
  type DestinationDTO,
  type HistoryFilters,
  type HistoryRow,
  type PassStatusKey,
  type PassViewer,
  type StudentPassState,
} from "@/lib/hallPassShared";

// Server code can keep importing everything hall-pass related from "@/lib/hallPass".
export * from "@/lib/hallPassShared";

// Shared (non-"use server") helpers for the digital hall pass.

// ---------------------------------------------------------------------------
// Table bootstrap. Creates the hall pass tables if they don't exist yet
// (idempotent), exactly like ensureLibrary(), so the feature works right after
// deploy; `prisma migrate deploy` stays safe to run too.
// ---------------------------------------------------------------------------
let ready = false;
let pending: Promise<boolean> | null = null;

async function probeTables() {
  await prisma.passDestination.count();
  await prisma.hallPass.count();
  await prisma.restrictedGroup.count();
  await prisma.groupMember.count();
}

async function prepareTables(): Promise<boolean> {
  try {
    await probeTables();
    return true;
  } catch {
    try {
      for (const statement of HALL_PASS_DDL) {
        await prisma.$executeRawUnsafe(statement);
      }
      await probeTables();
      return true;
    } catch (error) {
      console.error("[hallPass] could not prepare tables", error);
      return false;
    }
  }
}

export async function ensureHallPass(): Promise<boolean> {
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

// ---------------------------------------------------------------------------
// Stale passes. A pass nobody ended is closed automatically once the school day
// it was issued on is over, so nobody is "out" forever. Called lazily before
// reads, so no cron job is needed.
// ---------------------------------------------------------------------------
export async function closeStalePasses(): Promise<void> {
  const dayStart = schoolDayStart();
  await prisma.hallPass.updateMany({
    where: { status: "ACTIVE", issuedAt: { lt: dayStart } },
    data: { status: "AUTO_CLOSED" },
  });
}

// ---------------------------------------------------------------------------
// Active passes (live board)
// ---------------------------------------------------------------------------
async function viewerClassFilter(viewer: PassViewer): Promise<Prisma.HallPassWhereInput> {
  if (viewer.role === "admin") return {};
  // Teachers only see passes of students in their own classes (empty list = nothing).
  const classIds = await getTeacherClassIds(viewer.userId);
  return { classId: { in: classIds } };
}

export async function loadActivePasses(viewer: PassViewer): Promise<ActivePassesPayload> {
  await ensureHallPass();
  await closeStalePasses();
  const scope = await viewerClassFilter(viewer);
  const dayStart = schoolDayStart();

  const [rows, todayTotal] = await Promise.all([
    prisma.hallPass.findMany({
      where: { status: "ACTIVE", ...scope },
      orderBy: { issuedAt: "asc" },
      select: {
        id: true,
        studentId: true,
        issuedAt: true,
        maxMinutes: true,
        student: { select: { name: true, surname: true, username: true } },
        class: { select: { name: true } },
        destination: { select: { name: true } },
      },
    }),
    prisma.hallPass.count({ where: { issuedAt: { gte: dayStart }, ...scope } }),
  ]);

  return {
    passes: rows.map((r) => ({
      id: r.id,
      studentId: r.studentId,
      studentName: `${r.student.name} ${r.student.surname}`,
      username: r.student.username,
      className: r.class.name,
      destination: r.destination.name,
      issuedAt: r.issuedAt.toISOString(),
      maxMinutes: r.maxMinutes,
    })),
    todayTotal,
    serverNow: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Student view
// ---------------------------------------------------------------------------
export async function loadStudentPassState(studentId: string): Promise<StudentPassState> {
  await ensureHallPass();
  await closeStalePasses();
  const dayStart = schoolDayStart();

  const [destinations, mine] = await Promise.all([
    prisma.passDestination.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.hallPass.findMany({
      where: { studentId, issuedAt: { gte: dayStart } },
      orderBy: { issuedAt: "desc" },
      select: {
        id: true,
        issuedAt: true,
        returnedAt: true,
        status: true,
        maxMinutes: true,
        destination: { select: { name: true } },
      },
    }),
  ]);

  const open = mine.find((p) => p.status === "ACTIVE") ?? null;
  return {
    destinations: destinations.map((d) => ({
      id: d.id,
      name: d.name,
      maxMinutes: d.maxMinutes,
      maxConcurrent: d.maxConcurrent,
      active: d.active,
      sortOrder: d.sortOrder,
    })),
    active: open
      ? {
          id: open.id,
          destination: open.destination.name,
          issuedAt: open.issuedAt.toISOString(),
          maxMinutes: open.maxMinutes,
        }
      : null,
    today: mine.slice(0, 8).map((p) => ({
      id: p.id,
      destination: p.destination.name,
      issuedAt: p.issuedAt.toISOString(),
      returnedAt: p.returnedAt ? p.returnedAt.toISOString() : null,
      status: p.status as PassStatusKey,
    })),
    serverNow: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// History / audit log
// ---------------------------------------------------------------------------
async function buildHistoryWhere(viewer: PassViewer, f: HistoryFilters): Promise<Prisma.HallPassWhereInput> {
  const and: Prisma.HallPassWhereInput[] = [await viewerClassFilter(viewer)];

  const tokens = (f.q ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4);
  for (const token of tokens) {
    and.push({
      student: {
        OR: [
          { name: { contains: token, mode: "insensitive" } },
          { surname: { contains: token, mode: "insensitive" } },
          { username: { contains: token, mode: "insensitive" } },
        ],
      },
    });
  }

  const range: Prisma.DateTimeFilter = {};
  if (isValidYmd(f.from)) range.gte = schoolDayRange(f.from)[0];
  if (isValidYmd(f.to)) range.lt = schoolDayRange(f.to)[1];
  if (range.gte || range.lt) and.push({ issuedAt: range });

  if (f.destinationId) and.push({ destinationId: f.destinationId });
  if (f.gradeLevel) and.push({ gradeLevel: f.gradeLevel });
  if (f.classId) and.push({ classId: f.classId });
  if (f.status) and.push({ status: f.status });

  return { AND: and };
}

const historySelect = {
  id: true,
  gradeLevel: true,
  maxMinutes: true,
  status: true,
  issuedAt: true,
  returnedAt: true,
  student: { select: { name: true, surname: true, username: true } },
  class: { select: { name: true } },
  destination: { select: { name: true } },
} satisfies Prisma.HallPassSelect;

type HistoryRecord = Prisma.HallPassGetPayload<{ select: typeof historySelect }>;

const toHistoryRow = (r: HistoryRecord): HistoryRow => ({
  id: r.id,
  studentName: `${r.student.name} ${r.student.surname}`,
  username: r.student.username,
  gradeLevel: r.gradeLevel,
  className: r.class.name,
  destination: r.destination.name,
  maxMinutes: r.maxMinutes,
  status: r.status as PassStatusKey,
  issuedAt: r.issuedAt.toISOString(),
  returnedAt: r.returnedAt ? r.returnedAt.toISOString() : null,
});

export async function loadPassHistory(
  viewer: PassViewer,
  filters: HistoryFilters,
  page: number,
  pageSize: number = HISTORY_PAGE_SIZE
): Promise<{ rows: HistoryRow[]; total: number }> {
  await ensureHallPass();
  await closeStalePasses();
  const where = await buildHistoryWhere(viewer, filters);
  const [rows, total] = await Promise.all([
    prisma.hallPass.findMany({
      where,
      orderBy: { issuedAt: "desc" },
      skip: Math.max(0, page - 1) * pageSize,
      take: pageSize,
      select: historySelect,
    }),
    prisma.hallPass.count({ where }),
  ]);
  return { rows: rows.map(toHistoryRow), total };
}

export async function loadPassHistoryForExport(viewer: PassViewer, filters: HistoryFilters): Promise<HistoryRow[]> {
  await ensureHallPass();
  await closeStalePasses();
  const where = await buildHistoryWhere(viewer, filters);
  const rows = await prisma.hallPass.findMany({
    where,
    orderBy: { issuedAt: "desc" },
    take: HISTORY_EXPORT_LIMIT,
    select: historySelect,
  });
  return rows.map(toHistoryRow);
}

// Parses the ?q=&from=&... query string shared by the history page and CSV export.
export function parseHistoryFilters(sp: Record<string, string | undefined>): HistoryFilters {
  const int = (v: string | undefined) => {
    const n = parseInt(v ?? "", 10);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };
  const status = sp.status === "ACTIVE" || sp.status === "RETURNED" || sp.status === "AUTO_CLOSED" ? sp.status : undefined;
  return {
    q: sp.q?.slice(0, 80),
    from: isValidYmd(sp.from) ? sp.from : undefined,
    to: isValidYmd(sp.to) ? sp.to : undefined,
    destinationId: int(sp.destinationId),
    gradeLevel: int(sp.gradeLevel),
    classId: int(sp.classId),
    status,
  };
}
