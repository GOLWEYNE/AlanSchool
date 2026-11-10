import Announcements from "@/components/Announcements";
import FeaturedVideoPlayer from "@/components/FeaturedVideoPlayer";
import BirthdayAnnouncements from "@/components/BirthdayAnnouncements";
import TodaysTimetableStrip from "@/components/TodaysTimetableStrip";
import WeekAtAGlance from "@/components/WeekAtAGlance";
import AttendancePulse from "@/components/AttendancePulse";
import ClassLeaderboard from "@/components/ClassLeaderboard";
import BigCalendarContainer from "@/components/BigCalendarContainer";
import TeacherWebcamPreview from "@/components/TeacherWebcamPreview";
import ProtectedRoute from "@/components/ProtectedRoute";
import ScheduleDownloadLink from "@/components/ScheduleDownloadLink";
import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { getTranslations } from "next-intl/server";
import { BookOpen, ClipboardList, FileText, MessageSquare, Trophy, CalendarDays } from "lucide-react";
import { HomeHero, HomeSection, HomeShortcuts, HomeStats, Rise } from "@/components/dashboard/HomeBlocks";

const TeacherPage = async () => {
  const t = await getTranslations("Dashboards.teacher");
  const tr = await getTranslations("Roles");
  const { userId } = auth();

  const [lessonsCount, assignmentsCount, examsCount, resultsCount] =
    await prisma.$transaction([
      prisma.lesson.count({ where: { teacherId: userId! } }),
      prisma.assignment.count({ where: { lesson: { teacherId: userId! } } }),
      prisma.exam.count({ where: { lesson: { teacherId: userId! } } }),
      prisma.result.count({
        where: {
          OR: [
            { exam: { lesson: { teacherId: userId! } } },
            { assignment: { lesson: { teacherId: userId! } } },
          ],
        },
      }),
    ]);

  return (
    <ProtectedRoute allowedRoles={["teacher"]}>
      <div className="flex-1 p-4 flex flex-col gap-4">
        <HomeHero eyebrow={tr("teacher")} title={t("title")} subtitle={t("subtitle")} />

        <HomeStats
          stats={[
            { label: t("lessons"), value: lessonsCount, Icon: BookOpen },
            { label: t("assignments"), value: assignmentsCount, Icon: ClipboardList, tone: "gold" },
            { label: t("exams"), value: examsCount, Icon: FileText },
            { label: t("results"), value: resultsCount, Icon: Trophy, tone: "gold" },
          ]}
        />

        <HomeShortcuts
          items={[
            { href: "/dashboard/list/lessons", label: t("myLessons"), Icon: BookOpen },
            { href: "/dashboard/list/assignments", label: t("assignments"), Icon: ClipboardList, tone: "gold" },
            { href: "/dashboard/list/exams", label: t("exams"), Icon: FileText },
            { href: "/dashboard/list/results", label: t("results"), Icon: Trophy, tone: "gold" },
            { href: "/dashboard/list/messages", label: t("messages"), Icon: MessageSquare },
          ]}
        />

        {/* SCHEDULE - full page width so the whole week is easy to read at a glance.
            The camera preview lives here, next to the lessons it's actually for. */}
        <HomeSection
          title={t("schedule")}
          Icon={CalendarDays}
          i={10}
          className="min-h-[640px] flex flex-col"
          action={<ScheduleDownloadLink />}
        >
          <div className="flex-1 flex flex-col lg:flex-row gap-4">
            <div className="w-full lg:w-2/3 flex-1 min-h-[420px] lg:min-h-0">
              <BigCalendarContainer type="teacherId" id={userId!} />
            </div>
            <div className="w-full lg:w-1/3">
              <TeacherWebcamPreview />
            </div>
          </div>
        </HomeSection>

        <div className="flex gap-4 flex-col xl:flex-row">
          {/* LEFT */}
          <div className="w-full xl:w-2/3">
            <Rise i={11}>
              <FeaturedVideoPlayer />
            </Rise>
          </div>
          {/* RIGHT */}
          <div className="w-full xl:w-1/3 flex flex-col gap-4">
            <Rise i={12}><BirthdayAnnouncements /></Rise>
            <Rise i={13}><TodaysTimetableStrip role="teacher" teacherId={userId!} /></Rise>
            <Rise i={14}><WeekAtAGlance role="teacher" teacherId={userId!} /></Rise>
            <Rise i={15}><AttendancePulse role="teacher" teacherId={userId!} /></Rise>
            <Rise i={16}><ClassLeaderboard role="teacher" teacherId={userId!} /></Rise>
            <Rise i={17}><Announcements /></Rise>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default TeacherPage;
