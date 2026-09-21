import Announcements from "@/components/Announcements";
import BigCalendarContainer from "@/components/BigCalendarContainer";
import BigCalendar from "@/components/BigCalendar";
// FormContainer component removed due to import resolution issues
import Performance from "@/components/Performance";
import prisma from "@/lib/prisma";
import { getUserRole } from "@/lib/auth";
import { auth } from "@clerk/nextjs/server";
// Prisma client types may not export a direct 'Teacher' type in this setup
// Use a local any-typed annotation for the fetched teacher to avoid type errors
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

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
  const locale = await getLocale();
  // English keeps the day/month/year order it always had; other locales use their own.
  const dateLocale = locale === "en" ? "en-GB" : locale;

  return (
    <div className="flex-1 p-4 flex flex-col gap-4">
      <div className="flex flex-col gap-4 xl:flex-row">
      {/* LEFT */}
      <div className="w-full xl:w-2/3">
        {/* TOP */}
        <div className="flex flex-col lg:flex-row gap-4">
          {/* USER INFO CARD */}
          <div className="bg-lamaSky py-6 px-4 rounded-md flex-1 flex gap-4">
            <div className="w-1/3">
              <Image
                src={typeof teacher.img === "string" && teacher.img.trim() ? teacher.img : "/Alan.png"}
                alt=""
                width={144}
                height={144}
                className="w-36 h-36 rounded-full object-cover"
              />
            </div>
            <div className="w-2/3 flex flex-col justify-between gap-4">
              <div className="flex items-center gap-4">
                <h1 className="text-xl font-semibold">
                  {teacher.name + " " + teacher.surname}
                </h1>
                {(role === "admin" || (role === "teacher" && userId === teacher.id)) && (
                  <Link
                    href={`/dashboard/edit/teacher/${teacher.id}`}
                    className="px-3 py-1 text-sm rounded-md bg-lamaPurple hover:bg-purple-700 text-white transition-colors font-semibold"
                  >
                    ✏️ {t("edit")}
                  </Link>
                )}
              </div>
              <p className="text-sm text-gray-500">
                Lorem ipsum, dolor sit amet consectetur adipisicing elit.
              </p>
              <div className="flex items-center justify-between gap-2 flex-wrap text-xs font-medium">
                <div className="w-full md:w-1/3 lg:w-full 2xl:w-1/3 flex items-center gap-2">
                  <Image src="/blood.png" alt="" width={14} height={14} />
                  <span>{teacher.bloodType}</span>
                </div>
                <div className="w-full md:w-1/3 lg:w-full 2xl:w-1/3 flex items-center gap-2">
                  <Image src="/date.png" alt="" width={14} height={14} />
                  <span>
                    {new Intl.DateTimeFormat(dateLocale).format(teacher.birthday)}
                  </span>
                </div>
                <div className="w-full md:w-1/3 lg:w-full 2xl:w-1/3 flex items-center gap-2">
                  <Image src="/mail.png" alt="" width={14} height={14} />
                  <span>{teacher.email || "-"}</span>
                </div>
                <div className="w-full md:w-1/3 lg:w-full 2xl:w-1/3 flex items-center gap-2">
                  <Image src="/phone.png" alt="" width={14} height={14} />
                  <span>{teacher.phone || "-"}</span>
                </div>
              </div>
            </div>
          </div>
          {/* SMALL CARDS */}
          <div className="flex-1 flex gap-4 justify-between flex-wrap">
            {/* CARD */}
            <div className="bg-white p-4 rounded-md flex gap-4 w-full md:w-[48%] xl:w-[45%] 2xl:w-[48%]">
              <Image
                src="/singleAttendance.png"
                alt=""
                width={24}
                height={24}
                className="w-6 h-6"
              />
              <div className="">
                <h1 className="text-xl font-semibold">90%</h1>
                <span className="text-sm text-gray-400">{t("attendance")}</span>
              </div>
            </div>
            {/* CARD */}
            <div className="bg-white p-4 rounded-md flex gap-4 w-full md:w-[48%] xl:w-[45%] 2xl:w-[48%]">
              <Image
                src="/singleBranch.png"
                alt=""
                width={24}
                height={24}
                className="w-6 h-6"
              />
              <div className="">
                <h1 className="text-xl font-semibold">
                  {teacher._count.subjects}
                </h1>
                <span className="text-sm text-gray-400">{t("branches")}</span>
              </div>
            </div>
            {/* CARD */}
            <div className="bg-white p-4 rounded-md flex gap-4 w-full md:w-[48%] xl:w-[45%] 2xl:w-[48%]">
              <Image
                src="/singleLesson.png"
                alt=""
                width={24}
                height={24}
                className="w-6 h-6"
              />
              <div className="">
                <h1 className="text-xl font-semibold">
                  {teacher._count.lessons}
                </h1>
                <span className="text-sm text-gray-400">{t("lessons")}</span>
              </div>
            </div>
            {/* CARD */}
            <div className="bg-white p-4 rounded-md flex gap-4 w-full md:w-[48%] xl:w-[45%] 2xl:w-[48%]">
              <Image
                src="/singleClass.png"
                alt=""
                width={24}
                height={24}
                className="w-6 h-6"
              />
              <div className="">
                <h1 className="text-xl font-semibold">
                  {teacher._count.classes}
                </h1>
                <span className="text-sm text-gray-400">{t("classes")}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* RIGHT */}
      <div className="w-full xl:w-1/3 flex flex-col gap-4">
        <div className="bg-white p-4 rounded-md">
          <h1 className="text-xl font-semibold">{t("shortcuts")}</h1>
          <div className="mt-4 flex gap-4 flex-wrap text-xs text-gray-500">
           <Link
              className="p-3 rounded-md bg-lamaSkyLight"
              href={`/dashboard/list/classes?supervisorId=${teacher.id}`}
            >
              {t("teacherClasses")}
            </Link>
            <Link
              className="p-3 rounded-md bg-lamaPurpleLight"
              href={`/dashboard/list/students?teacherId=${teacher.id}`}
            >
              {t("teacherStudents")}
            </Link>
            <Link
              className="p-3 rounded-md bg-lamaYellowLight"
              href={`/dashboard/list/lessons?teacherId=${teacher.id}`}
            >
              {t("teacherLessons")}
            </Link>
            <Link
              className="p-3 rounded-md bg-pink-50"
              href={`/dashboard/list/exams?teacherId=${teacher.id}`}
            >
              {t("teacherExams")}
            </Link>
            <Link
              className="p-3 rounded-md bg-lamaSkyLight"
              href={`/dashboard/list/assignments?teacherId=${teacher.id}`}
            >
              {t("teacherAssignments")}
            </Link>
          </div>
        </div>
        <Performance />
        <Announcements />
      </div>
      </div>

      {/* SCHEDULE - full page width so the whole week is easy to read at a glance */}
      <div className="bg-white dark:bg-slate-900 rounded-md p-4 min-h-[700px] flex flex-col">
        <h1 className="text-blue-900 dark:text-blue-100">{t("teacherSchedule")}</h1>
        <div className="flex-1 mt-2">
          <BigCalendarContainer type="teacherId" id={teacher.id} />
        </div>
      </div>
    </div>
  );
};

export default SingleTeacherPage;