import FormContainer from "@/components/FormContainer";
import TableSearch from "@/components/TableSearch";
import TimetableGrid, { TimetableLessonItem } from "@/components/TimetableGrid";
import prisma from "@/lib/prisma";
import { Class, Lesson, Prisma, Subject, Teacher } from "@/generated/prisma/client";
import { auth } from "@clerk/nextjs/server";
import { getUserRole } from "@/lib/auth";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

type LessonList = Lesson & {
  subject: Subject;
  class: Class;
  teacher: Teacher;
};

// Every stored lesson time only carries a meaningful day-of-week + time-of-day
// (see adjustScheduleToCurrentWeek in src/lib/utils.ts, which the read-only
// class/teacher/parent schedule views already rely on) - this re-projects
// each lesson onto the current real week so the grid's Mon-Fri columns line
// up with real, human-readable dates.
const projectOntoCurrentWeek = (lessons: LessonList[]): TimetableLessonItem[] => {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  return lessons.map((lesson) => {
    const lessonDayOfWeek = lesson.startTime.getDay();
    const daysFromMonday = lessonDayOfWeek === 0 ? 6 : lessonDayOfWeek - 1;

    const start = new Date(monday);
    start.setDate(monday.getDate() + daysFromMonday);
    start.setHours(
      lesson.startTime.getHours(),
      lesson.startTime.getMinutes(),
      lesson.startTime.getSeconds(),
      0
    );

    const end = new Date(start);
    end.setHours(
      lesson.endTime.getHours(),
      lesson.endTime.getMinutes(),
      lesson.endTime.getSeconds(),
      0
    );

    return {
      id: lesson.id,
      name: lesson.name,
      room: lesson.room ?? null,
      subjectId: lesson.subjectId,
      subjectName: lesson.subject.name,
      classId: lesson.classId,
      className: lesson.class.name,
      teacherId: lesson.teacherId,
      teacherName: `${lesson.teacher.name} ${lesson.teacher.surname}`,
      start,
      end,
    };
  });
};

const LessonsListPage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {
  const { userId, sessionClaims } = auth();
  const role = getUserRole(sessionClaims);
  const currentUserId = userId;
  const t = await getTranslations("List.lessons");

  const query: Prisma.LessonWhereInput = {};
  let selectedClassId: number | undefined;
  let selectedTeacherId: string | undefined;

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== undefined) {
        switch (key) {
          case "classId":
            selectedClassId = parseInt(value);
            break;
          case "teacherId":
            selectedTeacherId = value;
            break;
          case "search":
            query.OR = [
              { name: { contains: value, mode: "insensitive" } },
              { subject: { name: { contains: value, mode: "insensitive" } } },
            ];
            break;
          default:
            break;
        }
      }
    }
  }

  // Classes/teachers pickers are an admin-only convenience - a school-wide
  // grid with every lesson from every class superimposed on one Mon-Fri
  // week would be unreadable, so admins pick a scope like the attendance
  // screen does. Teachers always see just their own lessons - a manageable
  // number - so they skip the picker entirely.
  let classOptions: { id: number; name: string }[] = [];
  let teacherOptions: { id: string; name: string; surname: string }[] = [];

  if (role === "admin") {
    classOptions = await prisma.class.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    teacherOptions = await prisma.teacher.findMany({
      select: { id: true, name: true, surname: true },
      orderBy: { name: "asc" },
    });

    if (!selectedClassId && !selectedTeacherId) {
      selectedClassId = classOptions[0]?.id;
    }
    if (selectedClassId) query.classId = selectedClassId;
    if (selectedTeacherId) query.teacherId = selectedTeacherId;
  }

  if (role === "teacher") {
    query.teacherId = currentUserId!;
  }

  const data: LessonList[] = await prisma.lesson.findMany({
    where: query,
    include: {
      subject: true,
      class: true,
      teacher: true,
    },
    orderBy: { startTime: "asc" },
  });

  const timetableLessons = projectOntoCurrentWeek(data);

  const canEdit = role === "admin" || role === "teacher";
  const actionsByLessonId: Record<number, ReactNode> = {};
  if (canEdit) {
    for (const item of data) {
      actionsByLessonId[item.id] = (
        <>
          <FormContainer table="lesson" type="update" data={item} />
          {role === "admin" && <FormContainer table="lesson" type="delete" id={item.id} />}
        </>
      );
    }
  }

  return (
    <div className="panel-card p-4 md:p-5 rounded-md flex-1 m-4 mt-0 shine-hover">
      <div className="flex items-center justify-between">
        <h1 className="hidden md:block text-lg font-semibold text-blue-900">{t("heading")}</h1>
        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          <TableSearch />
          <div className="flex items-center gap-4 self-end">
            {canEdit && <FormContainer table="lesson" type="create" />}
          </div>
        </div>
      </div>

      {role === "admin" && (
        <form
          className="panel-card p-4 rounded-md mt-4 shine-hover flex flex-wrap items-end gap-4"
          method="GET"
        >
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 dark:text-slate-400">Class</label>
            <select
              name="classId"
              defaultValue={selectedTeacherId ? "" : selectedClassId}
              className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2 rounded-md text-sm min-w-[10rem]"
            >
              <option value="">All classes</option>
              {classOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 dark:text-slate-400">Teacher</label>
            <select
              name="teacherId"
              defaultValue={selectedTeacherId ?? ""}
              className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2 rounded-md text-sm min-w-[12rem]"
            >
              <option value="">Any teacher</option>
              {teacherOptions.map((tOpt) => (
                <option key={tOpt.id} value={tOpt.id}>
                  {tOpt.name} {tOpt.surname}
                </option>
              ))}
            </select>
          </div>
          <button className="bg-blue-500 text-white px-4 py-2 rounded-md text-sm font-semibold">
            Load timetable
          </button>
        </form>
      )}

      <TimetableGrid lessons={timetableLessons} canEdit={canEdit} actionsByLessonId={actionsByLessonId} />
    </div>
  );
};

export default LessonsListPage;
