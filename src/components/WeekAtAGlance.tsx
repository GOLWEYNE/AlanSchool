import prisma from "@/lib/prisma";

type Role = "admin" | "teacher" | "student" | "parent";

type AgendaItem = {
  id: string;
  type: "exam" | "assignment" | "event";
  title: string;
  subtitle: string | null;
  when: Date;
};

const TYPE_META: Record<
  AgendaItem["type"],
  { icon: string; label: string; chip: string }
> = {
  exam: { icon: "📝", label: "Exam", chip: "bg-rose-200 text-rose-900" },
  assignment: {
    icon: "📚",
    label: "Assignment",
    chip: "bg-indigo-200 text-indigo-900",
  },
  event: {
    icon: "🗓️",
    label: "Event",
    chip: "bg-emerald-200 text-emerald-900",
  },
};

const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());

const formatRelativeDay = (when: Date, now: Date) => {
  const diffDays = Math.round(
    (startOfDay(when).getTime() - startOfDay(now).getTime()) /
      (1000 * 60 * 60 * 24)
  );
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return `In ${diffDays} days`;
};

const WeekAtAGlance = async ({
  role,
  teacherId,
  classIds,
}: {
  role: Role;
  teacherId?: string;
  classIds?: number[];
}) => {
  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const scopedClassIds =
    role === "teacher" && teacherId
      ? (
          await prisma.lesson.findMany({
            where: { teacherId },
            select: { classId: true },
            distinct: ["classId"],
          })
        ).map((l) => l.classId)
      : classIds;

  const hasNoScope =
    (role === "teacher" && !teacherId) ||
    ((role === "student" || role === "parent") && !scopedClassIds?.length);

  const lessonScope =
    role === "teacher" && teacherId
      ? { teacherId }
      : (role === "student" || role === "parent") && scopedClassIds?.length
      ? { classId: { in: scopedClassIds } }
      : undefined;

  const eventWhere = hasNoScope
    ? { id: -1 }
    : {
        startTime: { gte: now, lte: weekAhead },
        ...(role === "admin"
          ? {}
          : { OR: [{ classId: null }, { classId: { in: scopedClassIds } }] }),
      };

  const [exams, assignments, events] = hasNoScope
    ? [[], [], []]
    : await prisma.$transaction([
        prisma.exam.findMany({
          where: {
            startTime: { gte: now, lte: weekAhead },
            lesson: lessonScope,
          },
          select: {
            id: true,
            title: true,
            startTime: true,
            lesson: {
              select: {
                subject: { select: { name: true } },
                class: { select: { name: true } },
              },
            },
          },
          take: 20,
        }),
        prisma.assignment.findMany({
          where: {
            dueDate: { gte: now, lte: weekAhead },
            lesson: lessonScope,
          },
          select: {
            id: true,
            title: true,
            dueDate: true,
            lesson: {
              select: {
                subject: { select: { name: true } },
                class: { select: { name: true } },
              },
            },
          },
          take: 20,
        }),
        prisma.event.findMany({
          where: eventWhere,
          select: {
            id: true,
            title: true,
            startTime: true,
            class: { select: { name: true } },
          },
          take: 20,
        }),
      ]);

  const items: AgendaItem[] = [
    ...exams.map((e) => ({
      id: `exam-${e.id}`,
      type: "exam" as const,
      title: e.title,
      subtitle:
        [e.lesson?.subject?.name, e.lesson?.class?.name]
          .filter(Boolean)
          .join(" · ") || null,
      when: e.startTime,
    })),
    ...assignments.map((a) => ({
      id: `assignment-${a.id}`,
      type: "assignment" as const,
      title: a.title,
      subtitle:
        [a.lesson?.subject?.name, a.lesson?.class?.name]
          .filter(Boolean)
          .join(" · ") || null,
      when: a.dueDate,
    })),
    ...events.map((ev) => ({
      id: `event-${ev.id}`,
      type: "event" as const,
      title: ev.title,
      subtitle: ev.class?.name ?? "Whole school",
      when: ev.startTime,
    })),
  ]
    .sort((a, b) => a.when.getTime() - b.when.getTime())
    .slice(0, 6);

  return (
    <div className="relative overflow-hidden rounded-2xl p-5 text-white shine-hover bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 shadow-lg">
      <div className="relative flex items-center justify-between">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          📅 This Week
        </h1>
        <span className="text-xs bg-white/20 rounded-full px-2 py-1">
          Next 7 days
        </span>
      </div>

      {items.length > 0 ? (
        <div className="relative mt-4 flex flex-col gap-2">
          {items.map((item) => {
            const meta = TYPE_META[item.type];
            return (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-xl bg-white/15 p-3 backdrop-blur-sm"
              >
                <span className="text-xl shrink-0">{meta.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-semibold text-sm truncate">
                      {item.title}
                    </h2>
                    <span
                      className={`text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5 font-semibold ${meta.chip}`}
                    >
                      {meta.label}
                    </span>
                  </div>
                  {item.subtitle && (
                    <p className="text-xs text-white/80 truncate">
                      {item.subtitle}
                    </p>
                  )}
                </div>
                <span className="text-[11px] text-white/90 whitespace-nowrap font-medium">
                  {formatRelativeDay(item.when, now)}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="relative mt-4 text-sm text-white/90">
          Nothing on the calendar for the next 7 days. Enjoy the quiet 🌤️
        </p>
      )}
    </div>
  );
};

export default WeekAtAGlance;
