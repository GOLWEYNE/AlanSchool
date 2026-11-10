import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { getUserRole } from "@/lib/auth";
import MyCamera from "@/components/MyCamera";
import AnimatedNumber from "@/components/dashboard/AnimatedNumber";
import Link from "next/link";
import type { CSSProperties } from "react";
import { getFormatter, getTranslations } from "next-intl/server";
import {
  Award,
  BookOpen,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  FileText,
  GraduationCap,
  MessageSquare,
  TrendingUp,
  User,
  Users,
  Video,
} from "lucide-react";

const ParentDashboard = async ({ params }: { params: { id: string } }) => {
  const { userId, sessionClaims } = await auth();
  const role = getUserRole(sessionClaims);

  if (!userId || role !== "parent") {
    return notFound();
  }

  // Fetch parent and their students
  const parent = await prisma.parent.findUnique({
    where: { id: userId },
    include: {
      students: {
        include: {
          class: {
            include: {
              lessons: {
                include: {
                  teacher: true,
                  subject: true,
                },
                orderBy: {
                  startTime: "asc",
                },
              },
            },
          },
          grade: true,
          results: {
            include: {
              exam: {
                include: {
                  lesson: {
                    include: {
                      subject: true,
                    },
                  },
                },
              },
              assignment: {
                include: {
                  lesson: {
                    include: {
                      subject: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!parent) {
    return notFound();
  }

  const student = parent.students[0]; // Primary student view

  const t = await getTranslations("Profiles.home");
  const tp = await getTranslations("Profiles.parentHome");
  const tm = await getTranslations("Menu");
  const tc = await getTranslations("Common");
  const format = await getFormatter();

  // Entrance stagger: each block rises a beat after the one before it.
  const rise = (i: number) => ({ "--i": i }) as CSSProperties;

  const lessonCount = student?.class?.lessons?.length || 0;
  const resultCount = student?.results?.length || 0;
  const teacherCount = student
    ? new Set((student.class?.lessons ?? []).map((l) => l.teacher.id)).size
    : 0;
  const avgScore =
    student && student.results?.length > 0
      ? Math.round(student.results.reduce((a, b) => a + (b.score || 0), 0) / student.results.length)
      : 0;

  const stats = student
    ? [
        { Icon: BookOpen, value: lessonCount, suffix: "", label: t("totalLessons"), tone: "blue" },
        { Icon: CheckCircle2, value: resultCount, suffix: "", label: t("assessments"), tone: "gold" },
        { Icon: Users, value: teacherCount, suffix: "", label: tm("teachers"), tone: "blue" },
        { Icon: TrendingUp, value: avgScore, suffix: "%", label: tp("avgPerformance"), tone: "gold" },
      ]
    : [];

  return (
    <div className="flex-1 p-4 md:p-6 flex flex-col gap-4">
      {/* HERO */}
      <section className="glass-surface glass-feature glass-rise overflow-hidden" style={rise(0)}>
        <div className="glass-cover h-20" aria-hidden="true" />
        <div className="px-5 pb-5 sm:px-6">
          <div className="-mt-9 flex items-end gap-4">
            <span className="glass-icon glass-icon--gold !h-16 !w-16 !rounded-2xl shadow-lg">
              <GraduationCap className="h-8 w-8" aria-hidden="true" />
            </span>
            <div className="min-w-0 pb-1">
              <h1 className="truncate text-2xl font-bold text-blue-900 dark:text-blue-100 md:text-3xl">
                {t("welcome", { name: parent.name })}
              </h1>
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 md:text-base">{tp("subtitle")}</p>
        </div>
      </section>

      {/* CHILDREN */}
      {parent.students && parent.students.length > 0 && (
        <section className="glass-rise" style={rise(1)}>
          <h2 className="mb-3 flex items-center gap-3 text-lg font-bold text-blue-900 dark:text-blue-100">
            <span className="glass-icon glass-icon--blue !h-9 !w-9 !rounded-xl">
              <User className="h-4 w-4" aria-hidden="true" />
            </span>
            {tp("yourChildren")}
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {parent.students.map((std) => (
              <div
                key={std.id}
                className="group glass-surface glass-tile glass-lift flex items-center gap-3 p-4"
              >
                <span className="glass-icon glass-icon--gold">
                  <GraduationCap className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-bold text-blue-900 dark:text-blue-100">
                    {std.name} {std.surname}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t("gradeLevel", { level: std.grade.level })}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="glass-chip">
                      <BookOpen className="h-3 w-3" aria-hidden="true" />
                      {tp("lessonsCount", { count: std.class?.lessons?.length || 0 })}
                    </span>
                    <span className="glass-chip glass-chip--gold">
                      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                      {tp("assessmentsCount", { count: std.results?.length || 0 })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {student && (
        <>
          {/* QUICK STATS */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {stats.map(({ Icon, value, suffix, label, tone }, i) => (
              <div
                key={label}
                className="group glass-surface glass-tile glass-lift glass-rise flex items-center gap-3 p-4"
                style={rise(i + 2)}
              >
                <span className={`glass-icon ${tone === "gold" ? "glass-icon--gold" : "glass-icon--blue"}`}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-2xl font-bold leading-none text-blue-900 dark:text-blue-100">
                    <AnimatedNumber value={value} />
                    {suffix}
                  </p>
                  <p className="mt-1 truncate text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* SCHEDULE */}
          <section className="glass-surface glass-rise p-5" style={rise(6)}>
            <h2 className="mb-4 flex items-center gap-3 text-lg font-bold text-blue-900 dark:text-blue-100">
              <span className="glass-icon glass-icon--blue !h-9 !w-9 !rounded-xl">
                <Calendar className="h-4 w-4" aria-hidden="true" />
              </span>
              {tp("scheduleOf", { name: student.name })}
            </h2>
            {student.class?.lessons && student.class.lessons.length > 0 ? (
              <div className="grid gap-3">
                {student.class.lessons.slice(0, 6).map((lesson) => (
                  <div
                    key={lesson.id}
                    className="glass-row flex items-start justify-between gap-3 rounded-2xl border border-blue-100/70 bg-white/50 p-4 dark:border-slate-700 dark:bg-slate-900/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-blue-900 dark:text-blue-100">{lesson.subject.name}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {t("teacherLine", { name: `${lesson.teacher.name} ${lesson.teacher.surname}` })}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{tp("room", { room: lesson.room || tp("tba") })}</p>
                    </div>
                    <div className="shrink-0 text-right text-sm text-slate-600 dark:text-slate-400">
                      <p className="font-bold text-blue-900 dark:text-blue-100">
                        {format.dateTime(new Date(lesson.startTime), { hour: "2-digit", minute: "2-digit" })}
                      </p>
                      <p>
                        {tc.has(`days.${String(lesson.day).toLowerCase()}`)
                          ? tc(`days.${String(lesson.day).toLowerCase()}`)
                          : lesson.day}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-600 dark:text-slate-400">{t("noLessons")}</p>
            )}
          </section>

          {/* VIDEO STUDIO */}
          <section className="glass-surface glass-rise p-5" style={rise(7)}>
            <h2 className="mb-4 flex items-center gap-3 text-lg font-bold text-blue-900 dark:text-blue-100">
              <span className="glass-icon glass-icon--gold !h-9 !w-9 !rounded-xl">
                <Video className="h-4 w-4" aria-hidden="true" />
              </span>
              {t("videoStudio")}
            </h2>
            <MyCamera />
          </section>

          {/* FEATURE TILES */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Link
              href="/dashboard/list/tickets"
              className="group glass-surface glass-tile glass-lift glass-rise flex items-center gap-4 p-5"
              style={rise(8)}
            >
              <span className="glass-icon glass-icon--gold !h-12 !w-12">
                <FileText className="h-6 w-6" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-blue-900 dark:text-blue-100">{tm("lostFound")}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">{t("reportOrFindItems")}</p>
              </div>
              <ChevronRight
                className="h-4 w-4 shrink-0 text-blue-400 transition-transform duration-300 group-hover:translate-x-1"
                aria-hidden="true"
              />
            </Link>
            <Link
              href="/dashboard/list/featured-video"
              className="group glass-surface glass-tile glass-lift glass-rise flex items-center gap-4 p-5"
              style={rise(9)}
            >
              <span className="glass-icon glass-icon--blue !h-12 !w-12">
                <Video className="h-6 w-6" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-blue-900 dark:text-blue-100">{tm("featuredVideo")}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">{t("watchFeatured")}</p>
              </div>
              <ChevronRight
                className="h-4 w-4 shrink-0 text-blue-400 transition-transform duration-300 group-hover:translate-x-1"
                aria-hidden="true"
              />
            </Link>
          </div>

          {/* ACADEMIC PROGRESS */}
          <section className="glass-surface glass-rise p-5" style={rise(10)}>
            <h2 className="mb-4 flex items-center gap-3 text-lg font-bold text-blue-900 dark:text-blue-100">
              <span className="glass-icon glass-icon--blue !h-9 !w-9 !rounded-xl">
                <Award className="h-4 w-4" aria-hidden="true" />
              </span>
              {tp("academicProgress")}
            </h2>
            {student.results && student.results.length > 0 ? (
              <div className="grid gap-3">
                {student.results.slice(0, 8).map((result) => {
                  const assessment = result.exam || result.assignment;
                  const tier = result.score >= 80 ? "excellent" : result.score >= 60 ? "good" : "needsImprovement";
                  const tierClass =
                    tier === "excellent"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : tier === "good"
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-rose-600 dark:text-rose-400";
                  return (
                    <div
                      key={result.id}
                      className="glass-row flex items-center justify-between gap-3 rounded-2xl border border-blue-100/70 bg-white/50 p-4 dark:border-slate-700 dark:bg-slate-900/40"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-blue-900 dark:text-blue-100">{assessment?.title}</p>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {result.exam ? t("examBadge") : t("assignmentBadge")} • {assessment?.lesson?.subject?.name}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-lg font-bold text-blue-900 dark:text-blue-100">{result.score}%</p>
                        <p className={`text-xs font-semibold ${tierClass}`}>{tp(tier)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-slate-600 dark:text-slate-400">{tp("noResults")}</p>
            )}
          </section>

          {/* COMMUNICATION */}
          <section className="glass-surface glass-feature glass-rise p-5" style={rise(11)}>
            <h2 className="mb-2 flex items-center gap-3 text-lg font-bold text-blue-900 dark:text-blue-100">
              <span className="glass-icon glass-icon--gold !h-9 !w-9 !rounded-xl">
                <MessageSquare className="h-4 w-4" aria-hidden="true" />
              </span>
              {tp("stayConnected")}
            </h2>
            <p className="mb-5 text-sm text-slate-600 dark:text-slate-300">{tp("stayConnectedDesc")}</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/dashboard/list/messages"
                className="glass-btn inline-flex items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold text-white"
              >
                <MessageSquare className="h-4 w-4" aria-hidden="true" />
                {tp("messageTeachers")}
              </Link>
              <Link
                href="/dashboard/list/events"
                className="glass-row inline-flex items-center justify-center gap-2 rounded-full border border-blue-200/70 bg-white/70 px-6 py-2.5 text-sm font-semibold text-blue-900 dark:border-slate-700 dark:bg-slate-900/50 dark:text-blue-100"
              >
                <CalendarCheck className="h-4 w-4" aria-hidden="true" />
                {tp("viewEvents")}
              </Link>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default ParentDashboard;
