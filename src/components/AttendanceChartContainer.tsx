import Image from "next/image";
import AttendanceChart from "./AttendanceChart";
import prisma from "@/lib/prisma";

const AttendanceChartContainer = async () => {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const lastMonday = new Date(today);

  lastMonday.setDate(today.getDate() - daysSinceMonday);

  const resData = await prisma.attendance.findMany({
    where: {
      date: {
        gte: lastMonday,
      },
    },
    select: {
      date: true,
      present: true,
    },
  });

  const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri"];

  const attendanceMap: { [key: string]: { present: number; absent: number } } =
    {
      Mon: { present: 0, absent: 0 },
      Tue: { present: 0, absent: 0 },
      Wed: { present: 0, absent: 0 },
      Thu: { present: 0, absent: 0 },
      Fri: { present: 0, absent: 0 },
    };

  resData.forEach((item) => {
    const itemDate = new Date(item.date);
    const dayOfWeek = itemDate.getDay();

    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      const dayName = daysOfWeek[dayOfWeek - 1];

      if (item.present) {
        attendanceMap[dayName].present += 1;
      } else {
        attendanceMap[dayName].absent += 1;
      }
    }
  });

  const data = daysOfWeek.map((day) => ({
    name: day,
    present: attendanceMap[day].present,
    absent: attendanceMap[day].absent,
  }));

  const totalPresent = data.reduce((sum, d) => sum + d.present, 0);
  const totalAbsent = data.reduce((sum, d) => sum + d.absent, 0);
  const totalRecords = totalPresent + totalAbsent;
  const avgRate = totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : null;

  const busiestDay = data.reduce(
    (best, d) => ((d.present + d.absent) > (best.present + best.absent) ? d : best),
    data[0]
  );

  return (
    <div className="panel-card shine-hover relative overflow-hidden h-full p-5 flex flex-col">
      {/* HEADER */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <div className="circle-icon-btn !w-11 !h-11 shrink-0">
            <Image src="/attendance.png" alt="" width={20} height={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-blue-900 dark:text-blue-100">Weekly Attendance</h1>
            <p className="text-xs text-blue-500 dark:text-slate-400">Monday – Friday overview</p>
          </div>
        </div>
        {avgRate !== null && (
          <div className="toolbar-chip px-3 py-1.5 flex flex-col items-center leading-tight">
            <span className="text-sm font-extrabold">{avgRate}%</span>
            <span className="text-[10px] font-medium opacity-80 -mt-0.5">avg present</span>
          </div>
        )}
      </div>

      {/* CHART */}
      <div className="flex-1 min-h-0 mt-1">
        <AttendanceChart data={data} />
      </div>

      {/* FOOTER STATS */}
      <div className="flex items-center gap-3 pt-2 mt-1 border-t border-blue-50 dark:border-slate-800">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="w-2 h-2 rounded-full bg-blue-600" />
          <span className="text-gray-500 dark:text-slate-400">
            <span className="font-semibold text-blue-900 dark:text-blue-100">{totalPresent}</span> present
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-gray-500 dark:text-slate-400">
            <span className="font-semibold text-blue-900 dark:text-blue-100">{totalAbsent}</span> absent
          </span>
        </div>
        {totalRecords > 0 && (
          <span className="ml-auto text-[11px] text-gray-400 dark:text-slate-500">
            Busiest: <span className="font-medium text-blue-700 dark:text-blue-300">{busiestDay.name}</span>
          </span>
        )}
      </div>
    </div>
  );
};

export default AttendanceChartContainer;
