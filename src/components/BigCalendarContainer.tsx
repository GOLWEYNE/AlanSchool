import { View } from "react-big-calendar";
import prisma from "@/lib/prisma";
import BigCalendar from "./BigCalendar";
import { adjustScheduleToCurrentWeek } from "@/lib/utils";
import { Day } from "@/generated/prisma/client";

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
  const today = new Date();
  const dayMap: Record<number, Day | null> = {
    0: null,
    1: Day.MONDAY,
    2: Day.TUESDAY,
    3: Day.WEDNESDAY,
    4: Day.THURSDAY,
    5: Day.FRIDAY,
    6: null,
  };
  const todayLessonDay = dayMap[today.getDay()];
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

  const data = dataRes.map((lesson) => ({
    title: lesson.name,
    start: lesson.startTime,
    end: lesson.endTime,
  }));

  const schedule = adjustScheduleToCurrentWeek(data);

  return (
    <div className="">
      <BigCalendar data={schedule} defaultView={defaultView} />
    </div>
  );
};

export default BigCalendarContainer;