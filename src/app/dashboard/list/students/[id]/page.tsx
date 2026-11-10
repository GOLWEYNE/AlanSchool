import Announcements from "@/components/Announcements";
import BigCalendarContainer from "@/components/BigCalendarContainer";
import Performance from "@/components/Performance";
import StudentAttendanceCard from "@/components/StudentAttendanceCard";
import StudentStudyPlanner from "@/components/StudentStudyPlanner";
import AnimatedNumber from "@/components/dashboard/AnimatedNumber";
import prisma from "@/lib/prisma";
import { getUserRole } from "@/lib/auth";
import { teacherCanAccessStudent } from "@/lib/teacherScope";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { CSSProperties } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import {
  BookOpen,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  ChevronRight,
  ClipboardList,
  Droplet,
  FileText,
  GraduationCap,
  Mail,
  MessageSquare,
  NotebookPen,
  Pencil,
  Phone,
  School,
  Trophy,
  Users,
} from "lucide-react";
import { Class, Student } from "@/generated/prisma/client";

type MessageableTeacher = { id: string; name: string; surname: string };

const SingleStudentPage = async ({
  params: { id },
}: {
  params: { id: string };
}) => {
  const { userId, sessionClaims } = auth();
  const role = getUserRole(sessionClaims);

  // Teachers may only open students from their own classes.
  if (role === "teacher" && !(await teacherCanAccessStudent(userId!, id))) {
    return notFound();
  }

  const student:
    | (Student & {
        class: Class & {
          _count: { lessons: number };
          supervisor: MessageableTeacher | null;
          lessons: { teacher: MessageableTeacher }[];
        };
      })
    | null = await prisma.student.findUnique({
    where: { id },
    include: {
      class: {
        include: {
          _count: { select: { lessons: true } },
          supervisor: { select: { id: true, name: true, surname: true } },
          lessons: {
            take: 1,
            select: { teacher: { select: { id: true, name: true, surname: true } } },
          },
        },
      },
    },
  });

  if (!student) {
    return notFound();
  }

  // Homeroom teacher first, otherwise whoever teaches this class - either
  // way, the parent gets a one-click way to reach a real teacher rather
  // than having to know who to ask for.
  const messageableTeacher: MessageableTeacher | null =
    student.class.supervisor ?? student.class.lessons[0]?.teacher ?? null;

  // The student's own Study Planner is theirs to edit; staff get a read-only view.
  const canSeeStudyPlanner = role === "admin" || role === "teacher";

  const t = await getTranslations("Profiles.detail");
  const locale = await getLocale();
  // English keeps the day/month/year order it always had; other locales use their own.
  const dateLocale = locale === "en" ? "en-GB" : locale;

  const photoSrc =
    typeof student.img === "string" && student.img.trim() ? student.img : "/Alan.png";

  const contacts = [
    { Icon: Droplet, text: student.bloodType || "-", href: null },
    {
      Icon: CalendarDays,
      text: new Intl.DateTimeFormat(dateLocale).format(student.birthday),
      href: null,
    },
    { Icon: Mail, text: student.email || "-", href: student.email ? `mailto:${student.email}` : null },
    { Icon: Phone, text: student.phone || "-", href: student.phone ? `tel:${student.phone}` : null },
  ];

  const classId = student.class.id;
  // "10A" -> 10 (a class name like "1A" or "11B" always starts with its grade number).
  const parsedGrade = parseInt(student.class.name, 10);
  const gradeNumber = Number.isNaN(parsedGrade) ? 0 : parsedGrade;
  const shortcuts: { Icon: typeof BookOpen; label: string; href: string }[] = [
    { Icon: BookOpen, label: t("studentLessons"), href: `/dashboard/list/lessons?classId=${classId}` },
    { Icon: Users, label: t("studentTeachers"), href: `/dashboard/list/teachers?classId=${classId}` },
    { Icon: FileText, label: t("studentExams"), href: `/dashboard/list/exams?classId=${classId}` },
    { Icon: ClipboardList, label: t("studentAssignments"), href: `/dashboard/list/assignments?classId=${classId}` },
    { Icon: Trophy, label: t("studentResults"), href: `/dashboard/list/results?studentId=${student.id}` },
  ];

  // Entrance stagger: each block rises a beat after the one before it.
  const rise = (i: number) => ({ "--i": i }) as CSSProperties;

  return (
    <div className="flex-1 p-4 flex flex-col gap-4">
      <div className="flex flex-col gap-4 xl:flex-row">
        {/* LEFT */}
        <div className="w-full xl:w-2/3 flex flex-col gap-4 min-w-0">
          {/* HERO: brand cover, photo ring, name, contact chips */}
          <section className="glass-surface glass-feature glass-rise overflow-hidden" style={rise(0)}>
            <div className="glass-cover h-28" aria-hidden="true" />
            <div className="px-5 pb-5 sm:px-6">
              <div className="-mt-14 flex flex-col items-center gap-4 text-center sm:flex-row sm:items-end sm:text-left">
                <div className="shrink-0 rounded-full bg-gradient-to-br from-yellow-300 via-sky-300 to-blue-500 p-1 shadow-xl shadow-blue-900/25 transition-transform duration-500 hover:scale-105">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoSrc}
                    alt=""
                    width={128}
                    height={128}
                    className="h-32 w-32 rounded-full border-4 border-white object-cover dark:border-slate-900"
                  />
                </div>
                <div className="flex min-w-0 flex-1 flex-col items-center gap-2 sm:items-start sm:pb-1">
                  <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
                    <h1 className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                      {student.name + " " + student.surname}
                    </h1>
                    {role === "admin" && (
                      <Link
                        href={`/dashboard/edit/student/${student.id}`}
                        className="glass-btn inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold text-white"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        {t("edit")}
                      </Link>
                    )}
                  </div>
                  <span className="glass-chip glass-chip--gold">
                    <School className="h-3.5 w-3.5" aria-hidden="true" />
                    {t("class")} {student.class.name}
                  </span>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {contacts.map(({ Icon, text, href }, i) => {
                  const chip =
                    "glass-row inline-flex min-w-0 max-w-full items-center gap-2 rounded-full border border-blue-200/70 bg-white/60 px-3 py-1.5 text-xs font-medium text-blue-900 dark:border-slate-700 dark:bg-slate-900/50 dark:text-blue-100";
                  const inner = (
                    <>
                      <Icon className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-300" aria-hidden="true" />
                      <span className="truncate">{text}</span>
                    </>
                  );
                  return href ? (
                    <a key={i} href={href} className={chip} title={text}>
                      {inner}
                    </a>
                  ) : (
                    <span key={i} className={chip}>
                      {inner}
                    </span>
                  );
                })}
              </div>
            </div>
          </section>

          {/* STAT TILES */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="group glass-surface glass-tile glass-lift glass-rise flex items-center gap-3 p-4" style={rise(1)}>
              <span className="glass-icon glass-icon--blue">
                <CalendarCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <Suspense fallback={<p className="text-2xl font-bold leading-none text-blue-900 dark:text-blue-100">…</p>}>
                  <StudentAttendanceCard id={student.id} />
                </Suspense>
              </div>
            </div>
            <div className="group glass-surface glass-tile glass-lift glass-rise flex items-center gap-3 p-4" style={rise(2)}>
              <span className="glass-icon glass-icon--gold">
                <GraduationCap className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-2xl font-bold leading-none text-blue-900 dark:text-blue-100">
                  {t("gradeOrdinal", { n: gradeNumber })}
                </p>
                <p className="mt-1 truncate text-xs font-medium text-slate-500 dark:text-slate-400">{t("grade")}</p>
              </div>
            </div>
            <div className="group glass-surface glass-tile glass-lift glass-rise flex items-center gap-3 p-4" style={rise(3)}>
              <span className="glass-icon glass-icon--blue">
                <BookOpen className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-2xl font-bold leading-none text-blue-900 dark:text-blue-100">
                  <AnimatedNumber value={student.class._count.lessons} />
                </p>
                <p className="mt-1 truncate text-xs font-medium text-slate-500 dark:text-slate-400">{t("lessons")}</p>
              </div>
            </div>
            <div className="group glass-surface glass-tile glass-lift glass-rise flex items-center gap-3 p-4" style={rise(4)}>
              <span className="glass-icon glass-icon--gold">
                <School className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-2xl font-bold leading-none text-blue-900 dark:text-blue-100">{student.class.name}</p>
                <p className="mt-1 truncate text-xs font-medium text-slate-500 dark:text-slate-400">{t("class")}</p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="w-full xl:w-1/3 flex flex-col gap-4 min-w-0">
          <section className="glass-surface glass-rise p-5" style={rise(2)}>
            <h2 className="text-lg font-bold text-blue-900 dark:text-blue-100">{t("shortcuts")}</h2>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              {role === "parent" && messageableTeacher && (
                <Link
                  className="group glass-btn !items-center !p-3 text-sm font-semibold text-white flex gap-2 rounded-2xl sm:col-span-2 xl:col-span-1 2xl:col-span-2"
                  href={`/dashboard/list/messages?peer=${messageableTeacher.id}&role=teacher&student=${student.id}`}
                >
                  <MessageSquare className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">
                    {t("messageTeacher", { name: `${messageableTeacher.name} ${messageableTeacher.surname}` })}
                  </span>
                  <ChevronRight
                    className="h-4 w-4 shrink-0 transition-transform duration-300 group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </Link>
              )}
              {shortcuts.map(({ Icon, label, href }, i) => (
                <Link
                  key={href}
                  href={href}
                  className="group glass-action !items-center !p-3 text-sm font-semibold text-blue-900 dark:text-blue-100"
                >
                  <span className={`glass-icon !h-9 !w-9 !rounded-xl ${i % 2 ? "glass-icon--gold" : "glass-icon--blue"}`}>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-blue-400 transition-transform duration-300 group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </Link>
              ))}
              {canSeeStudyPlanner && (
                <a
                  href="#study-planner"
                  className="group glass-action !items-center !p-3 text-sm font-semibold text-blue-900 dark:text-blue-100"
                >
                  <span className="glass-icon glass-icon--gold !h-9 !w-9 !rounded-xl">
                    <NotebookPen className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{t("studentStudyPlanner")}</span>
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-blue-400 transition-transform duration-300 group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </a>
              )}
            </div>
          </section>
          <div className="glass-host glass-rise" style={rise(3)}>
            <Performance />
          </div>
          <div className="glass-rise" style={rise(4)}>
            <Announcements />
          </div>
        </div>
      </div>

      {/* STUDY PLANNER - goals, upcoming deadlines and the calendar export (staff only, read-only) */}
      {canSeeStudyPlanner && (
        <StudentStudyPlanner
          studentId={student.id}
          studentName={`${student.name} ${student.surname}`}
          classId={student.classId}
        />
      )}

      {/* SCHEDULE - full page width so the whole week is easy to read at a glance */}
      <section className="glass-surface glass-rise flex min-h-[700px] flex-col p-5" style={rise(5)}>
        <h2 className="flex items-center gap-3 text-lg font-bold text-blue-900 dark:text-blue-100">
          <span className="glass-icon glass-icon--gold !h-9 !w-9 !rounded-xl">
            <CalendarRange className="h-4 w-4" aria-hidden="true" />
          </span>
          {t("studentSchedule")}
        </h2>
        <div className="mt-3 flex-1">
          {/* @ts-ignore */}
          <BigCalendarContainer type="classId" id={student.class.id} />
        </div>
      </section>
    </div>
  );
};

export default SingleStudentPage;
