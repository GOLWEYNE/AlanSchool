import prisma from "@/lib/prisma";
import { studentsByIds, type PersonLite } from "@/lib/library";
import type { LibraryAnnouncement, Prisma } from "@/generated/prisma/client";

export type Viewer = { all: boolean; grades: number[]; classIds: number[] };

// What a signed-in user is allowed to see. Admins and teachers see everything;
// students and parents see school-wide posts plus the ones aimed at their own
// grade or class.
export async function viewerAudience(userId: string, role: string): Promise<Viewer> {
  if (role === "admin" || role === "teacher") return { all: true, grades: [], classIds: [] };
  const where = role === "student" ? { id: userId } : role === "parent" ? { parentId: userId } : null;
  if (!where) return { all: false, grades: [], classIds: [] };
  const kids = await prisma.student.findMany({
    where,
    select: { classId: true, grade: { select: { level: true } } },
  });
  return {
    all: false,
    grades: Array.from(new Set(kids.map((k) => k.grade.level))),
    classIds: Array.from(new Set(kids.map((k) => k.classId))),
  };
}

export function visibleWhere(viewer: Viewer): Prisma.LibraryAnnouncementWhereInput {
  if (viewer.all) return {};
  return {
    OR: [
      { audience: "ALL" },
      ...(viewer.grades.length ? [{ audience: "GRADES", gradeLevels: { hasSome: viewer.grades } }] : []),
      ...(viewer.classIds.length ? [{ audience: "CLASSES", classIds: { hasSome: viewer.classIds } }] : []),
    ],
  };
}

export type AnnouncementView = LibraryAnnouncement & {
  people: PersonLite[];
  classNames: string[];
  books: { id: number; title: string; author: string; coverUrl: string | null }[];
};

// Loads announcements and resolves the people / classes / books they mention.
export async function loadAnnouncements(
  viewer: Viewer,
  opts: { type?: string; grade?: number; take?: number } = {}
): Promise<AnnouncementView[]> {
  const gradeFilter: Prisma.LibraryAnnouncementWhereInput = opts.grade
    ? { OR: [{ gradeLevels: { has: opts.grade } }, { audience: "ALL" }] }
    : {};
  const rows = await prisma.libraryAnnouncement.findMany({
    where: {
      AND: [
        visibleWhere(viewer),
        opts.type ? { type: opts.type } : {},
        gradeFilter,
      ],
    },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: opts.take ?? 30,
  });

  const people = await studentsByIds(rows.flatMap((r) => r.studentIds));
  const classIds = Array.from(new Set(rows.flatMap((r) => r.classIds)));
  const bookIds = Array.from(new Set(rows.flatMap((r) => r.bookIds)));
  const [classes, books] = await Promise.all([
    classIds.length
      ? prisma.class.findMany({ where: { id: { in: classIds } }, select: { id: true, name: true } })
      : Promise.resolve([]),
    bookIds.length
      ? prisma.libraryBook.findMany({
          where: { id: { in: bookIds } },
          select: { id: true, title: true, author: true, coverUrl: true },
        })
      : Promise.resolve([]),
  ]);
  const classMap = new Map(classes.map((c) => [c.id, c.name]));
  const bookMap = new Map(books.map((b) => [b.id, b]));

  return rows.map((r) => ({
    ...r,
    people: r.studentIds.map((id) => people.get(id)).filter((p): p is PersonLite => !!p),
    classNames: r.classIds.map((id) => classMap.get(id)).filter((n): n is string => !!n),
    books: r.bookIds.map((id) => bookMap.get(id)).filter((b): b is NonNullable<typeof b> => !!b),
  }));
}

// Grades, classes and students for the pickers (admin Studio only).
export async function getPickerData() {
  const [classes, students] = await Promise.all([
    prisma.class.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, grade: { select: { level: true } }, _count: { select: { students: true } } },
    }),
    prisma.student.findMany({
      orderBy: [{ surname: "asc" }, { name: "asc" }],
      select: { id: true, name: true, surname: true, classId: true, img: true },
    }),
  ]);
  const grades = Array.from(new Set(classes.map((c) => c.grade.level))).sort((a, b) => a - b);
  return {
    grades,
    classes: classes.map((c) => ({ id: c.id, name: c.name, grade: c.grade.level, students: c._count.students })),
    students: students.map((s) => ({ id: s.id, name: `${s.surname} ${s.name}`, classId: s.classId, img: s.img })),
  };
}
