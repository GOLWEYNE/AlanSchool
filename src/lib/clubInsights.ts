import prisma from "@/lib/prisma";
import { fromWallClock, toWallClock } from "@/lib/schoolTime";
import { addDays, isValidDateStr, schoolToday } from "@/lib/uniform";
import { getClubSupervisors, type ClubSupervisorLite } from "@/lib/clubSupervision";

// "Club insights": who came to the after-school clubs today, how many came on
// every day of a week, a weekly rating for each club, and - inside each club -
// a table by the class the club's students come from, with the club
// supervisor's rating. Everything is read from the club registers supervisors
// already save (ClubSession + ClubAttendance), so nothing new is entered.
//
// "Came" = PRESENT or LATE (the same rule the club attendance page uses).
// A club's rating for a week = came / marked over every meeting that week.
// The supervisor's rating is their club's weekly rating: it is how well the
// students the supervisor is responsible for actually turn up.

export type Tally = { came: number; marked: number; pct: number | null };

export type ClubDay = Tally & { date: string; sessions: number };

export type ClassRow = {
  key: string;
  className: string;
  enrolled: number;
  today: Tally;
  week: Tally;
};

export type ClubInsight = {
  id: number;
  name: string;
  capacity: number;
  enrolled: number;
  supervisors: ClubSupervisorLite[];
  days: ClubDay[];
  week: Tally;
  daysHeld: number;
  todayHeld: boolean;
  today: Tally;
  rank: number | null;
  classes: ClassRow[];
};

export type DayTotal = Tally & {
  date: string;
  clubsMet: number;
  uniqueCame: number;
};

export type TodaySummary = Tally & {
  uniqueCame: number;
  clubsMet: number;
  clubsTotal: number;
  enrolledStudents: number;
};

export type ClubInsights = {
  today: string;
  monday: string;
  weekDays: string[];
  todaySummary: TodaySummary;
  dayTotals: DayTotal[];
  weekTotal: Tally & { uniqueCame: number };
  clubs: ClubInsight[];
};

const pad = (n: number) => String(n).padStart(2, "0");
const schoolDateOf = (d: Date): string => {
  const w = toWallClock(d);
  return `${w.year}-${pad(w.month)}-${pad(w.day)}`;
};
const wallStartOf = (ymd: string): Date =>
  fromWallClock({ year: Number(ymd.slice(0, 4)), month: Number(ymd.slice(5, 7)), day: Number(ymd.slice(8, 10)) });

const tally = (came: number, marked: number): Tally => ({
  came,
  marked,
  pct: marked > 0 ? Math.round((came / marked) * 100) : null,
});

const isCame = (status: string) => status === "PRESENT" || status === "LATE";

// The Monday of the week holding the given date (or today when absent/invalid).
export function resolveClubWeek(raw: string | undefined): { today: string; monday: string } {
  const today = schoolToday();
  const day = isValidDateStr(raw) ? raw : today;
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  return { today, monday: addDays(day, -(weekday === 0 ? 6 : weekday - 1)) };
}

type Acc = { came: number; marked: number };
const acc = (): Acc => ({ came: 0, marked: 0 });

export async function getClubInsights(opts: {
  weekOf?: string;
  // Set for a teacher: only the clubs they supervise. Omit for every club.
  clubIds?: number[];
}): Promise<ClubInsights> {
  const { today, monday } = resolveClubWeek(opts.weekOf);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const weekSet = new Set(weekDays);

  const clubs = await prisma.club.findMany({
    where: opts.clubIds ? { id: { in: opts.clubIds } } : {},
    select: { id: true, name: true, capacity: true },
    orderBy: { name: "asc" },
  });
  const clubIds = clubs.map((c: { id: number }) => c.id);

  const empty: ClubInsights = {
    today,
    monday,
    weekDays,
    todaySummary: { ...tally(0, 0), uniqueCame: 0, clubsMet: 0, clubsTotal: 0, enrolledStudents: 0 },
    dayTotals: weekDays.map((date) => ({ ...tally(0, 0), date, clubsMet: 0, uniqueCame: 0 })),
    weekTotal: { ...tally(0, 0), uniqueCame: 0 },
    clubs: [],
  };
  if (clubIds.length === 0) return empty;

  const weekStart = wallStartOf(monday);
  const weekEnd = wallStartOf(addDays(monday, 7));
  const todayStart = wallStartOf(today);
  const todayEnd = wallStartOf(addDays(today, 1));

  const [enrollments, sessions, supervisors] = await Promise.all([
    prisma.clubEnrollment.findMany({
      where: { clubId: { in: clubIds }, status: "ACTIVE" },
      select: {
        clubId: true,
        studentId: true,
        student: { select: { classId: true, class: { select: { name: true } } } },
      },
    }),
    prisma.clubSession.findMany({
      where: {
        clubId: { in: clubIds },
        OR: [
          { date: { gte: weekStart, lt: weekEnd } },
          { date: { gte: todayStart, lt: todayEnd } },
        ],
      },
      select: {
        clubId: true,
        date: true,
        attendances: {
          select: {
            studentId: true,
            status: true,
            student: { select: { classId: true, class: { select: { name: true } } } },
          },
        },
      },
    }),
    getClubSupervisors(clubIds),
  ]);

  type StudentClass = { classId: number | null; class: { name: string } | null };
  const classKey = (s: StudentClass | null | undefined) => (s?.classId != null ? String(s.classId) : "none");
  const className = (s: StudentClass | null | undefined) => s?.class?.name ?? "";

  // Per-club accumulators ----------------------------------------------------
  type ClubAcc = {
    enrolled: Set<string>;
    days: Map<string, { sessions: number; acc: Acc }>;
    today: Acc;
    todayHeld: boolean;
    classes: Map<
      string,
      { name: string; enrolled: Set<string>; today: Acc; week: Acc }
    >;
  };
  const byClub = new Map<number, ClubAcc>();
  for (const id of clubIds) {
    byClub.set(id, { enrolled: new Set(), days: new Map(), today: acc(), todayHeld: false, classes: new Map() });
  }
  const classOf = (c: ClubAcc, s: StudentClass | null | undefined) => {
    const key = classKey(s);
    let row = c.classes.get(key);
    if (!row) {
      row = { name: className(s), enrolled: new Set(), today: acc(), week: acc() };
      c.classes.set(key, row);
    }
    return row;
  };

  const allEnrolled = new Set<string>();
  for (const e of enrollments as { clubId: number; studentId: string; student: StudentClass }[]) {
    const c = byClub.get(e.clubId);
    if (!c) continue;
    c.enrolled.add(e.studentId);
    allEnrolled.add(e.studentId);
    classOf(c, e.student).enrolled.add(e.studentId);
  }

  // School-wide per-day tallies.
  const dayAll = new Map<string, { acc: Acc; clubs: Set<number>; people: Set<string> }>();
  for (const d of weekDays) dayAll.set(d, { acc: acc(), clubs: new Set(), people: new Set() });
  const todayAll = { acc: acc(), clubs: new Set<number>(), people: new Set<string>() };
  const weekPeople = new Set<string>();

  for (const s of sessions as {
    clubId: number;
    date: Date;
    attendances: { studentId: string; status: string; student: StudentClass }[];
  }[]) {
    const c = byClub.get(s.clubId);
    if (!c) continue;
    const day = schoolDateOf(s.date);
    const inWeek = weekSet.has(day);
    const isToday = day === today;

    for (const a of s.attendances) {
      const came = isCame(a.status);
      const cls = classOf(c, a.student);
      if (inWeek) {
        const d = c.days.get(day) ?? { sessions: 0, acc: acc() };
        d.acc.marked += 1;
        if (came) d.acc.came += 1;
        c.days.set(day, d);
        cls.week.marked += 1;
        if (came) cls.week.came += 1;

        const all = dayAll.get(day);
        if (all) {
          all.acc.marked += 1;
          if (came) {
            all.acc.came += 1;
            all.people.add(a.studentId);
            weekPeople.add(a.studentId);
          }
        }
      }
      if (isToday) {
        c.today.marked += 1;
        cls.today.marked += 1;
        todayAll.acc.marked += 1;
        if (came) {
          c.today.came += 1;
          cls.today.came += 1;
          todayAll.acc.came += 1;
          todayAll.people.add(a.studentId);
        }
      }
    }

    if (inWeek) {
      const d = c.days.get(day) ?? { sessions: 0, acc: acc() };
      d.sessions += 1;
      c.days.set(day, d);
      dayAll.get(day)?.clubs.add(s.clubId);
    }
    if (isToday) {
      c.todayHeld = true;
      todayAll.clubs.add(s.clubId);
    }
  }

  // Build the per-club result ------------------------------------------------
  const insights: ClubInsight[] = clubs.map((club: { id: number; name: string; capacity: number }) => {
    const c = byClub.get(club.id) as ClubAcc;
    const days: ClubDay[] = weekDays.map((date) => {
      const d = c.days.get(date);
      return { date, sessions: d?.sessions ?? 0, ...tally(d?.acc.came ?? 0, d?.acc.marked ?? 0) };
    });
    const weekCame = days.reduce((s, d) => s + d.came, 0);
    const weekMarked = days.reduce((s, d) => s + d.marked, 0);
    const classes: ClassRow[] = Array.from(c.classes.entries())
      .map(([key, r]) => ({
        key,
        className: r.name,
        enrolled: r.enrolled.size,
        today: tally(r.today.came, r.today.marked),
        week: tally(r.week.came, r.week.marked),
      }))
      .sort((a, b) => {
        if (!a.className) return 1;
        if (!b.className) return -1;
        return a.className.localeCompare(b.className, undefined, { numeric: true });
      });
    return {
      id: club.id,
      name: club.name,
      capacity: club.capacity,
      enrolled: c.enrolled.size,
      supervisors: supervisors.get(club.id) ?? [],
      days,
      week: tally(weekCame, weekMarked),
      daysHeld: days.filter((d) => d.sessions > 0).length,
      todayHeld: c.todayHeld,
      today: tally(c.today.came, c.today.marked),
      rank: null,
      classes,
    };
  });

  // Rank by weekly rating (clubs with no register that week are unranked).
  const ranked = insights
    .filter((c) => c.week.pct !== null)
    .sort((a, b) => (b.week.pct as number) - (a.week.pct as number) || b.week.came - a.week.came);
  let lastPct: number | null = null;
  let lastRank = 0;
  ranked.forEach((c, i) => {
    if (c.week.pct !== lastPct) {
      lastRank = i + 1;
      lastPct = c.week.pct;
    }
    c.rank = lastRank;
  });
  insights.sort((a, b) => {
    if (a.rank === null && b.rank === null) return a.name.localeCompare(b.name);
    if (a.rank === null) return 1;
    if (b.rank === null) return -1;
    return a.rank - b.rank || a.name.localeCompare(b.name);
  });

  const dayTotals: DayTotal[] = weekDays.map((date) => {
    const d = dayAll.get(date) as { acc: Acc; clubs: Set<number>; people: Set<string> };
    return { date, clubsMet: d.clubs.size, uniqueCame: d.people.size, ...tally(d.acc.came, d.acc.marked) };
  });
  const weekCame = dayTotals.reduce((s, d) => s + d.came, 0);
  const weekMarked = dayTotals.reduce((s, d) => s + d.marked, 0);

  return {
    today,
    monday,
    weekDays,
    todaySummary: {
      ...tally(todayAll.acc.came, todayAll.acc.marked),
      uniqueCame: todayAll.people.size,
      clubsMet: todayAll.clubs.size,
      clubsTotal: clubs.length,
      enrolledStudents: allEnrolled.size,
    },
    dayTotals,
    weekTotal: { ...tally(weekCame, weekMarked), uniqueCame: weekPeople.size },
    clubs: insights,
  };
}
