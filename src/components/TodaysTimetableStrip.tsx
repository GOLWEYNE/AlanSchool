import prisma from "@/lib/prisma";
import { Day } from "@/generated/prisma/client";
import LiveCountdown from "./LiveCountdown";

type Role = "admin" | "teacher" | "student" | "parent";

const dayMap: Record<number, Day | null> = {
  0: null,
  1: Day.MONDAY,
  2: Day.TUESDAY,
  3: Day.WEDNESDAY,
  4: Day.THURSDAY,
  5: Day.FRIDAY,
  6: null,
};

const wrapperClass =
  "relative overflow-hidden rounded-2xl p-5 text-white shine-hover bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 shadow-lg";

const Header = ({ badge }: { badge?: { label: string; live?: boolean } }) => (
  <div className="relative flex items-center justify-between">
    <h1 className="text-xl font-semibold flex items-center gap-2">
      🕒 Today&apos;s Timetable
    </h1>
    {badge && (
      <span
        className={`text-[10px] uppercase tracking-wide rounded-full px-2 py-1 font-semibold ${
          badge.live ? "bg-white text-emerald-700" : "bg-white/20"
        }`}
      >
        {badge.label}
      </span>
    )}
  </div>
);

const EmptyState = ({ emoji, text }: { emoji: string; text: string }) => (
  <div className={wrapperClass}>
    <Header />
    <p className="relative mt-4 text-sm text-white/90">
      {emoji} {text}
    </p>
  </div>
);

const formatTime = (d: Date) =>
  d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

// Compact "next class" card for the dashboard sidebar: shows whichever
// lesson is happening right now (or the next one still to come) for
// today only, with room and a live countdown. Sits above WeekAtAGlance
// on all four dashboards.
const TodaysTimetableStrip = async ({
  role,
  teacherId,
  classIds,
}: {
  role: Role;
  teacherId?: string;
  classIds?: number[];
}) => {
  const now = new Date();
  const today = dayMap[now.getDay()];

  if (!today) {
    return <EmptyState emoji="🌴" text="No classes today — enjoy the weekend!" />;
  }

  const hasNoScope =
    (role === "teacher" && !teacherId) ||
    ((role === "student" || role === "parent") && !classIds?.length);

  if (hasNoScope) {
    return <EmptyState emoji="🗓️" text="No timetable set up yet." />;
  }

  const where =
    role === "teacher" && teacherId
      ? { day: today, teacherId }
      : (role === "student" || role === "parent") && classIds?.length
      ? { day: today, classId: { in: classIds } }
      : { day: today };

  const lessons = await prisma.lesson.findMany({
    where,
    select: {
      id: true,
      name: true,
      startTime: true,
      endTime: true,
      room: true,
      subject: { select: { name: true } },
      class: { select: { name: true } },
      teacher: { select: { name: true, surname: true } },
    },
    orderBy: { startTime: "asc" },
  });

  // Lesson.startTime/endTime store an arbitrary date - only the
  // time-of-day is meaningful (same convention as BigCalendarContainer /
  // adjustScheduleToCurrentWeek) - so project each onto today's date.
  const onToday = (d: Date) => {
    const projected = new Date(now);
    projected.setHours(d.getHours(), d.getMinutes(), d.getSeconds(), 0);
    return projected;
  };

  const normalized = lessons.map((lesson) => ({
    ...lesson,
    start: onToday(lesson.startTime),
    end: onToday(lesson.endTime),
  }));

  const current = normalized.find((l) => l.start <= now && now < l.end);
  const next = normalized.find((l) => l.start > now);
  const active = current ?? next;

  if (!active) {
    return normalized.length > 0 ? (
      <EmptyState emoji="✅" text="That's it for today's classes!" />
    ) : (
      <EmptyState emoji="🗓️" text="No classes scheduled today." />
    );
  }

  const isLive = !!current;
  const subjectLabel = active.subject?.name ?? active.name;
  const contextLabel =
    role === "student" || role === "parent"
      ? [active.teacher?.name, active.teacher?.surname].filter(Boolean).join(" ")
      : active.class?.name;

  return (
    <div className={wrapperClass}>
      <Header badge={{ label: isLive ? "In progress" : "Next class", live: isLive }} />
      <div className="relative mt-4 flex items-center gap-3 rounded-xl bg-white/15 p-3 backdrop-blur-sm">
        <span className="text-xl shrink-0">📚</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-semibold text-sm truncate">{subjectLabel}</h2>
            {contextLabel && (
              <span className="text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5 font-semibold bg-white/20">
                {contextLabel}
              </span>
            )}
          </div>
          <p className="text-xs text-white/80 truncate">
            {active.room ? `Room ${active.room}` : "Room TBD"} · {formatTime(active.start)}–{formatTime(active.end)}
          </p>
        </div>
        <LiveCountdown
          target={(isLive ? active.end : active.start).toISOString()}
          prefix={isLive ? "ends in" : "starts in"}
        />
      </div>
    </div>
  );
};

export default TodaysTimetableStrip;
