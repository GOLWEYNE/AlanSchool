import { getTranslations } from "next-intl/server";
import prisma from "@/lib/prisma";
import PageHero from "@/components/PageHero";
import MockTestEntry, { type EntryStudent, type RecentScore } from "@/components/mockTests/MockTestEntry";
import { requireRole } from "@/lib/auth";
import { routeAccessMap } from "@/lib/settings";
import { getTeacherClassIds } from "@/lib/teacherScope";
import { ensureMockTests } from "@/lib/mockTests";
import { isMockKind, type MockKind } from "@/lib/mockTestsShared";
import { schoolDayRange, toWallClock } from "@/lib/schoolTime";

export const dynamic = "force-dynamic";

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: { year: number; month: number; day: number }) => `${d.year}-${pad(d.month)}-${pad(d.day)}`;

// Weekly IELTS / SAT mock test scores for the report card: pick a class, a test and a date,
// then type each student's scores. Admins see every class; teachers only their own.
const MockTestsPage = async ({ searchParams }: { searchParams: { [key: string]: string | undefined } }) => {
  const { userId, role } = requireRole(routeAccessMap["/dashboard/list/mock-tests(.*)"]);
  const t = await getTranslations("MockTests");

  const kind: MockKind = isMockKind(searchParams.kind) ? searchParams.kind : "IELTS";
  const today = ymd(toWallClock(new Date()));
  const date = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date ?? "") ? (searchParams.date as string) : today;

  const teacherClassIds = role === "teacher" ? await getTeacherClassIds(userId) : null;
  const classes = await prisma.class.findMany({
    where: teacherClassIds ? { id: { in: teacherClassIds } } : undefined,
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const requested = parseInt(searchParams.classId ?? "", 10);
  const classId = classes.find((c) => c.id === requested)?.id ?? classes[0]?.id ?? null;

  const studentRows = classId
    ? await prisma.student.findMany({
        where: { classId },
        select: { id: true, name: true, surname: true },
        orderBy: [{ surname: "asc" }, { name: "asc" }],
      })
    : [];
  const ids = studentRows.map((s) => s.id);

  let students: EntryStudent[] = studentRows.map((s) => ({ id: s.id, name: `${s.surname} ${s.name}`, existing: null }));
  let recent: RecentScore[] = [];
  let enteredToday = 0;

  if (ids.length && (await ensureMockTests())) {
    const [dayStart, dayEnd] = schoolDayRange(date);
    const [onDay, latest] = await Promise.all([
      prisma.mockTestScore.findMany({
        where: { studentId: { in: ids }, kind, takenAt: { gte: dayStart, lt: dayEnd } },
        orderBy: { takenAt: "asc" },
      }),
      prisma.mockTestScore.findMany({
        where: { studentId: { in: ids }, kind: { in: ["IELTS", "SAT"] } },
        orderBy: { takenAt: "desc" },
        take: 20,
      }),
    ]);
    const byStudent = new Map(onDay.map((r) => [r.studentId, r]));
    enteredToday = byStudent.size;
    students = students.map((s) => {
      const row = byStudent.get(s.id);
      return {
        ...s,
        existing: row
          ? {
              score: row.score,
              sections:
                row.sections && typeof row.sections === "object" && !Array.isArray(row.sections)
                  ? (row.sections as Record<string, number>)
                  : null,
            }
          : null,
      };
    });
    const names = new Map(students.map((s) => [s.id, s.name]));
    recent = latest.map((r) => ({
      id: r.id,
      studentName: names.get(r.studentId) ?? r.studentId,
      kind: r.kind as MockKind,
      score: r.score,
      date: ymd(toWallClock(r.takenAt)),
    }));
  }

  return (
    <div className="flex-1 p-4">
      <PageHero
        title={t("title")}
        subtitle={t("subtitle")}
        emoji="📝"
        stats={[
          { label: t("stats.students"), value: students.length },
          { label: t("stats.entered"), value: enteredToday },
        ]}
      />
      <MockTestEntry
        key={`${classId}-${kind}-${date}-${enteredToday}`}
        classes={classes}
        classId={classId}
        kind={kind}
        date={date}
        students={students}
        recent={recent}
      />
    </div>
  );
};

export default MockTestsPage;
