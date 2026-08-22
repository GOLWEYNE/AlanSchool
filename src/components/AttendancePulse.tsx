import Image from "next/image";
import prisma from "@/lib/prisma";

type Role = "admin" | "teacher" | "student" | "parent";

type AttendanceScope =
  | { kind: "all" }
  | { kind: "teacher"; teacherId: string }
  | { kind: "students"; studentIds: string[] };

const buildWhere = (scope: AttendanceScope, extra: Record<string, unknown>) => {
  if (scope.kind === "teacher") {
    return { ...extra, lesson: { teacherId: scope.teacherId } };
  }
  if (scope.kind === "students") {
    return { ...extra, studentId: { in: scope.studentIds } };
  }
  return extra;
};

const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());

const AttendancePulse = async ({
  role,
  teacherId,
  studentIds,
}: {
  role: Role;
  teacherId?: string;
  studentIds?: string[];
}) => {
  const scope: AttendanceScope =
    role === "teacher" && teacherId
      ? { kind: "teacher", teacherId }
      : (role === "student" || role === "parent") && studentIds?.length
      ? { kind: "students", studentIds }
      : role === "admin"
      ? { kind: "all" }
      : { kind: "students", studentIds: [] };

  const now = new Date();
  const today = startOfDay(now);
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);

  if (scope.kind === "students" && scope.studentIds.length === 0) {
    return (
      <div className="rounded-2xl p-5 text-white shine-hover bg-gradient-to-br from-sky-500 via-cyan-500 to-blue-600 shadow-lg">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          📊 Attendance Pulse
        </h1>
        <p className="mt-4 text-sm text-white/90">
          No attendance data available yet.
        </p>
      </div>
    );
  }

  const records = await prisma.attendance.findMany({
    where: buildWhere(scope, { date: { gte: twoWeeksAgo } }),
    select: {
      date: true,
      present: true,
      studentId: true,
      student: { select: { name: true, surname: true, img: true } },
    },
    orderBy: { date: "desc" },
  });

  const isRoleGroup = role === "admin" || role === "teacher";

  const thisWeek = records.filter((r) => r.date >= sevenDaysAgo);
  const lastWeek = records.filter(
    (r) => r.date >= twoWeeksAgo && r.date < sevenDaysAgo
  );

  const rate = (list: typeof records) =>
    list.length
      ? Math.round(
          (list.filter((r) => r.present).length / list.length) * 100
        )
      : null;

  const thisWeekRate = rate(thisWeek);
  const lastWeekRate = rate(lastWeek);
  const trend =
    thisWeekRate !== null && lastWeekRate !== null
      ? thisWeekRate - lastWeekRate
      : null;

  let atRisk: {
    studentId: string;
    name: string;
    img: string | null;
    absences: number;
  }[] = [];

  if (isRoleGroup) {
    const absenceCounts = new Map<
      string,
      { name: string; img: string | null; absences: number }
    >();
    records.forEach((r) => {
      if (!r.present) {
        const prev = absenceCounts.get(r.studentId);
        const name = `${r.student.name} ${r.student.surname}`;
        if (prev) {
          prev.absences += 1;
        } else {
          absenceCounts.set(r.studentId, {
            name,
            img: r.student.img,
            absences: 1,
          });
        }
      }
    });
    atRisk = Array.from(absenceCounts.entries())
      .map(([studentId, v]) => ({ studentId, ...v }))
      .filter((s) => s.absences >= 3)
      .sort((a, b) => b.absences - a.absences)
      .slice(0, 4);
  }

  const computeStreak = (studentId: string) => {
    const studentRecords = records
      .filter((r) => r.studentId === studentId)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
    let streak = 0;
    for (const r of studentRecords) {
      if (r.present) streak += 1;
      else break;
    }
    return streak;
  };

  const perStudent =
    !isRoleGroup && studentIds
      ? studentIds.map((id) => {
          const rec = records.find((r) => r.studentId === id);
          return {
            studentId: id,
            name: rec ? `${rec.student.name} ${rec.student.surname}` : "Student",
            img: rec?.student.img ?? null,
            streak: computeStreak(id),
            rate: rate(records.filter((r) => r.studentId === id && r.date >= sevenDaysAgo)),
          };
        })
      : [];

  const trendLabel =
    trend === null
      ? null
      : trend === 0
      ? "Steady vs last week"
      : trend > 0
      ? `▲ ${trend}pts vs last week`
      : `▼ ${Math.abs(trend)}pts vs last week`;

  return (
    <div className="relative overflow-hidden rounded-2xl p-5 text-white shine-hover bg-gradient-to-br from-sky-500 via-cyan-500 to-blue-600 shadow-lg">
      <div className="relative flex items-center justify-between">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          📊 Attendance Pulse
        </h1>
        {trendLabel && (
          <span className="text-xs bg-white/20 rounded-full px-2 py-1">
            {trendLabel}
          </span>
        )}
      </div>

      {isRoleGroup ? (
        <>
          <div className="relative mt-4 flex items-end gap-2">
            <span className="text-4xl font-bold">
              {thisWeekRate !== null ? `${thisWeekRate}%` : "—"}
            </span>
            <span className="text-sm text-white/80 mb-1">this week</span>
          </div>
          {atRisk.length > 0 ? (
            <div className="relative mt-4">
              <p className="text-xs uppercase tracking-wide text-white/80 mb-2">
                Needs attention
              </p>
              <div className="flex flex-col gap-2">
                {atRisk.map((s) => (
                  <div
                    key={s.studentId}
                    className="flex items-center gap-3 rounded-xl bg-white/15 p-2 backdrop-blur-sm"
                  >
                    <Image
                      src={s.img || "/Alan.png"}
                      alt=""
                      width={32}
                      height={32}
                      className="w-8 h-8 rounded-full object-cover ring-2 ring-white/70 shrink-0"
                    />
                    <span className="flex-1 text-sm font-medium truncate">
                      {s.name}
                    </span>
                    <span className="text-[11px] bg-red-500/80 rounded-full px-2 py-0.5 font-semibold whitespace-nowrap">
                      {s.absences} absences
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="relative mt-4 text-sm text-white/90">
              No students with repeated absences in the last two weeks 🎉
            </p>
          )}
        </>
      ) : (
        <div className="relative mt-4 flex flex-col gap-3">
          {perStudent.map((s) => (
            <div
              key={s.studentId}
              className="flex items-center gap-3 rounded-xl bg-white/15 p-3 backdrop-blur-sm"
            >
              <Image
                src={s.img || "/Alan.png"}
                alt=""
                width={40}
                height={40}
                className="w-10 h-10 rounded-full object-cover ring-2 ring-white/80 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-sm truncate">{s.name}</h2>
                <p className="text-xs text-white/80">
                  {s.rate !== null ? `${s.rate}% this week` : "No records yet"}
                </p>
              </div>
              {s.streak > 0 && (
                <span className="text-[11px] bg-white/20 rounded-full px-2 py-1 font-semibold whitespace-nowrap">
                  🔥 {s.streak}d streak
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AttendancePulse;
