import Image from "next/image";
import prisma from "@/lib/prisma";

type Role = "admin" | "teacher" | "student" | "parent";

type ResultRow = {
  id: number;
  score: number;
  studentId: string;
  studentName: string;
  img: string | null;
  title: string;
  subject: string | null;
  totalMarks: number | null;
};

const ClassLeaderboard = async ({
  role,
  teacherId,
  studentIds,
}: {
  role: Role;
  teacherId?: string;
  studentIds?: string[];
}) => {
  const isRoleGroup = role === "admin" || role === "teacher";

  if (!isRoleGroup && (!studentIds || studentIds.length === 0)) {
    return (
      <div className="rounded-2xl p-5 text-white shine-hover bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 shadow-lg">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          🏆 Recent Highlights
        </h1>
        <p className="mt-4 text-sm text-white/90">
          No results recorded yet.
        </p>
      </div>
    );
  }

  const where =
    role === "teacher" && teacherId
      ? {
          OR: [
            { exam: { lesson: { teacherId } } },
            { assignment: { lesson: { teacherId } } },
          ],
        }
      : !isRoleGroup && studentIds
      ? { studentId: { in: studentIds } }
      : {};

  const rawResults = await prisma.result.findMany({
    where,
    select: {
      id: true,
      score: true,
      studentId: true,
      student: { select: { name: true, surname: true, img: true } },
      exam: {
        select: {
          title: true,
          totalMarks: true,
          lesson: { select: { subject: { select: { name: true } } } },
        },
      },
      assignment: {
        select: {
          title: true,
          totalMarks: true,
          lesson: { select: { subject: { select: { name: true } } } },
        },
      },
    },
    orderBy: { id: "desc" },
    take: 100,
  });

  const rows: ResultRow[] = rawResults.flatMap((r) => {
    const source = r.exam ?? r.assignment;
    if (!source) return [];
    const row: ResultRow = {
      id: r.id,
      score: r.score,
      studentId: r.studentId,
      studentName: `${r.student.name} ${r.student.surname}`,
      img: r.student.img,
      title: source.title,
      subject: source.lesson?.subject?.name ?? null,
      totalMarks: source.totalMarks,
    };
    return [row];
  });

  const percentage = (r: ResultRow) =>
    r.totalMarks ? Math.round((r.score / r.totalMarks) * 100) : null;

  if (isRoleGroup) {
    const bestPerStudent = new Map<string, ResultRow>();
    rows.forEach((r) => {
      const existing = bestPerStudent.get(r.studentId);
      const rScore = percentage(r) ?? r.score;
      const existingScore = existing
        ? percentage(existing) ?? existing.score
        : -Infinity;
      if (!existing || rScore > existingScore) {
        bestPerStudent.set(r.studentId, r);
      }
    });

    const leaderboard = Array.from(bestPerStudent.values())
      .sort(
        (a, b) => (percentage(b) ?? b.score) - (percentage(a) ?? a.score)
      )
      .slice(0, 5);

    const medals = ["🥇", "🥈", "🥉"];

    return (
      <div className="relative overflow-hidden rounded-2xl p-5 text-white shine-hover bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 shadow-lg">
        <div className="relative flex items-center justify-between">
          <h1 className="text-xl font-semibold flex items-center gap-2">
            🏆 Recent Highlights
          </h1>
        </div>
        {leaderboard.length > 0 ? (
          <div className="relative mt-4 flex flex-col gap-2">
            {leaderboard.map((r, idx) => {
              const pct = percentage(r);
              return (
                <div
                  key={r.studentId}
                  className="flex items-center gap-3 rounded-xl bg-white/15 p-3 backdrop-blur-sm"
                >
                  <span className="text-lg w-6 text-center shrink-0">
                    {medals[idx] ?? idx + 1}
                  </span>
                  <Image
                    src={r.img || "/Alan.png"}
                    alt=""
                    width={36}
                    height={36}
                    className="w-9 h-9 rounded-full object-cover ring-2 ring-white/80 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h2 className="font-semibold text-sm truncate">
                      {r.studentName}
                    </h2>
                    <p className="text-xs text-white/80 truncate">
                      {[r.subject, r.title].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <span className="text-xs bg-white/20 rounded-full px-2 py-1 font-semibold whitespace-nowrap">
                    {pct !== null ? `${pct}%` : `${r.score} pts`}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="relative mt-4 text-sm text-white/90">
            No results recorded yet.
          </p>
        )}
      </div>
    );
  }

  const byStudent = new Map<string, ResultRow[]>();
  rows.forEach((r) => {
    const list = byStudent.get(r.studentId) ?? [];
    list.push(r);
    byStudent.set(r.studentId, list);
  });

  const childIds = studentIds ?? [];
  const hasAnyResults = childIds.some((sid) => byStudent.get(sid)?.length);

  return (
    <div className="relative overflow-hidden rounded-2xl p-5 text-white shine-hover bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 shadow-lg">
      <div className="relative flex items-center justify-between">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          🏆 Recent Highlights
        </h1>
      </div>
      <div className="relative mt-4 flex flex-col gap-3">
        {childIds.map((sid) => {
          const list = (byStudent.get(sid) ?? []).sort(
            (a, b) => (percentage(b) ?? b.score) - (percentage(a) ?? a.score)
          );
          const best = list[0];
          if (!best) return null;
          const pct = percentage(best);
          return (
            <div
              key={sid}
              className="flex items-center gap-3 rounded-xl bg-white/15 p-3 backdrop-blur-sm"
            >
              <Image
                src={best.img || "/Alan.png"}
                alt=""
                width={40}
                height={40}
                className="w-10 h-10 rounded-full object-cover ring-2 ring-white/80 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-sm truncate">
                  {best.studentName}
                </h2>
                <p className="text-xs text-white/80 truncate">
                  Best recently:{" "}
                  {[best.subject, best.title].filter(Boolean).join(" · ")}
                </p>
              </div>
              <span className="text-xs bg-white/20 rounded-full px-2 py-1 font-semibold whitespace-nowrap">
                {pct !== null ? `${pct}%` : `${best.score} pts`}
              </span>
            </div>
          );
        })}
        {!hasAnyResults && (
          <p className="text-sm text-white/90">No results recorded yet.</p>
        )}
      </div>
    </div>
  );
};

export default ClassLeaderboard;
