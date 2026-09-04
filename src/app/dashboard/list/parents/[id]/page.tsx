import Announcements from "@/components/Announcements";
import BigCalendarContainer from "@/components/BigCalendarContainer";
import ParentChildAttendanceCard from "@/components/ParentChildAttendanceCard";
import prisma from "@/lib/prisma";
import { getUserRole } from "@/lib/auth";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

const SingleParentPage = async ({
  params: { id },
}: {
  params: { id: string };
}) => {
  const { userId, sessionClaims } = auth();
  const role = getUserRole(sessionClaims);

  if (role === "parent" && userId !== id) {
    redirect(`/dashboard/list/parents/${userId}`);
  }

  const parent = await prisma.parent.findUnique({
    where: { id },
    include: {
      students: {
        include: {
          class: true,
          attendances: true,
        },
      },
    },
  });

  if (!parent) {
    return notFound();
  }

  const today = new Date();
  const startOfToday = new Date(today);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(today);
  endOfToday.setHours(23, 59, 59, 999);

  const studentIds = parent.students.map((student) => student.id);

  const todayAttendance = await prisma.attendance.findMany({
    where: {
      studentId: { in: studentIds },
      date: {
        gte: startOfToday,
        lt: endOfToday,
      },
    },
  });

  const childAttendanceSummaries = parent.students.map((child) => {
    const allAttendance = child.attendances;
    const presentCount = allAttendance.filter((item) => item.present).length;
    const totalCount = allAttendance.length;
    const overallPercent = totalCount > 0 ? (presentCount / totalCount) * 100 : 0;

    const todayCount = todayAttendance.filter(
      (item) => item.studentId === child.id
    ).length;
    const todayPresent = todayAttendance.filter(
      (item) => item.studentId === child.id && item.present
    ).length;

    return {
      id: child.id,
      studentName: `${child.name} ${child.surname}`,
      className: child.class.name,
      overallPercent,
      todayPresent,
      todayTotal: todayCount,
    };
  });

  return (
    <div className="flex-1 p-4 flex flex-col gap-4">
      <div className="flex gap-4 flex-col xl:flex-row">
        <div className="w-full xl:w-2/3">
          <div className="bg-white p-4 rounded-md">
            <h1 className="text-xl font-semibold">
              {parent.name} {parent.surname}
            </h1>
            <p className="text-sm text-gray-500 mt-1">{parent.email || "No email"}</p>
            <p className="text-sm text-gray-500">{parent.phone}</p>
            <p className="text-sm text-gray-500">{parent.address}</p>
            <div className="mt-4 flex gap-2 flex-wrap text-xs text-gray-600">
              <Link className="p-2 rounded-md bg-lamaSkyLight" href="/dashboard/list/exams">
                Children Exams
              </Link>
              <Link className="p-2 rounded-md bg-lamaPurpleLight" href="/dashboard/list/results">
                Children Results
              </Link>
              <Link className="p-2 rounded-md bg-lamaYellowLight" href="/dashboard/list/events">
                Children Events
              </Link>
            </div>
          </div>
        </div>
        <div className="w-full xl:w-1/3 flex flex-col gap-4">
          <div className="bg-white p-4 rounded-md">
            <h1 className="text-xl font-semibold">Children Attendance</h1>
            <div className="mt-4 grid gap-4">
              {childAttendanceSummaries.map((summary) => (
                <ParentChildAttendanceCard
                  key={summary.id}
                  studentName={summary.studentName}
                  className={summary.className}
                  overallPercent={summary.overallPercent}
                  todayPresent={summary.todayPresent}
                  todayTotal={summary.todayTotal}
                />
              ))}
            </div>
          </div>
          <Announcements />
        </div>
      </div>

      {/* SCHEDULE - full page width so the whole week is easy to read at a glance */}
      <div className="bg-white dark:bg-slate-900 rounded-md p-4 min-h-[700px] flex flex-col">
        <h1 className="text-xl font-semibold text-blue-900 dark:text-blue-100">Parent Schedule View</h1>
        <div className="flex-1 mt-2">
          <BigCalendarContainer type="parentId" id={parent.id} />
        </div>
      </div>
    </div>
  );
};

export default SingleParentPage;
