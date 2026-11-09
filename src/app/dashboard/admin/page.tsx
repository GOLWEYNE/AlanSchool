import Announcements from "@/components/Announcements";
import FeaturedVideoPlayer from "@/components/FeaturedVideoPlayer";
import BirthdayAnnouncements from "@/components/BirthdayAnnouncements";
import TodaysTimetableStrip from "@/components/TodaysTimetableStrip";
import WeekAtAGlance from "@/components/WeekAtAGlance";
import AttendancePulse from "@/components/AttendancePulse";
import ClassLeaderboard from "@/components/ClassLeaderboard";
import AttendanceChartContainer from "@/components/AttendanceChartContainer";
import CountChartContainer from "@/components/CountChartContainer";
import EventCalendarContainer from "@/components/EventCalendarContainer";
import ClubActivity from "@/components/ClubActivity";
import SchoolPulseBanner from "@/components/SchoolPulseBanner";
import AdminStatTiles from "@/components/dashboard/AdminStatTiles";
import ProtectedRoute from "@/components/ProtectedRoute";
import { getUserRole } from "@/lib/auth";
import { ensureAdminRecord } from "@/lib/actions";
import { auth } from "@clerk/nextjs/server";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ArrowUpRight, BarChart3, LayoutGrid, Users } from "lucide-react";

// Wraps an existing widget so the glass theme (see globals.css, ".glass-dash")
// can restyle it and stagger its entrance without touching the widget itself.
// `empty:hidden` drops the wrapper when a widget renders nothing.
const Slot = ({
  i,
  tone = "navy",
  fill = false,
  children,
}: {
  i: number;
  tone?: "navy" | "sky" | "gold" | "plain";
  fill?: boolean;
  children: React.ReactNode;
}) => (
  <div
    style={{ ["--i" as string]: i }}
    className={`glass-rise glass-widget glass-widget--${tone} empty:hidden ${fill ? "h-full" : ""}`}
  >
    {children}
  </div>
);

const AdminPage = async ({
  searchParams,
}: {
  searchParams: { [keys: string]: string | undefined };
}) => {
  const { sessionClaims } = auth();
  const role = getUserRole(sessionClaims);
  const t = await getTranslations("AdminPage");

  // Backfills this admin's own Admin row the first time they're seen
  // without one (see ensureAdminRecord's comment) - keeps the "Admin"
  // count card below accurate without any manual DB step.
  if (role === "admin") {
    await ensureAdminRecord();
  }

  const quickActions = [
    { href: "/dashboard/list/classes", eyebrow: t("operations"), title: t("classManagement"), desc: t("classManagementDesc"), Icon: LayoutGrid },
    { href: "/dashboard/list/teachers", eyebrow: t("people"), title: t("teacherDirectory"), desc: t("teacherDirectoryDesc"), Icon: Users },
    { href: "/dashboard/list/results", eyebrow: t("performance"), title: t("academicResults"), desc: t("academicResultsDesc"), Icon: BarChart3 },
  ];

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <div className="glass-dash relative isolate">
        {/* Soft brand-coloured aurora behind the glass (blue + yellow only). */}
        <div aria-hidden className="glass-aurora">
          <span className="glass-aurora__blob glass-aurora__blob--blue" />
          <span className="glass-aurora__blob glass-aurora__blob--gold" />
          <span className="glass-aurora__blob glass-aurora__blob--sky" />
        </div>

        <div className="relative p-4 flex flex-col gap-5">
          {/* PRINCIPAL'S SCHOOL PULSE BANNER */}
          <div style={{ ["--i" as string]: 0 }} className="glass-rise glass-hero">
            <SchoolPulseBanner searchParams={searchParams} />
          </div>

          <div className="flex gap-5 flex-col lg:flex-row">
            {/* LEFT */}
            <div className="w-full lg:w-2/3 flex flex-col gap-5 min-w-0">
              {/* COMMAND CENTER */}
              <div style={{ ["--i" as string]: 1 }} className="glass-rise glass glass-command p-5 md:p-6">
                <div className="relative flex flex-col gap-1">
                  <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-blue-950 dark:text-blue-50">
                    {t("title")}
                  </h2>
                  <p className="text-sm text-blue-800/80 dark:text-blue-200/80">{t("subtitle")}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="glass-chip glass-chip--gold">{t("roleAdmin")}</span>
                    <span className="glass-chip">{t("accessFull")}</span>
                    <span className="glass-chip">{t("workspace")}</span>
                  </div>
                </div>

                <div className="relative mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
                  {quickActions.map(({ href, eyebrow, title, desc, Icon }) => (
                    <Link key={href} href={href} className="glass-action group">
                      <span className="glass-icon glass-icon--blue">
                        <Icon size={18} strokeWidth={2.2} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-yellow-300">
                          {eyebrow}
                        </span>
                        <span className="block text-sm font-bold text-blue-950 dark:text-blue-50">{title}</span>
                        <span className="block text-xs leading-snug text-blue-800/75 dark:text-blue-200/70 mt-0.5">
                          {desc}
                        </span>
                      </span>
                      <ArrowUpRight
                        size={16}
                        className="shrink-0 text-blue-600 dark:text-yellow-300 transition duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                      />
                    </Link>
                  ))}
                </div>
              </div>

              {/* HEADLINE NUMBERS */}
              <AdminStatTiles />

              {/* MIDDLE CHARTS */}
              <div className="flex gap-5 flex-col lg:flex-row">
                {/* COUNT CHART */}
                <div className="w-full lg:w-1/3 h-[450px]">
                  <Slot i={6} tone="plain" fill>
                    <CountChartContainer />
                  </Slot>
                </div>
                {/* ATTENDANCE CHART */}
                <div className="w-full lg:w-2/3 h-[450px]">
                  <Slot i={7} tone="plain" fill>
                    <AttendanceChartContainer />
                  </Slot>
                </div>
              </div>

              {/* CLUB ACTIVITY */}
              <Slot i={8} tone="plain">
                <ClubActivity />
              </Slot>

              {/* FEATURED VIDEO BROADCAST */}
              <Slot i={9} tone="plain">
                <FeaturedVideoPlayer />
              </Slot>
            </div>

            {/* RIGHT */}
            <div className="w-full lg:w-1/3 flex flex-col gap-5 min-w-0">
              <Slot i={2} tone="gold">
                <BirthdayAnnouncements />
              </Slot>
              <Slot i={3} tone="navy">
                <TodaysTimetableStrip role="admin" />
              </Slot>
              <Slot i={4} tone="gold">
                <WeekAtAGlance role="admin" />
              </Slot>
              <Slot i={5} tone="sky">
                <AttendancePulse role="admin" />
              </Slot>
              <Slot i={6} tone="navy">
                <ClassLeaderboard role="admin" />
              </Slot>
              <Slot i={7} tone="plain">
                <EventCalendarContainer searchParams={searchParams} />
              </Slot>
              <Slot i={8} tone="plain">
                <Announcements />
              </Slot>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default AdminPage;
