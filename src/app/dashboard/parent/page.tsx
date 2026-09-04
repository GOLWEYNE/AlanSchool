import Announcements from "@/components/Announcements";
import FeaturedVideoPlayer from "@/components/FeaturedVideoPlayer";
import BirthdayAnnouncements from "@/components/BirthdayAnnouncements";
import TodaysTimetableStrip from "@/components/TodaysTimetableStrip";
import WeekAtAGlance from "@/components/WeekAtAGlance";
import AttendancePulse from "@/components/AttendancePulse";
import ClassLeaderboard from "@/components/ClassLeaderboard";
import BigCalendarContainer from "@/components/BigCalendarContainer";
import ParentChildAttendanceCard from "@/components/ParentChildAttendanceCard";
import ReportCardsPanel from "@/components/ReportCardsPanel";
import TeacherWebcamPreview from "@/components/TeacherWebcamPreview";
import ProtectedRoute from "@/components/ProtectedRoute";
import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";

const Parentpage = async () => {
  const { userId } = auth();

  const children = await prisma.student.findMany({
    where: { parentId: userId! },
    include: {
      class: true,
      attendances: true,
    },
  });

  const today = new Date();
  const startOfToday = new Date(today);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(today);
  endOfToday.setHours(23, 59, 59, 999);

  const studentIds = children.map((child) => child.id);
  const childClassIds = Array.from(new Set(children.map((child) => child.classId)));

  const todayAttendance = await prisma.attendance.findMany({
    where: {
      studentId: { in: studentIds },
      date: {
        gte: startOfToday,
        lt: endOfToday,
      },
    },
  });

  const childAttendanceSummaries = children.map((child) => {
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

  const upcomingExamsCount = await prisma.exam.count({
    where: {
      lesson: {
        class: {
          students: {
            some: { parentId: userId! },
          },
        },
      },
      startTime: { gte: today },
    },
  });

  const resultsCount = await prisma.result.count({
    where: {
      student: { parentId: userId! },
    },
  });

  const eventsCount = await prisma.event.count({
    where: {
      OR: [
        { classId: null },
        {
          class: {
            students: {
              some: { parentId: userId! },
            },
          },
        },
      ],
    },
  });

  return (
    <ProtectedRoute allowedRoles={["parent"]}>
    <div className="flex-1 p-4 flex gap-4 flex-col xl:flex-row">
      {/* LEFT */}
      <div className="w-full xl:w-2/3">
        <div className="rounded-2xl p-5 mb-4 shine-hover text-white shadow-xl bg-gradient-to-r from-teal-500 via-blue-500 to-yellow-400">
          <h1 className="text-3xl font-bold">Family Overview</h1>
          <p className="text-cyan-50 mt-2 text-sm">Stay connected with your children&apos;s schedule, attendance, and progress.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-white/90 text-blue-900 px-3 py-1 text-xs font-semibold">Children: {children.length}</span>
            <span className="rounded-full bg-white/90 text-blue-900 px-3 py-1 text-xs font-semibold">Upcoming Exams: {upcomingExamsCount}</span>
            <span className="rounded-full bg-white/90 text-blue-900 px-3 py-1 text-xs font-semibold">Results: {resultsCount}</span>
            <span className="rounded-full bg-white/90 text-blue-900 px-3 py-1 text-xs font-semibold">Events: {eventsCount}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Link href="/dashboard/list/events" className="panel-card p-3 text-blue-900 font-semibold text-sm text-center shine-hover">Events</Link>
          <Link href="/dashboard/list/exams" className="panel-card p-3 text-blue-900 font-semibold text-sm text-center shine-hover">Exams</Link>
          <Link href="/dashboard/list/results" className="panel-card p-3 text-blue-900 font-semibold text-sm text-center shine-hover">Results</Link>
          <Link href="/dashboard/list/parents" className="panel-card p-3 text-blue-900 font-semibold text-sm text-center shine-hover">Parent Profile</Link>
        </div>

        <div className="h-full panel-card p-4 rounded-md">
          <h1 className="text-xl font-semibold text-blue-900">Today&apos;s Schedule</h1>
          <BigCalendarContainer
            type="parentId"
            id={userId!}
            todayOnly
            defaultView="day"
          />
        </div>

        {/* FEATURED VIDEO BROADCAST */}
        <div className="mt-4">
          <FeaturedVideoPlayer />
        </div>
      </div>

      {/* RIGHT */}
      <div className="w-full xl:w-1/3 flex flex-col gap-8">
        <TeacherWebcamPreview />
        <BirthdayAnnouncements />
        <TodaysTimetableStrip role="parent" classIds={childClassIds} />
        <WeekAtAGlance role="parent" classIds={childClassIds} />
        <AttendancePulse role="parent" studentIds={studentIds} />
        <ClassLeaderboard role="parent" studentIds={studentIds} />
        <div className="panel-card p-4 rounded-md">
          <h1 className="text-xl font-semibold text-blue-900">Children&apos;s Attendance</h1>
          <div className="mt-4 grid gap-4">
            {childAttendanceSummaries.map((summary) => (
              <ParentChildAttendanceCard
                key={summary.id}
                studentName={summary.studentName}
                className={summary.className}
                todayPresent={summary.todayPresent}
                todayTotal={summary.todayTotal}
                overallPercent={summary.overallPercent}
              />
            ))}
            {childAttendanceSummaries.length === 0 && (
              <p className="text-sm text-gray-500">
                No children assigned to this parent.
              </p>
            )}
          </div>
        </div>
        {children.map((child) => (
          <ReportCardsPanel
            key={child.id}
            studentId={child.id}
            studentName={`${child.name} ${child.surname}`}
          />
        ))}
        <Announcements />
      </div>
    </div>
    </ProtectedRoute>
  );
};

export default Parentpage;
