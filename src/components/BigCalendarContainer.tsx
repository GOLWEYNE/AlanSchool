import { View } from "react-big-calendar";
import prisma from "@/lib/prisma";
import BigCalendar from "./BigCalendar";
import { projectLessonToWeek, schoolTodayLessonDay, schoolWeekMonday, weekStartString } from "@/lib/schoolTime";

const BigCalendarContainer = async ({
  type,
  id,
  todayOnly = false,
  defaultView,
}: {
  type: "teacherId" | "classId" | "parentId";
  id: string | number;
  todayOnly?: boolean;
  defaultView?: View;
}) => {
  // "Today" is the school's today, not the server's (UTC) - otherwise the
  // first hours of every school morning would still count as yesterday.
  const todayLessonDay = schoolTodayLessonDay();
  const dayFilter = todayOnly && todayLessonDay ? { day: todayLessonDay } : {};

  const whereClause =
    type === "teacherId"
      ? { teacherId: id as string, ...dayFilter }
      : type === "classId"
      ? { classId: id as number, ...dayFilter }
      : {
          class: {
            students: {
              some: {
                parentId: id as string,
              },
            },
          },
          ...dayFilter,
        };

  const dataRes = await prisma.lesson.findMany({
    where: whereClause,
    orderBy: { startTime: "asc" },
  });

  // Lesson times are recurring: only the school time of day is meaningful and
  // the weekday lives in `day`. Project each onto this school week and hand the
  // browser plain wall-clock strings (not Dates) so it draws exactly what the
  // school clock reads, whatever zone the server or the viewer is in.
  const monday = schoolWeekMonday();
  const schedule = dataRes.map((lesson) => ({
    title: lesson.name,
    ...projectLessonToWeek(lesson, monday),
  }));

  return (
    <div className="">
      <BigCalendar data={schedule} weekStart={weekStartString(monday)} defaultView={defaultView} />
    </div>
  );
};

export default BigCalendarContainer;