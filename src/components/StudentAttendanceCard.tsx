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
  const percentage = (presentDays / totalDays) * 100;
  return (
    <div className="">
      <h1 className="text-xl font-semibold">{percentage || "-"}%</h1>
      <span className="text-sm text-gray-400">{t("attendance")}</span>
    </div>
  );
};

export default StudentAttendanceCard;