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
import ReportCardBehaviorTimeline from "@/components/reportCard/ReportCardBehaviorTimeline";
import ProtectedRoute from "@/components/ProtectedRoute";
import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

const StudentPage = async () => {
  const t = await getTranslations("Dashboards.student");
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

  // Merit/incident notes a teacher marked visible to the student
  // themselves, same BehaviorLog rows a parent sees on their side.
  const behaviorLogs = userId
    ? await prisma.behaviorLog.findMany({
        where: { studentId: userId, visibleToParent: true },
        orderBy: { date: "desc" },
        select: { id: true, type: true, title: true, description: true, date: true },
      })
    : [];

  return (
    <ProtectedRoute allowedRoles={["student"]}>
    <div className="p-4 flex flex-col gap-4">
      {/* HEADER CARD */}
      <div className="rounded-2xl p-6 text-white shadow-lg shine-hover bg-gradient-to-r from-yellow-400 via-blue-500 to-blue-400">
        <h1 className="text-3xl font-bold mb-2">{t("title")}</h1>
        <p className="text-blue-50">{t("subtitle")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-white/90 text-blue-900 px-3 py-1 text-xs font-semibold">{t("classLabel")}: {classItem?.name || t("unassigned")}</span>
          <span className="rounded-full bg-white/90 text-blue-900 px-3 py-1 text-xs font-semibold">{t("dueAssignments")}: {assignmentsDue}</span>
          <span className="rounded-full bg-white/90 text-blue-900 px-3 py-1 text-xs font-semibold">{t("upcomingExams")}: {upcomingExams}</span>
          <span className="rounded-full bg-white/90 text-blue-900 px-3 py-1 text-xs font-semibold">{t("results")}: {publishedResults}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Link href="/dashboard/list/assignments" className="panel-card p-3 text-blue-900 font-semibold text-sm text-center shine-hover">{t("assignments")}</Link>
        <Link href="/dashboard/list/exams" className="panel-card p-3 text-blue-900 font-semibold text-sm text-center shine-hover">{t("exams")}</Link>
        <Link href="/dashboard/list/results" className="panel-card p-3 text-blue-900 font-semibold text-sm text-center shine-hover">{t("results")}</Link>
        <Link href="/dashboard/list/events" className="panel-card p-3 text-blue-900 font-semibold text-sm text-center shine-hover">{t("events")}</Link>
        <Link href="/dashboard/list/messages" className="panel-card p-3 text-blue-900 font-semibold text-sm text-center shine-hover">{t("messages")}</Link>
        <Link href="/dashboard/list/study-planner" className="panel-card p-3 text-blue-900 font-semibold text-sm text-center shine-hover">{t("studyPlanner")}</Link>
      </div>

      {/* CALENDAR CARD - full page width so the whole week is easy to read at a glance */}
      <div className="w-full panel-card p-6 rounded-lg shadow-md border-t-4 border-blue-400 hover:shadow-lg transition-shadow min-h-[640px] flex flex-col">
        <div className="mb-4 flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-blue-100">{t("todaysClasses")}</h2>
        </div>
        {classId ? (
          <div className="flex-1 bg-gradient-to-b from-blue-50 to-white dark:from-slate-900 dark:to-slate-950 rounded-lg overflow-hidden">
            <BigCalendarContainer type="classId" id={classId} />
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-gray-500 text-lg">{t("noClass")}</p>
            <p className="text-gray-400 text-sm mt-2">{t("contactAdmin")}</p>
          </div>
        )}
      </div>

      <div className="flex gap-4 flex-col xl:flex-row">
        {/* LEFT */}
        <div className="w-full xl:w-2/3 flex flex-col gap-4">
          {/* FEATURED VIDEO BROADCAST */}
          <FeaturedVideoPlayer />
        </div>

        {/* RIGHT */}
        <div className="w-full xl:w-1/3 flex flex-col gap-4">
          <BirthdayAnnouncements />
          <TodaysTimetableStrip role="student" classIds={classId ? [classId] : []} />
          <WeekAtAGlance role="student" classIds={classId ? [classId] : []} />
          <AttendancePulse role="student" studentIds={userId ? [userId] : []} />
          <ClassLeaderboard role="student" studentIds={userId ? [userId] : []} />
          {userId && <ReportCardsPanel studentId={userId} />}
          <ReportCardBehaviorTimeline logs={behaviorLogs} />
          {/* EVENTS CARD */}
          <div className="bg-gradient-to-r from-yellow-400 to-yellow-300 rounded-lg p-4 shadow-md">
            <div className="flex items-center gap-2 mb-3">
              <div className="text-2xl">🗓️</div>
              <h3 className="text-lg font-bold text-gray-800">{t("eventsCard")}</h3>
            </div>
            <div className="bg-white rounded-lg overflow-hidden">
              <EventCalendar />
            </div>
          </div>

          {/* ANNOUNCEMENTS CARD */}
          <div className="bg-gradient-to-r from-blue-400 to-blue-300 rounded-lg p-4 shadow-md">
            <div className="flex items-center gap-2 mb-3">
              <div className="text-2xl">📢</div>
              <h3 className="text-lg font-bold text-white">{t("announcementsCard")}</h3>
            </div>
            <div className="bg-white rounded-lg overflow-hidden">
              <Announcements />
            </div>
          </div>
        </div>
      </div>
    </div>
    </ProtectedRoute>
  );
};

export default StudentPage;
