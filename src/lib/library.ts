import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { LIBRARY_DDL } from "@/lib/libraryDdl";
import { schoolMonthKey, schoolMonthStart } from "@/lib/libraryShared";

// Creates the library tables if they don't exist yet (idempotent). This makes the
// feature work right after deploy; `prisma migrate deploy` stays safe to run too.
let ready = false;
let pending: Promise<boolean> | null = null;

async function prepareTables(): Promise<boolean> {
  try {
    await prisma.libraryBook.count();
    await prisma.libraryRequest.count();
    await prisma.libraryAnnouncement.count();
    await prisma.librarySettings.findFirst({ select: { spotlightVideoUrl: true } });
    return true;
  } catch {
    try {
      for (const statement of LIBRARY_DDL) {
        await prisma.$executeRawUnsafe(statement);
      }
      await prisma.libraryAnnouncement.count();
      await prisma.librarySettings.findFirst({ select: { spotlightVideoUrl: true } });
      return true;
    } catch (error) {
      console.error("[library] could not prepare tables", error);
      return false;
    }
  }
}

export async function ensureLibrary(): Promise<boolean> {
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

// The full librarian desk (lending, returns, review moderation, book requests,
// the collection and settings) is for admins only. The teacher chosen as
// librarian gets Library Studio instead (see canUseStudio).
export async function canManageLibrary(_userId: string | null | undefined, role: string): Promise<boolean> {
  return role === "admin";
}

// True for the teacher an admin picked as the school librarian.
export async function isLibrarianTeacher(userId: string | null | undefined, role: string): Promise<boolean> {
  if (role !== "teacher" || !userId) return false;
  try {
    const settings = await prisma.librarySettings.findUnique({
      where: { id: 1 },
      select: { librarianTeacherId: true },
    });
    return settings?.librarianTeacherId === userId;
  } catch {
    return false;
  }
}

// Library Studio (write announcements, upload photos / video / audio) is open to
// admins and to the teacher chosen as librarian.
export async function canUseStudio(userId: string | null | undefined, role: string): Promise<boolean> {
  return role === "admin" || (await isLibrarianTeacher(userId, role));
}

// The librarian teacher only works in Library Studio: every other library page
// sends them straight there.
export async function keepLibrarianInStudio(userId: string | null | undefined, role: string): Promise<void> {
  if (await isLibrarianTeacher(userId, role)) redirect("/dashboard/list/library/studio");
}

export type PersonLite = {
  id: string;
  name: string;
  img: string | null;
  className: string;
  classId: number;
};

export async function studentsByIds(ids: string[]): Promise<Map<string, PersonLite>> {
  const unique = Array.from(new Set(ids));
  if (unique.length === 0) return new Map();
  const rows = await prisma.student.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true, surname: true, img: true, classId: true, class: { select: { name: true } } },
  });
  return new Map(
    rows.map((s) => [
      s.id,
      { id: s.id, name: `${s.name} ${s.surname}`, img: s.img, className: s.class.name, classId: s.classId },
    ])
  );
}

export type ReaderRow = { student: PersonLite; count: number };
export type ClassRow = { classId: number; name: string; total: number; students: number; average: number };

// Everything the stats / overview pages need, computed from finished loans of
// non-textbook books ("books read").
export async function getReadingOverview() {
  const monthStart = schoolMonthStart();
  const sixMonthsAgo = schoolMonthStart(new Date(), 5);

  const finished = await prisma.libraryLoan.findMany({
    where: { returnedAt: { not: null }, book: { category: { not: "TEXTBOOK" } } },
    select: { studentId: true, returnedAt: true },
  });

  const perStudentAll = new Map<string, number>();
  const perStudentMonth = new Map<string, number>();
  const perMonth = new Map<string, number>();
  for (const l of finished) {
    perStudentAll.set(l.studentId, (perStudentAll.get(l.studentId) ?? 0) + 1);
    const when = l.returnedAt as Date;
    if (when >= monthStart) perStudentMonth.set(l.studentId, (perStudentMonth.get(l.studentId) ?? 0) + 1);
    if (when >= sixMonthsAgo) {
      const key = schoolMonthKey(when);
      perMonth.set(key, (perMonth.get(key) ?? 0) + 1);
    }
  }

  const people = await studentsByIds(Array.from(perStudentAll.keys()));

  const toRows = (m: Map<string, number>): ReaderRow[] =>
    Array.from(m.entries())
      .filter(([id]) => people.has(id))
      .map(([id, count]) => ({ student: people.get(id)!, count }))
      .sort((a, b) => b.count - a.count || a.student.name.localeCompare(b.student.name));

  const allTime = toRows(perStudentAll);
  const thisMonth = toRows(perStudentMonth);

  // Class ranking: average books per student so big and small classes compare fairly.
  const perClass = new Map<number, number>();
  for (const row of allTime) perClass.set(row.student.classId, (perClass.get(row.student.classId) ?? 0) + row.count);
  const classes = perClass.size
    ? await prisma.class.findMany({
        where: { id: { in: Array.from(perClass.keys()) } },
        select: { id: true, name: true, _count: { select: { students: true } } },
      })
    : [];
  const classRows: ClassRow[] = classes
    .map((c) => {
      const total = perClass.get(c.id) ?? 0;
      const students = c._count.students;
      return { classId: c.id, name: c.name, total, students, average: students ? total / students : 0 };
    })
    .sort((a, b) => b.average - a.average || b.total - a.total);

  // Last six months (oldest first), including empty months.
  const months: { key: string; count: number }[] = [];
  for (let back = 5; back >= 0; back--) {
    const key = schoolMonthKey(new Date(schoolMonthStart(new Date(), back).getTime() + 3 * 24 * 3600 * 1000));
    months.push({ key, count: perMonth.get(key) ?? 0 });
  }

  return {
    totalRead: finished.length,
    readers: perStudentAll.size,
    allTime,
    thisMonth,
    classRows,
    months,
  };
}

// A student's own reading numbers.
export async function getStudentReading(studentId: string) {
  const loans = await prisma.libraryLoan.findMany({
    where: { studentId },
    orderBy: { borrowedAt: "desc" },
    include: { book: { select: { id: true, title: true, author: true, category: true, coverUrl: true } } },
  });
  const finished = loans.filter((l) => l.returnedAt && l.book.category !== "TEXTBOOK");
  const active = loans.filter((l) => !l.returnedAt);
  return {
    booksRead: finished.length,
    active,
    finishedDates: finished.map((l) => l.returnedAt as Date),
    recent: finished.slice(0, 5),
  };
}
