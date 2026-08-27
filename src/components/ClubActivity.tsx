import prisma from "@/lib/prisma";

const CATEGORY_META: Record<
  string,
  { emoji: string; gradient: string; track: string }
> = {
  DANCING: { emoji: "\u{1F483}", gradient: "from-pink-400 to-rose-500", track: "bg-pink-100 dark:bg-pink-950/40" },
  PIANO: { emoji: "\u{1F3B9}", gradient: "from-violet-400 to-purple-500", track: "bg-purple-100 dark:bg-purple-950/40" },
  CHESS: { emoji: "\u{265F}\u{FE0F}", gradient: "from-slate-400 to-slate-600", track: "bg-slate-100 dark:bg-slate-800" },
  HANDICRAFTS: { emoji: "\u{1F9F6}", gradient: "from-amber-400 to-orange-500", track: "bg-amber-100 dark:bg-amber-950/40" },
  FOOTBALL: { emoji: "\u{26BD}", gradient: "from-emerald-400 to-teal-500", track: "bg-emerald-100 dark:bg-emerald-950/40" },
  VOLLEYBALL: { emoji: "\u{1F3D0}", gradient: "from-sky-400 to-blue-500", track: "bg-sky-100 dark:bg-sky-950/40" },
  BASKETBALL: { emoji: "\u{1F3C0}", gradient: "from-orange-400 to-red-500", track: "bg-orange-100 dark:bg-orange-950/40" },
  TENNIS: { emoji: "\u{1F3BE}", gradient: "from-lime-400 to-green-500", track: "bg-lime-100 dark:bg-lime-950/40" },
};

const DEFAULT_META = { emoji: "\u{1F3AF}", gradient: "from-blue-400 to-indigo-500", track: "bg-blue-100 dark:bg-blue-950/40" };

const formatSessionDate = (date: Date) => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfDate.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "2-digit", month: "short" }).format(date);
};

const formatTime = (date: Date) =>
  date.toLocaleTimeString("en-UK", { hour: "2-digit", minute: "2-digit", hour12: false });

const ClubActivity = async () => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [clubs, upcomingSessions] = await Promise.all([
    prisma.club.findMany({
      include: {
        instructor: { select: { name: true, surname: true } },
        _count: { select: { enrollments: { where: { status: "ACTIVE" } } } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.clubSession.findMany({
      where: { date: { gte: startOfToday } },
      include: { club: { select: { name: true, category: true } } },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      take: 4,
    }),
  ]);

  const totalEnrolled = clubs.reduce(
    (sum: number, c: (typeof clubs)[number]) => sum + c._count.enrollments,
    0
  );
  const topClubs = [...clubs]
    .sort((a, b) => b._count.enrollments - a._count.enrollments)
    .slice(0, 5);

  return (
    <div className="panel-card shine-hover relative overflow-hidden p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="circle-icon-btn !w-11 !h-11 shrink-0">
            <span className="text-lg leading-none">{"\u{1F3AF}"}</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-blue-900 dark:text-blue-100">Club Activity</h1>
            <p className="text-xs text-blue-500 dark:text-slate-400">
              {clubs.length} club{clubs.length === 1 ? "" : "s"} · {totalEnrolled} student{totalEnrolled === 1 ? "" : "s"} enrolled
            </p>
          </div>
        </div>
      </div>

      {clubs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-blue-100 dark:border-slate-800 p-6 text-center">
          <p className="text-sm text-gray-400 dark:text-slate-500">No clubs set up yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {topClubs.map((club) => {
            const meta = CATEGORY_META[club.category] ?? DEFAULT_META;
            const enrolled = club._count.enrollments;
            const fillPct = club.capacity > 0 ? Math.min(100, Math.round((enrolled / club.capacity) * 100)) : 0;
            const instructorName = club.instructor
              ? `${club.instructor.name} ${club.instructor.surname}`
              : "Instructor TBD";
            return (
              <div key={club.id} className="flex items-center gap-3">
                <span className="text-base leading-none w-6 text-center shrink-0">{meta.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-gray-700 dark:text-blue-100 truncate">
                      {club.name}
                    </span>
                    <span className="shrink-0 text-[11px] font-medium text-gray-400 dark:text-slate-500">
                      {enrolled}/{club.capacity}
                    </span>
                  </div>
                  <div className={`mt-1 h-1.5 w-full rounded-full ${meta.track} overflow-hidden`}>
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${meta.gradient}`}
                      style={{ width: `${fillPct}%` }}
                    />
                  </div>
                  <p className="mt-0.5 text-[11px] text-gray-400 dark:text-slate-500 truncate">{instructorName}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-5 pt-4 border-t border-blue-50 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2.5">Upcoming Sessions</h2>
        {upcomingSessions.length === 0 ? (
          <p className="text-xs text-gray-400 dark:text-slate-500">No sessions scheduled.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {upcomingSessions.map((session: (typeof upcomingSessions)[number]) => {
              const meta = CATEGORY_META[session.club.category] ?? DEFAULT_META;
              return (
                <div
                  key={session.id}
                  className="flex items-center gap-3 rounded-lg bg-blue-50/50 dark:bg-slate-800/40 px-3 py-2"
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 bg-gradient-to-br ${meta.gradient}`}
                  />
                  <span className="text-xs font-medium text-gray-700 dark:text-blue-100 truncate flex-1">
                    {session.club.name}
                  </span>
                  <span className="shrink-0 text-[11px] text-gray-500 dark:text-slate-400 whitespace-nowrap">
                    {formatSessionDate(session.date)} · {formatTime(session.startTime)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClubActivity;
