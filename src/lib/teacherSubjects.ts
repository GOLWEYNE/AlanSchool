import prisma from "@/lib/prisma";

// The subjects a teacher is responsible for: the ones assigned to them on
// their teacher record, plus any subject they have a lesson in. Used to scope
// what a teacher may add or edit in the curriculum-objective bank.
export async function getTeacherSubjectIds(teacherId: string): Promise<number[]> {
  const [assigned, taught] = await Promise.all([
    prisma.subject.findMany({
      where: { teachers: { some: { id: teacherId } } },
      select: { id: true },
    }),
    prisma.lesson.findMany({
      where: { teacherId },
      select: { subjectId: true },
      distinct: ["subjectId"],
    }),
  ]);

  const ids = new Set<number>();
  assigned.forEach((s: { id: number }) => ids.add(s.id));
  taught.forEach((l: { subjectId: number }) => ids.add(l.subjectId));
  return Array.from(ids);
}
