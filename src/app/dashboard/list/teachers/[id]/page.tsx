import Announcements from "@/components/Announcements";
import BigCalendarContainer from "@/components/BigCalendarContainer";
import BigCalendar from "@/components/BigCalendar";
// FormContainer component removed due to import resolution issues
import Performance from "@/components/Performance";
import ScheduleDownloadLink from "@/components/ScheduleDownloadLink";
import prisma from "@/lib/prisma";
import { getUserRole } from "@/lib/auth";
import { auth } from "@clerk/nextjs/server";
// Prisma client types may not export a direct 'Teacher' type in this setup
// Use a local any-typed annotation for the fetched teacher to avoid type errors
import Link from "next/link";
import type { CSSProperties } from "react";
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
  Pencil,
  Phone,
  Presentation,
  School,
  Users,
} from "lucide-react";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import TeacherProfileCard from "@/components/TeacherProfileCard";
import AnimatedNumber from "@/components/dashboard/AnimatedNumber";
import { ensureTeacherProfile } from "@/lib/teacherProfile";

type TeacherWithCounts = {
  id: string;
  name: string;
  surname: string;
  img?: string | null;
  bloodType?: string | null;
  birthday: Date;
  email?: string | null;
  phone?: string | null;
  _count: { subjects: number; lessons: number; classes: number };
};

const SingleTeacherPage = async ({
  params: { id },
}: {
  params: { id: string };
}) => {
  const { userId, sessionClaims } = auth();
  const role = getUserRole(sessionClaims);

  const teacher: TeacherWithCounts | null = await prisma.teacher.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          subjects: true,
          lessons: true,
          classes: true,
        },
      },
    },
  });

  if (!teacher) {
    return notFound();
  }

  const t = await getTranslations("Profiles.detail");
  const tp = await getTranslations("TeacherProfile");
  const locale = await getLocale();
  // The teacher's own profile (photo, position, about) replaces the placeholder text.
  const profile = (await ensureTeacherProfile())
    ? await prisma.teacherProfile.findUnique({
        where: { teacherId: id },
        select: { photoUrl: true, position: true, about: true },
      })
    : null;
  const canSeeGoals = role === "admin" || (role === "teacher" && userId === teacher.id);
  // English keeps the day/month/year order it always had; other locales use their own.
  const dateLocale = locale === "en" ? "en-GB" : locale;

  const canEdit = role === "admin" || (role === "teacher" && userId === teacher.id);
  const photoSrc =
    profile?.photoUrl || (typeof teacher.img === "string" && teacher.img.trim() ? teacher.img : "/Alan.png");

  const contacts = [
    { Icon: Droplet, text: teacher.bloodType || "-", href: null },
    {
      Icon: CalendarDays,
      text: new Intl.DateTimeFormat(dateLocale).format(teacher.birthday),
      href: null,
    },
    { Icon: Mail, text: teacher.email || "-", href: teacher.email ? `mailto:${teacher.email}` : null },
    { Icon: Phone, text: teacher.phone || "-", href: teacher.phone ? `tel:${teacher.phone}` : null },
  ];

  const stats = [
    { Icon: CalendarCheck, value: 90, suffix: "%", label: t("attendance"), tone: "blue" },
    { Icon: BookOpen, value: teacher._count.subjects, suffix: "", label: t("branches"), tone: "gold" },
    { Icon: Presentation, value: teacher._count.lessons, suffix: "", label: t("lessons"), tone: "blue" },
    { Icon: Users, value: teacher._count.classes, suffix: "", label: t("classes"), tone: "gold" },
  ];

  const shortcuts = [
    { Icon: School, label: t("teacherClasses"), href: `/dashboard/list/classes?supervisorId=${teacher.id}` },
    { Icon: GraduationCap, label: t("teacherStudents"), href: `/dashboard/list/students?teacherId=${teacher.id}` },
    { Icon: BookOpen, label: t("teacherLessons"), href: `/dashboard/list/lessons?teacherId=${teacher.id}` },
    { Icon: FileText, label: t("teacherExams"), href: `/dashboard/list/exams?teacherId=${teacher.id}` },
    { Icon: ClipboardList, label: t("teacherAssignments"), href: `/dashboard/list/assignments?teacherId=${teacher.id}` },
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
                      {teacher.name + " " + teacher.surname}
                    </h1>
                    {canEdit && (
                      <Link
                        href={`/dashboard/edit/teacher/${teacher.id}`}
                        className="glass-btn inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold text-white"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        {t("edit")}
                      </Link>
                    )}
                  </div>
                  {profile?.position ? (
                    <span className="glass-chip glass-chip--gold">{tp(`positions.${profile.position}`)}</span>
                  ) : null}
                </div>
              </div>
              <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                {profile?.about || tp("card.noAbout")}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
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
            {stats.map(({ Icon, value, suffix, label, tone }, i) => (
              <div
                key={label}
                className="group glass-surface glass-tile glass-lift glass-rise flex items-center gap-3 p-4"
                style={rise(i + 1)}
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

          <TeacherProfileCard teacherId={teacher.id} canSeeGoals={canSeeGoals} />
        </div>

        {/* RIGHT */}
        <div className="w-full xl:w-1/3 flex flex-col gap-4 min-w-0">
          <section className="glass-surface glass-rise p-5" style={rise(2)}>
            <h2 className="text-lg font-bold text-blue-900 dark:text-blue-100">{t("shortcuts")}</h2>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              {shortcuts.map(({ Icon, label, href }, i) => (
                <Link
                  key={href}
                  href={href}
                  className={`group glass-action !items-center !p-3 text-sm font-semibold text-blue-900 dark:text-blue-100 ${
                    i === shortcuts.length - 1 ? "2xl:col-span-2" : ""
                  }`}
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

      {/* SCHEDULE - full page width so the whole week is easy to read at a glance */}
      <section className="glass-surface glass-rise flex min-h-[700px] flex-col p-5" style={rise(5)}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-3 text-lg font-bold text-blue-900 dark:text-blue-100">
            <span className="glass-icon glass-icon--gold !h-9 !w-9 !rounded-xl">
              <CalendarRange className="h-4 w-4" aria-hidden="true" />
            </span>
            {t("teacherSchedule")}
          </h2>
          {canEdit && <ScheduleDownloadLink teacherId={teacher.id} />}
        </div>
        <div className="mt-3 flex-1">
          <BigCalendarContainer type="teacherId" id={teacher.id} />
        </div>
      </section>
    </div>
  );
};

export default SingleTeacherPage;
