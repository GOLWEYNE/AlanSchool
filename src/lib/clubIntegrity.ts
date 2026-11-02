import prisma from "@/lib/prisma";
import { fromWallClock } from "@/lib/schoolTime";
import { addDays, schoolToday, toDbDate } from "@/lib/uniform";
import { CLUBS_PER_STUDENT } from "@/lib/clubRules";

// "Needs checking" panel for the Club insights page. Three things that should
// not happen, all read from registers that already exist:
//  1. Absent in class, present at a club: the class register says the student
//     was away today, yet a club supervisor marked them present.
//  2. Present in more than one club today (a student attends one club a day).
//  3. Enrolled in more than two clubs (the rule is exactly two).

export type MismatchRow = {
  studentId: string;
  student: string;
  className: string;
  classStatus: "ABSENT" | "EXCUSED";
  classSupervisor: string | null;
  clubs: string[];
  clubSupervisors: string[];
};

export type DoubleRow = { studentId: string; student: string; className: string; clubs: string[] };
export type OverLimitRow = { studentId: string; student: string; className: string; clubs: string[] };

export type ClubIntegrity = {
  mismatches: MismatchRow[];
  doubleToday: DoubleRow[];
  overLimit: OverLimitRow[];
  total: number;
};

const wallStartOf = (ymd: string): Date =>
  fromWallClock({ year: Number(ymd.slice(0, 4)), month: Number(ymd.slice(5, 7)), day: Number(ymd.slice(8, 10)) });

const byName = (a: { student: string }, b: { student: string }) => a.student.localeCompare(b.student);

export async function getClubIntegrity(opts: {
  // Set for a teacher: only students in the clubs they supervise.
  clubIds?: number[];
}): Promise<ClubIntegrity> {
  const today = schoolToday();
  const todayStart = wallStartOf(today);
  const todayEnd = wallStartOf(addDays(today, 1));

  const clubFilter = opts.clubIds ? { clubId: { in: opts.clubIds } } : {};

  // Club register rows marked present/late today.
  const cameToday = await prisma.clubAttendance.findMany({
    where: {
      status: { in: ["PRESENT", "LATE"] },
      clubSession: { date: { gte: todayStart, lt: todayEnd }, ...clubFilter },
    },
    select: {
      studentId: true,
      student: {
        select: {
          name: true,
          surname: true,
          class: { select: { name: true, supervisor: { select: { name: true, surname: true } } } },
        },
      },
      clubSession: {
        select: {
          club: {
            select: {
              name: true,
              instructor: { select: { name: true, surname: true } },
              supervisors: { select: { teacher: { select: { name: true, surname: true } } } },
            },
          },
        },
      },
    },
  });

  type Person = { name: string; surname: string };
  const fullName = (p: Person) => `${p.name} ${p.surname}`;

  const present = new Map<
    string,
    {
      student: string;
      className: string;
      classSupervisor: string | null;
      clubs: Set<string>;
      clubSupervisors: Set<string>;
    }
  >();
  for (const row of cameToday) {
    const entry = present.get(row.studentId) ?? {
      student: fullName(row.student),
      className: row.student.class?.name ?? "",
      classSupervisor: row.student.class?.supervisor ? fullName(row.student.class.supervisor) : null,
      clubs: new Set<string>(),
      clubSupervisors: new Set<string>(),
    };
    const club = row.clubSession.club;
    entry.clubs.add(club.name);
    if (club.instructor) entry.clubSupervisors.add(fullName(club.instructor));
    for (const s of club.supervisors) entry.clubSupervisors.add(fullName(s.teacher));
    present.set(row.studentId, entry);
  }

  // 1. Absent in class, present at a club -------------------------------------
  const presentIds = Array.from(present.keys());
  const classAbsent = presentIds.length
    ? await prisma.attendanceRecord.findMany({
        where: {
          studentId: { in: presentIds },
          date: { gte: toDbDate(today), lt: toDbDate(addDays(today, 1)) },
          status: { in: ["ABSENT", "EXCUSED"] },
        },
        select: { studentId: true, status: true },
      })
    : [];
  // A student can have several records in a day (per lesson): ABSENT outranks EXCUSED.
  const absentStatus = new Map<string, "ABSENT" | "EXCUSED">();
  for (const r of classAbsent) {
    if (absentStatus.get(r.studentId) === "ABSENT") continue;
    absentStatus.set(r.studentId, r.status === "ABSENT" ? "ABSENT" : "EXCUSED");
  }
  const mismatches: MismatchRow[] = Array.from(absentStatus.entries())
    .map(([studentId, classStatus]) => {
      const p = present.get(studentId)!;
      return {
        studentId,
        student: p.student,
        className: p.className,
        classStatus,
        classSupervisor: p.classSupervisor,
        clubs: Array.from(p.clubs),
        clubSupervisors: Array.from(p.clubSupervisors),
      };
    })
    .sort(byName);

  // 2. Present in more than one club today ------------------------------------
  const doubleToday: DoubleRow[] = Array.from(present.entries())
    .filter(([, p]) => p.clubs.size > 1)
    .map(([studentId, p]) => ({
      studentId,
      student: p.student,
      className: p.className,
      clubs: Array.from(p.clubs),
    }))
    .sort(byName);

  // 3. Enrolled in more than two clubs ----------------------------------------
  const active = await prisma.clubEnrollment.findMany({
    where: { status: "ACTIVE" },
    select: {
      studentId: true,
      club: { select: { id: true, name: true } },
      student: { select: { name: true, surname: true, class: { select: { name: true } } } },
    },
  });
  const perStudent = new Map<string, { student: string; className: string; clubs: { id: number; name: string }[] }>();
  for (const row of active) {
    const entry = perStudent.get(row.studentId) ?? {
      student: fullName(row.student),
      className: row.student.class?.name ?? "",
      clubs: [],
    };
    entry.clubs.push(row.club);
    perStudent.set(row.studentId, entry);
  }
  const scope = opts.clubIds ? new Set(opts.clubIds) : null;
  const overLimit: OverLimitRow[] = Array.from(perStudent.entries())
    .filter(([, p]) => p.clubs.length > CLUBS_PER_STUDENT)
    .filter(([, p]) => !scope || p.clubs.some((c) => scope.has(c.id)))
    .map(([studentId, p]) => ({
      studentId,
      student: p.student,
      className: p.className,
      clubs: p.clubs.map((c) => c.name),
    }))
    .sort(byName);

  return {
    mismatches,
    doubleToday,
    overLimit,
    total: mismatches.length + doubleToday.length + overLimit.length,
  };
}
