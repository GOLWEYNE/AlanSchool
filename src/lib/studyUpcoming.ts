import prisma from "./prisma";
import { fromWallClock, toWallClock } from "./schoolTime";

// What is coming up for a student in the next month: exams and assignment
// deadlines of their class (respecting exams/assignments aimed at specific
// students). Shared by the student's own Study Planner page and the read-only
// view staff get on the student's profile.

const DAY_MS = 24 * 60 * 60 * 1000;

export const UPCOMING_DAYS = 30;

export type UpcomingItem = {
  key: string;
  type: "exam" | "assignment";
  title: string;
  subject: string;
  at: Date;
};

/** Whole school-calendar days from today to the given instant (0 = today). */
export const daysFromToday = (at: Date, now: Date) => {
  const a = toWallClock(at);
  const b = toWallClock(now);
  return Math.round(
    (Date.UTC(a.year, a.month - 1, a.day) - Date.UTC(b.year, b.month - 1, b.day)) / DAY_MS
  );
};

/** The instant the current school day started (midnight, school time). */
export const startOfSchoolDay = (now: Date) => fromWallClock(toWallClock(now));

export async function getUpcomingItems(
  studentId: string,
  classId: number,
  now: Date = new Date()
): Promise<UpcomingItem[]> {
  const horizon = new Date(now.getTime() + UPCOMING_DAYS * DAY_MS);
  const [exams, assignments] = await Promise.all([
    prisma.exam.findMany({
      where: { lesson: { classId }, startTime: { gte: now, lte: horizon } },
      include: { lesson: { include: { subject: { select: { name: true } } } } },
      orderBy: { startTime: "asc" },
    }),
    prisma.assignment.findMany({
      where: { lesson: { classId }, dueDate: { gte: now, lte: horizon } },
      include: { lesson: { include: { subject: { select: { name: true } } } } },
      orderBy: { dueDate: "asc" },
    }),
  ]);

  const forStudent = (ids: string[]) => ids.length === 0 || ids.includes(studentId);

  return [
    ...exams
      .filter((e) => forStudent(e.targetStudentIds))
      .map((e) => ({
        key: `exam-${e.id}`,
        type: "exam" as const,
        title: e.title,
        subject: e.lesson.subject.name,
        at: e.startTime,
      })),
    ...assignments
      .filter((a) => forStudent(a.targetStudentIds))
      .map((a) => ({
        key: `assignment-${a.id}`,
        type: "assignment" as const,
        title: a.title,
        subject: a.lesson.subject.name,
        at: a.dueDate,
      })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());
}
