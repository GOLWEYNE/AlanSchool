import Announcements from "@/components/Announcements";
import FeaturedVideoPlayer from "@/components/FeaturedVideoPlayer";
import BirthdayAnnouncements from "@/components/BirthdayAnnouncements";
import TodaysTimetableStrip from "@/components/TodaysTimetableStrip";
import WeekAtAGlance from "@/components/WeekAtAGlance";
import AttendancePulse from "@/components/AttendancePulse";
import ClassLeaderboard from "@/components/ClassLeaderboard";
import BigCalendarContainer from "@/components/BigCalendarContainer";
import EventCalendar from "@/components/EventCalendar";
import ReportCardsPanel from "@/components/ReportCardsPanel";
import TeacherWebcamPreview from "@/components/TeacherWebcamPreview";
import ProtectedRoute from "@/components/ProtectedRoute";
import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";

const StudentPage = async () => {
  const { userId } = auth();

  const classItem = await prisma.class.findFirst({
    where: {
      students: { some: { id: userId! } },
    },
  });

  const classId = classItem?.id;
  const now = new Date();

  const [assignmentsDue, upcomingExams, publishedResults] = classId
    ? await prisma.$transaction([
        prisma.assignment.count({
          where: { lesson: { classId }, dueDate: { gte: now } },
        }),
        prisma.exam.count({
          where: { lesson: { classId }, startTime: { gte: now } },
        }),
        prisma.result.count({ where: { studentId: userId! } }),
      ])
    : [0, 0, 0];

  return (
    <ProtectedRoute allowedRoles={["student"]}>
    <div className="p-4 flex gap-4 flex-col xl:flex-row">
      {/* LEFT */}
      <div className="w-full xl:w-2/3 flex flex-col gap-4">
        {/* HEADER CARD */}
        <div className="rounded-2xl p-6 text-white shadow-lg shine-hover bg-gradient-to-r from-yellow-400 via-blue-500 to-blue-400">
          <h1 className="text-3xl font-bold mb-2">Learning Cockpit</h1>
          <p className="text-blue-50">Stay focused with your classes, tasks, and progress checkpoints.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-white/90 text-blue-900 px-3 py-1 text-xs font-semibold">Class: {classItem?.name || "Unassigned"}</span>
            <span className="rounded-full bg-white/90 text-blue-900 px-3 py-1 text-xs font-semibold">Due Assignments: {assignmentsDue}</span>
            <span className="rounded-full bg-white/90 text-blue-900 px-3 py-1 text-xs font-semibold">Upcoming Exams: {upcomingExams}</span>
            <span className="rounded-full bg-white/90 text-blue-900 px-3 py-1 text-xs font-semibold">Results: {publishedResults}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Link href="/dashboard/list/assignments" className="panel-card p-3 text-blue-900 font-semibold text-sm text-center shine-hover">Assignments</Link>
          <Link href="/dashboard/list/exams" className="panel-card p-3 text-blue-900 font-semibold text-sm text-center shine-hover">Exams</Link>
          <Link href="/dashboard/list/results" className="panel-card p-3 text-blue-900 font-semibold text-sm text-center shine-hover">Results</Link>
          <Link href="/dashboard/list/events" className="panel-card p-3 text-blue-900 font-semibold text-sm text-center shine-hover">Events</Link>
          <Link href="/dashboard/list/messages" className="panel-card p-3 text-blue-900 font-semibold text-sm text-center shine-hover">Messages</Link>
        </div>

        {/* CALENDAR CARD */}
        <div className="w-full panel-card p-6 rounded-lg shadow-md border-t-4 border-blue-400 hover:shadow-lg transition-shadow">
          <div className="mb-4 flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <h2 className="text-xl font-semibold text-gray-800">Today&apos;s Classes</h2>
          </div>
          {classId ? (
            <div className="bg-gradient-to-b from-blue-50 to-white rounded-lg overflow-hidden">
              <BigCalendarContainer type="classId" id={classId} />
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📭</div>
              <p className="text-gray-500 text-lg">No class is assigned yet.</p>
              <p className="text-gray-400 text-sm mt-2">Contact your administrator</p>
            </div>
          )}
        </div>

        {/* FEATURED VIDEO BROADCAST */}
        <FeaturedVideoPlayer />
      </div>

      {/* RIGHT */}
      <div className="w-full xl:w-1/3 flex flex-col gap-4">
        <TeacherWebcamPreview />
        <BirthdayAnnouncements />
        <TodaysTimetableStrip role="student" classIds={classId ? [classId] : []} />
        <WeekAtAGlance role="student" classIds={classId ? [classId] : []} />
        <AttendancePulse role="student" studentIds={userId ? [userId] : []} />
        <ClassLeaderboard role="student" studentIds={userId ? [userId] : []} />
        {userId && <ReportCardsPanel studentId={userId} />}
        {/* EVENTS CARD */}
        <div className="bg-gradient-to-r from-yellow-400 to-yellow-300 rounded-lg p-4 shadow-md">
          <div className="flex items-center gap-2 mb-3">
            <div className="text-2xl">🗓️</div>
            <h3 className="text-lg font-bold text-gray-800">Events</h3>
          </div>
          <div className="bg-white rounded-lg overflow-hidden">
            <EventCalendar />
          </div>
        </div>

        {/* ANNOUNCEMENTS CARD */}
        <div className="bg-gradient-to-r from-blue-400 to-blue-300 rounded-lg p-4 shadow-md">
          <div className="flex items-center gap-2 mb-3">
            <div className="text-2xl">📢</div>
            <h3 className="text-lg font-bold text-white">Announcements</h3>
          </div>
          <div className="bg-white rounded-lg overflow-hidden">
            <Announcements />
          </div>
        </div>
      </div>
    </div>
    </ProtectedRoute>
  );
};

export default StudentPage;
