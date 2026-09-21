import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@clerk/nextjs/server";
import { getLocale, getTranslations } from "next-intl/server";
import prisma from "@/lib/prisma";
import { getUserRole } from "@/lib/auth";
import { SCHOOL_TIME_ZONE, SCHOOL_UTC_LABEL, toWallClock } from "@/lib/schoolTime";
import {
  SchedulePdfDocument,
  SCHEDULE_DAYS,
  type ScheduleDay,
  type SchedulePdfLesson,
} from "@/lib/schedulePdf";

// Downloadable weekly schedule (PDF) for one teacher or one class. Built fresh on
// every request from the latest timetable, in the language the viewer picked.
//
//   /api/schedule/pdf?classId=38                 whole class, every teacher
//   /api/schedule/pdf?teacherId=<id>             one teacher, every class
//   /api/schedule/pdf?classId=38&teacherId=<id>  one teacher's lessons in one class
//
// Admins can ask for any of the above; a teacher always gets their own week.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (error: string, status: number) => NextResponse.json({ error }, { status });

/** "2026–2027": the school year that contains today (it starts in September). */
const currentSchoolYear = () => {
  const now = toWallClock(new Date());
  const start = now.month >= 8 ? now.year : now.year - 1;
  return `${start}–${start + 1}`;
};

const safeFileName = (name: string) => name.replace(/[\\/:*?"<>|\r\n]+/g, "-").trim();

export async function GET(req: NextRequest) {
  const { userId, sessionClaims } = auth();
  if (!userId) return json("Unauthorized", 401);
  const role = getUserRole(sessionClaims);

  const params = req.nextUrl.searchParams;
  const teacherParam = params.get("teacherId") || null;
  const classRaw = params.get("classId");
  const classParam = classRaw && /^\d+$/.test(classRaw) ? parseInt(classRaw, 10) : null;

  let teacherId: string | null = null;
  let classId: number | null = null;

  if (role === "admin") {
    teacherId = teacherParam;
    classId = classParam;
    if (!teacherId && classId === null) return json("Pass ?classId= or ?teacherId=", 400);
  } else if (role === "teacher") {
    // A teacher downloads their own week only.
    if (teacherParam && teacherParam !== userId) return json("Forbidden", 403);
    teacherId = userId;
  } else {
    return json("Forbidden", 403);
  }

  const [teacher, klass] = await Promise.all([
    teacherId
      ? prisma.teacher.findUnique({ where: { id: teacherId }, select: { name: true, surname: true } })
      : Promise.resolve(null),
    classId !== null && role === "admin"
      ? prisma.class.findUnique({ where: { id: classId }, select: { name: true } })
      : Promise.resolve(null),
  ]);
  if (teacherId && !teacher) return json("Teacher not found", 404);
  if (classId !== null && role === "admin" && !klass) return json("Class not found", 404);

  const rows = await prisma.lesson.findMany({
    where: {
      ...(teacherId ? { teacherId } : {}),
      ...(classId !== null && role === "admin" ? { classId } : {}),
    },
    include: { subject: true, class: true, teacher: true },
    orderBy: { startTime: "asc" },
  });

  const lessons: SchedulePdfLesson[] = [];
  for (const row of rows) {
    // The weekday lives in `day`; the stored date part of startTime is meaningless.
    if (!SCHEDULE_DAYS.includes(row.day as ScheduleDay)) continue;
    const start = toWallClock(row.startTime);
    const end = toWallClock(row.endTime);
    const startMin = start.hour * 60 + start.minute;
    const endMin = end.hour * 60 + end.minute;
    if (endMin <= startMin) continue;
    lessons.push({
      day: row.day as ScheduleDay,
      startMin,
      endMin,
      subject: row.subject.name,
      subjectId: row.subjectId,
      className: row.class.name,
      teacherName: `${row.teacher.name} ${row.teacher.surname}`,
      room: row.room ?? null,
    });
  }

  const [t, common, locale] = await Promise.all([
    getTranslations("SchedulePdf"),
    getTranslations("Common"),
    getLocale(),
  ]);

  const kind: "teacher" | "class" = teacher ? "teacher" : "class";
  const name = teacher ? `${teacher.name} ${teacher.surname}` : (klass?.name ?? "");
  const scopeNote = teacher && klass ? t("scopeClass", { name: klass.name }) : undefined;

  let generatedOn: string;
  try {
    generatedOn = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: SCHOOL_TIME_ZONE }).format(
      new Date()
    );
  } catch {
    generatedOn = new Date().toISOString().slice(0, 10);
  }

  const pdfBuffer = await renderToBuffer(
    SchedulePdfDocument({
      data: {
        kind,
        name,
        scopeNote,
        lessons,
        labels: {
          schoolName: "Alan International School",
          title: t("title"),
          kind: kind === "teacher" ? t("teacher") : t("class"),
          schoolYear: currentSchoolYear(),
          statLessons: t("statLessons"),
          statHours: t("statHours"),
          statPeople: kind === "teacher" ? t("statClasses") : t("statTeachers"),
          statBusiest: t("statBusiest"),
          days: {
            MONDAY: common("days.monday"),
            TUESDAY: common("days.tuesday"),
            WEDNESDAY: common("days.wednesday"),
            THURSDAY: common("days.thursday"),
            FRIDAY: common("days.friday"),
          },
          generated: t("generated", { date: generatedOn }),
          timesNote: t("timesNote", { zone: SCHOOL_UTC_LABEL }),
          empty: t("empty"),
          roomLabel: (room: string) => t("room", { room }),
        },
      },
    })
  );

  // Real name for browsers that read filename* (UTF-8, so Cyrillic and Kazakh
  // names survive); a plain-ASCII fallback for the rest.
  const fileName = safeFileName(`schedule-${name}.pdf`);
  const asciiBase = safeFileName(name).replace(/[^\x20-\x7e]/g, "").replace(/\s+/g, "-").replace(/^-+|-+$/g, "");
  const asciiName = `schedule-${asciiBase || kind}.pdf`;

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName).replace(/'/g, "%27")}`,
      "Cache-Control": "private, no-store",
    },
  });
}
