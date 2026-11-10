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
import { getTranslations } from "next-intl/server";
import { CalendarDays, ClipboardList, FileText, MessageSquare, NotebookPen, School, Trophy } from "lucide-react";
import { HomeHero, HomeSection, HomeShortcuts, HomeStats, Rise } from "@/components/dashboard/HomeBlocks";

const StudentPage = async () => {
  const t = await getTranslations("Dashboards.student");
  const tr = await getTranslations("Roles");
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
        <HomeHero eyebrow={tr("student")} title={t("title")} subtitle={t("subtitle")} />

        <HomeStats
          stats={[
            { label: t("classLabel"), value: classItem?.name || t("unassigned"), Icon: School },
            { label: t("dueAssignments"), value: assignmentsDue, Icon: ClipboardList, tone: "gold" },
            { label: t("upcomingExams"), value: upcomingExams, Icon: FileText },
            { label: t("results"), value: publishedResults, Icon: Trophy, tone: "gold" },
          ]}
        />

        <HomeShortcuts
          items={[
            { href: "/dashboard/list/assignments", label: t("assignments"), Icon: ClipboardList },
            { href: "/dashboard/list/exams", label: t("exams"), Icon: FileText, tone: "gold" },
            { href: "/dashboard/list/results", label: t("results"), Icon: Trophy },
            { href: "/dashboard/list/events", label: t("events"), Icon: CalendarDays, tone: "gold" },
            { href: "/dashboard/list/messages", label: t("messages"), Icon: MessageSquare },
            { href: "/dashboard/list/study-planner", label: t("studyPlanner"), Icon: NotebookPen, tone: "gold" },
          ]}
        />

        {/* CALENDAR - full page width so the whole week is easy to read at a glance */}
        <HomeSection
          title={t("todaysClasses")}
          Icon={CalendarDays}
          i={11}
          className="min-h-[640px] flex flex-col"
        >
          {classId ? (
            <div className="flex-1 min-h-[420px]">
              <BigCalendarContainer type="classId" id={classId} />
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📭</div>
              <p className="text-blue-900 dark:text-blue-100 text-lg">{t("noClass")}</p>
              <p className="text-blue-700/70 dark:text-blue-200/70 text-sm mt-2">{t("contactAdmin")}</p>
            </div>
          )}
        </HomeSection>

        <div className="flex gap-4 flex-col xl:flex-row">
          {/* LEFT */}
          <div className="w-full xl:w-2/3 flex flex-col gap-4">
            <Rise i={12}>
              <FeaturedVideoPlayer />
            </Rise>
          </div>

          {/* RIGHT */}
          <div className="w-full xl:w-1/3 flex flex-col gap-4">
            <Rise i={13}><BirthdayAnnouncements /></Rise>
            <Rise i={14}><TodaysTimetableStrip role="student" classIds={classId ? [classId] : []} /></Rise>
            <Rise i={15}><WeekAtAGlance role="student" classIds={classId ? [classId] : []} /></Rise>
            <Rise i={16}><AttendancePulse role="student" studentIds={userId ? [userId] : []} /></Rise>
            <Rise i={17}><ClassLeaderboard role="student" studentIds={userId ? [userId] : []} /></Rise>
            <Rise i={18}>{userId && <ReportCardsPanel studentId={userId} />}</Rise>
            <Rise i={19}><ReportCardBehaviorTimeline logs={behaviorLogs} /></Rise>
            <HomeSection title={t("eventsCard")} Icon={CalendarDays} i={20}>
              <EventCalendar />
            </HomeSection>
            <Rise i={21}><Announcements /></Rise>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default StudentPage;
