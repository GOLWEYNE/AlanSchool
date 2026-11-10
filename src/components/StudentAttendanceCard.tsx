import prisma from "@/lib/prisma";
import { getTranslations } from "next-intl/server";

const StudentAttendanceCard = async ({ id }: { id: string }) => {
  const t = await getTranslations("Widgets.childAttendance");
  const attendance = await prisma.attendance.findMany({
    where: {
      studentId: id,
      date: {
        gte: new Date(new Date().getFullYear(), 0, 1),
      },
    },
  });

  const totalDays = attendance.length;
  const presentDays = attendance.filter((day) => day.present).length;
  // Whole percent; "-" until the first attendance record exists.
  const percentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : null;
  return (
    <>
      <p className="text-2xl font-bold leading-none text-blue-900 dark:text-blue-100">
        {percentage === null ? "-" : `${percentage}%`}
      </p>
      <p className="mt-1 truncate text-xs font-medium text-slate-500 dark:text-slate-400">{t("attendance")}</p>
    </>
  );
};

export default StudentAttendanceCard;
