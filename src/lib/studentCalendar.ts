import { getTranslations } from "next-intl/server";
import prisma from "./prisma";
import { buildIcsCalendar, icsUtc, type IcsEvent } from "./icsCalendar";
import { lessonSeriesWindow } from "./lessonSeries";
import {
  LESSON_DAY_OFFSET,
  fromWallClock,
  parseWallClockString,
  projectLessonToWeek,
  toWallClock,
} from "./schoolTime";
import { withStudyGoalTable } from "./studyGoals";

const DAY_MS = 24 * 60 * 60 * 1000;

export type StudentCalendar = { ics: string; filename: string };

/**
 * The student's timetable and deadlines as an iCalendar file: weekly lessons
 * (repeating to the end of the school year), upcoming exams and assignment
 * deadlines with reminders, and goals that have a target date.
 * Returns null if the student does not exist.
 */
export async function buildStudentCalendar(studentId: string): Promise<StudentCalendar | null> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      username: true,
      name: true,
      surname: true,
      classId: true,
      class: { select: { name: true } },
    },
  });
  if (!student) return null;

  const t = await getTranslations("StudyPlanner.ics");
  const now = new Date();
  const { firstMonday, until } = lessonSeriesWindow(now);
  // Exams and deadlines from the last week onward - enough to see what was just
  // due without dragging the whole year's history into the calendar.
  const since = new Date(now.getTime() - 7 * DAY_MS);
  const events: IcsEvent[] = [];

  const [lessons, exams, assignments] = await Promise.all([
    prisma.lesson.findMany({
      where: { classId: student.classId },
      include: {
        subject: { select: { name: true } },
        teacher: { select: { name: true, surname: true } },
      },
      orderBy: [{ day: "asc" }, { startTime: "asc" }],
    }),
    prisma.exam.findMany({
      where: { lesson: { classId: student.classId }, startTime: { gte: since } },
      include: { lesson: { include: { subject: { select: { name: true } } } } },
      orderBy: { startTime: "asc" },
    }),
    prisma.assignment.findMany({
      where: { lesson: { classId: student.classId }, dueDate: { gte: since } },
      include: { lesson: { include: { subject: { select: { name: true } } } } },
      orderBy: { dueDate: "asc" },
    }),
  ]);

  // Weekly lessons.
  for (const lesson of lessons) {
    if (!(lesson.day in LESSON_DAY_OFFSET)) continue;
    const span = projectLessonToWeek(lesson, firstMonday);
    const start = parseWallClockString(span.start);
    const end = parseWallClockString(span.end);
    if (!start || !end) continue;

    const details = [
      lesson.name && lesson.name !== lesson.subject.name ? lesson.name : null,
      t("teacher", { name: `${lesson.teacher.name} ${lesson.teacher.surname}` }),
      t("class", { name: student.class.name }),
    ].filter(Boolean) as string[];

    events.push({
      kind: "timed",
      uid: `lesson-${lesson.id}@alaninternationalschool.com`,
      summary: lesson.subject.name,
      description: details.join("\n"),
      location: lesson.room ?? undefined,
      categories: [t("lessonCategory")],
      start: fromWallClock(start),
      end: fromWallClock(end),
      rrule: `FREQ=WEEKLY;UNTIL=${icsUtc(until)}`,
    });
  }

  // Exams (skipping ones assigned to other individual students).
  for (const exam of exams) {
    if (exam.targetStudentIds.length > 0 && !exam.targetStudentIds.includes(student.id)) continue;
    const subject = exam.lesson.subject.name;
    events.push({
      kind: "timed",
      uid: `exam-${exam.id}@alaninternationalschool.com`,
      summary: t("examSummary", { title: exam.title }),
      description: [subject, exam.description].filter(Boolean).join("\n"),
      categories: [t("examCategory")],
      start: exam.startTime,
      end: exam.endTime > exam.startTime ? exam.endTime : new Date(exam.startTime.getTime() + 60 * 60 * 1000),
      alarms: [
        { trigger: "-P1D", description: t("examReminder", { title: exam.title }) },
        { trigger: "-PT1H", description: t("examReminder", { title: exam.title }) },
      ],
    });
  }

  // Assignment deadlines: a short event at the due time.
  for (const assignment of assignments) {
    if (
      assignment.targetStudentIds.length > 0 &&
      !assignment.targetStudentIds.includes(student.id)
    ) {
      continue;
    }
    const subject = assignment.lesson.subject.name;
    events.push({
      kind: "timed",
      uid: `assignment-${assignment.id}@alaninternationalschool.com`,
      summary: t("dueSummary", { title: assignment.title }),
      description: [subject, assignment.description].filter(Boolean).join("\n"),
      categories: [t("assignmentCategory")],
      start: assignment.dueDate,
      end: new Date(assignment.dueDate.getTime() + 30 * 60 * 1000),
      alarms: [
        { trigger: "-P1D", description: t("dueReminder", { title: assignment.title }) },
        { trigger: "-PT2H", description: t("dueReminder", { title: assignment.title }) },
      ],
    });
  }

  // Personal goals that have a target date and are not finished yet. The goal
  // table may not exist yet or may fail to load - the timetable export must not.
  try {
    const goals = await withStudyGoalTable(() =>
      prisma.studyGoal.findMany({
        where: { studentId: student.id, targetDate: { not: null }, completedAt: null },
      })
    );
    for (const goal of goals) {
      if (!goal.targetDate) continue;
      const day = toWallClock(goal.targetDate);
      events.push({
        kind: "allDay",
        uid: `goal-${goal.id}@alaninternationalschool.com`,
        summary: t("goalSummary", { title: goal.title }),
        description: t("goalProgress", { progress: goal.progress }),
        categories: [t("goalCategory")],
        date: { year: day.year, month: day.month, day: day.day },
      });
    }
  } catch (error) {
    console.error("Study goals could not be added to the calendar export", error);
  }

  const fullName = `${student.name} ${student.surname}`.trim();
  const ics = buildIcsCalendar({
    name: t("calendarName", { name: fullName }),
    events,
    stamp: now,
  });

  const safeUsername = student.username.replace(/[^\w.-]/g, "_");
  return { ics, filename: `alan-school-${safeUsername}.ics` };
}
