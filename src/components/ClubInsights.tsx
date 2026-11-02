import Link from "next/link";
import { fmtDay, ScoreRing, toneOf } from "@/components/LessonMonitoring";
import type { ClassRow, ClubInsight, ClubInsights, Tally } from "@/lib/clubInsights";
import type { ClubInsightsLabels } from "@/lib/clubInsightsLabels";
import type { ClubIntegrity } from "@/lib/clubIntegrity";
import { fill, type ClubRulesLabels } from "@/lib/clubRulesLabels";

// Presentational pieces of the Club insights page. All server components: the
// only interactivity is links and native <details> toggles.

type ToneKey = "great" | "fair" | "low" | "none";

const TONE: Record<ToneKey, { text: string; bar: string; soft: string; border: string; chip: string }> = {
  great: {
    text: "text-emerald-600 dark:text-emerald-400",
    bar: "bg-emerald-500",
    soft: "bg-emerald-50 dark:bg-emerald-950/30",
    border: "border-emerald-200 dark:border-emerald-900/60",
    chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  fair: {
    text: "text-amber-600 dark:text-amber-400",
    bar: "bg-amber-400",
    soft: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-200 dark:border-amber-900/60",
    chip: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  },
  low: {
    text: "text-rose-600 dark:text-rose-400",
    bar: "bg-rose-500",
    soft: "bg-rose-50 dark:bg-rose-950/30",
    border: "border-rose-200 dark:border-rose-900/60",
    chip: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  },
  none: {
    text: "text-slate-400 dark:text-slate-500",
    bar: "bg-slate-300 dark:bg-slate-600",
    soft: "bg-slate-50 dark:bg-slate-800/40",
    border: "border-slate-200 dark:border-slate-700",
    chip: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  },
};

const CARD = "rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";

const pctText = (pct: number | null) => (pct === null ? "-" : `${pct}%`);
const toneFor = (pct: number | null) => TONE[toneOf(pct)];

const RateBar = ({ pct, className = "" }: { pct: number | null; className?: string }) => (
  <div className={`h-2 overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-700/60 ${className}`}>
    <div className={`h-full rounded-full ${toneFor(pct).bar}`} style={{ width: `${pct ?? 0}%` }} />
  </div>
);

const RateChip = ({ pct }: { pct: number | null }) => (
  <span className={`inline-block min-w-[3.25rem] rounded-full px-2.5 py-1 text-center text-xs font-bold ${toneFor(pct).chip}`}>
    {pctText(pct)}
  </span>
);

const RankBadge = ({ rank }: { rank: number | null }) => {
  if (rank === null) return <span className="text-slate-300">-</span>;
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
  return medal ? (
    <span className="text-lg" aria-label={`#${rank}`}>
      {medal}
    </span>
  ) : (
    <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">{rank}</span>
  );
};

// --- Week navigation ---------------------------------------------------------

export const WeekNav = ({
  L,
  locale,
  data,
  prevHref,
  nextHref,
  thisWeekHref,
  isCurrentWeek,
}: {
  L: ClubInsightsLabels;
  locale: string;
  data: ClubInsights;
  prevHref: string;
  nextHref: string | null;
  thisWeekHref: string;
  isCurrentWeek: boolean;
}) => {
  const first = data.weekDays[0];
  const last = data.weekDays[6];
  const fmt: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  return (
    <div className={`${CARD} mb-4 flex flex-wrap items-center gap-2 p-3`}>
      <Link
        href={prevHref}
        className="rounded-full bg-slate-100 px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
      >
        &larr; {L.prevWeek}
      </Link>
      <span className="rounded-full bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow">
        {fmtDay(first, locale, fmt)} - {fmtDay(last, locale, { ...fmt, year: "numeric" })}
      </span>
      {nextHref ? (
        <Link
          href={nextHref}
          className="rounded-full bg-slate-100 px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          {L.nextWeek} &rarr;
        </Link>
      ) : null}
      {!isCurrentWeek && (
        <Link href={thisWeekHref} className="ml-auto text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400">
          {L.thisWeek}
        </Link>
      )}
    </div>
  );
};

// --- Today ---------------------------------------------------------------------

export const TodayCards = ({
  L,
  R,
  data,
  multiClub,
}: {
  L: ClubInsightsLabels;
  R: ClubRulesLabels;
  data: ClubInsights;
  // Students marked present in more than one club today.
  multiClub: number;
}) => {
  const t = data.todaySummary;
  return (
    <div className="mb-4">
      <h2 className="mb-2 text-lg font-semibold text-slate-800 dark:text-slate-100">
        <span aria-hidden>📍</span> {L.todayTitle}
      </h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className={`${CARD} flex items-center gap-4 p-4`}>
          <div className="flex h-[84px] w-[84px] shrink-0 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow">
            <span className="text-3xl font-bold leading-none">{t.uniqueCame}</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{L.studentsToday}</p>
            <p className="text-xs text-slate-400">
              {fill(R.studentsNote, { enrolled: t.enrolledStudents, checkins: t.came })}
            </p>
            {multiClub > 0 && (
              <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                {fill(R.studentsMulti, { n: multiClub })}
              </p>
            )}
          </div>
        </div>
        <div className={`${CARD} flex items-center gap-4 p-4`}>
          <ScoreRing value={t.pct} size={84} stroke={11} textClass="text-lg" />
          <div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{R.rateTodayTitle}</p>
            <p className="text-xs text-slate-400">
              {t.marked > 0
                ? fill(R.rateTodayNote, { came: t.came, marked: t.marked, clubs: t.clubsMet })
                : L.noRegisterToday}
            </p>
          </div>
        </div>
        <div className={`${CARD} flex items-center gap-4 p-4`}>
          <ScoreRing
            value={t.clubsTotal > 0 ? Math.round((t.clubsMet / t.clubsTotal) * 100) : null}
            size={84}
            stroke={11}
            textClass="text-lg"
          />
          <div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{L.clubsMet}</p>
            <p className="text-xs text-slate-400">{L.clubsMetOf(t.clubsMet, t.clubsTotal)}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Day by day totals -----------------------------------------------------------

export const DailyTotals = ({ L, locale, data }: { L: ClubInsightsLabels; locale: string; data: ClubInsights }) => {
  const maxCame = Math.max(1, ...data.dayTotals.map((d) => d.came));
  const rows = data.dayTotals.filter((d, i) => i < 5 || d.marked > 0);
  return (
    <div className={`${CARD} mb-4 overflow-hidden`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-4">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          <span aria-hidden>📅</span> {L.dailyTitle}
        </h2>
        <p className="text-xs text-slate-400">{L.uniqueNote(data.weekTotal.uniqueCame)}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="mt-3 w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
              <th className="px-4 py-3">{L.dayCol}</th>
              <th className="px-3 py-3 text-center">{L.clubsMetCol}</th>
              <th className="px-3 py-3">{L.cameCol}</th>
              <th className="px-3 py-3 text-center">{L.markedCol}</th>
              <th className="px-3 py-3 text-center">{L.rateCol}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
            {rows.map((d) => {
              const isToday = d.date === data.today;
              return (
                <tr key={d.date} className={isToday ? "bg-blue-50/60 dark:bg-blue-950/20" : ""}>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-slate-800 dark:text-slate-100">
                      {fmtDay(d.date, locale, { weekday: "long" })}
                    </span>
                    <span className="ml-2 text-[11px] text-slate-400">{fmtDay(d.date, locale, { day: "numeric", month: "short" })}</span>
                    {isToday && (
                      <span className="ml-2 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white">
                        {L.todayCol}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center text-slate-600 dark:text-slate-300">{d.clubsMet}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <span className="w-10 text-right text-base font-bold text-slate-800 dark:text-slate-100">{d.came}</span>
                      <div className="h-2.5 min-w-[80px] flex-1 overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-700/60">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"
                          style={{ width: `${Math.round((d.came / maxCame) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center text-slate-500">{d.marked}</td>
                  <td className="px-3 py-3 text-center">
                    <RateChip pct={d.pct} />
                  </td>
                </tr>
              );
            })}
            <tr className="bg-slate-50 font-semibold dark:bg-slate-800/60">
              <td className="px-4 py-3 text-slate-800 dark:text-slate-100">{L.weekTotal}</td>
              <td className="px-3 py-3" />
              <td className="px-3 py-3 text-base text-slate-800 dark:text-slate-100">
                <span className="inline-block w-10 text-right">{data.weekTotal.came}</span>
              </td>
              <td className="px-3 py-3 text-center text-slate-500">{data.weekTotal.marked}</td>
              <td className="px-3 py-3 text-center">
                <RateChip pct={data.weekTotal.pct} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- Weekly rating of every club ---------------------------------------------------

const DayCell = ({ t, sessions }: { t: Tally; sessions: number }) => (
  <td className="px-2 py-3 text-center">
    {sessions === 0 ? (
      <span className="text-slate-300">-</span>
    ) : (
      <>
        <span className={`text-sm font-semibold ${toneFor(t.pct).text}`}>{t.came}</span>
        <span className="block text-[10px] text-slate-400">/ {t.marked}</span>
      </>
    )}
  </td>
);

export const WeeklyRating = ({
  L,
  locale,
  data,
  clubHref,
}: {
  L: ClubInsightsLabels;
  locale: string;
  data: ClubInsights;
  clubHref: (clubId: number) => string;
}) => {
  const dayIdx = data.weekDays
    .map((_, i) => i)
    .filter((i) => i < 5 || data.clubs.some((c) => c.days[i].marked > 0));
  return (
    <div className={`${CARD} mb-4 overflow-hidden`}>
      <h2 className="px-4 pt-4 text-lg font-semibold text-slate-800 dark:text-slate-100">
        <span aria-hidden>🏆</span> {L.weeklyTitle}
      </h2>
      <div className="overflow-x-auto">
        <table className="mt-3 w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
              <th className="px-4 py-3 text-center">{L.rankCol}</th>
              <th className="px-3 py-3">{L.clubCol}</th>
              <th className="hidden px-3 py-3 md:table-cell">{L.supervisorCol}</th>
              {dayIdx.map((i) => (
                <th key={i} className="px-2 py-3 text-center">
                  {fmtDay(data.weekDays[i], locale, { weekday: "short" })}
                </th>
              ))}
              <th className="px-3 py-3 text-center">{L.daysHeldCol}</th>
              <th className="px-3 py-3">{L.weekRateCol}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
            {data.clubs.map((c) => (
              <tr key={c.id} className="transition hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                <td className="px-4 py-3 text-center">
                  <RankBadge rank={c.rank} />
                </td>
                <td className="px-3 py-3">
                  <Link href={clubHref(c.id)} className="font-semibold text-blue-700 hover:underline dark:text-blue-300">
                    {c.name}
                  </Link>
                  <span className="block text-[11px] text-slate-400">
                    {c.enrolled}/{c.capacity}
                  </span>
                </td>
                <td className="hidden px-3 py-3 text-slate-600 dark:text-slate-300 md:table-cell">
                  {c.supervisors.length > 0 ? c.supervisors.map((s) => `${s.name} ${s.surname}`).join(", ") : L.noSupervisor}
                </td>
                {dayIdx.map((i) => (
                  <DayCell key={i} t={c.days[i]} sessions={c.days[i].sessions} />
                ))}
                <td className="px-3 py-3 text-center text-slate-600 dark:text-slate-300">{c.daysHeld}</td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <RateChip pct={c.week.pct} />
                    <RateBar pct={c.week.pct} className="hidden w-20 sm:block" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- Inside a club: supervisor rating + by-class table --------------------------------

const ClassTable = ({ club, L }: { club: ClubInsight; L: ClubInsightsLabels }) => {
  if (club.classes.length === 0) {
    return <p className="p-4 text-sm text-slate-500">{L.noStudents}</p>;
  }
  const Row = ({ r, strong = false }: { r: { name: string; enrolled: number; today: Tally; week: Tally }; strong?: boolean }) => (
    <tr className={strong ? "bg-slate-50 font-semibold dark:bg-slate-800/60" : "hover:bg-slate-50/70 dark:hover:bg-slate-800/40"}>
      <td className="px-4 py-3">
        {!strong && <span className={`mr-2 inline-block h-5 w-1 rounded-full align-middle ${toneFor(r.week.pct).bar}`} />}
        <span className="font-semibold text-slate-800 dark:text-slate-100">{r.name}</span>
      </td>
      <td className="px-3 py-3 text-center text-slate-600 dark:text-slate-300">{r.enrolled}</td>
      <td className="px-3 py-3 text-center">
        {r.today.marked > 0 ? (
          <>
            <span className={`text-sm font-semibold ${toneFor(r.today.pct).text}`}>{pctText(r.today.pct)}</span>
            <span className="block text-[10px] text-slate-400">
              ({r.today.came} / {r.today.marked})
            </span>
          </>
        ) : (
          <span className="text-slate-300">-</span>
        )}
      </td>
      <td className="px-3 py-3">
        {r.week.marked > 0 ? (
          <div className="flex items-center gap-2">
            <RateChip pct={r.week.pct} />
            <RateBar pct={r.week.pct} className="hidden w-24 sm:block" />
            <span className="text-[10px] text-slate-400">
              ({r.week.came} / {r.week.marked})
            </span>
          </div>
        ) : (
          <span className="text-slate-300">-</span>
        )}
      </td>
    </tr>
  );
  const total = {
    name: L.totalRow,
    enrolled: club.enrolled,
    today: club.today,
    week: club.week,
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead>
          <tr className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            <th className="px-4 py-3">{L.classCol}</th>
            <th className="px-3 py-3 text-center">{L.enrolledCol}</th>
            <th className="px-3 py-3 text-center">{L.todayCol}</th>
            <th className="px-3 py-3">{L.weekCol}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
          {club.classes.map((r: ClassRow) => (
            <Row key={r.key} r={{ name: r.className || L.unknownClass, enrolled: r.enrolled, today: r.today, week: r.week }} />
          ))}
          <Row r={total} strong />
        </tbody>
      </table>
    </div>
  );
};

export const ClubDetails = ({
  L,
  club,
  open,
}: {
  L: ClubInsightsLabels;
  club: ClubInsight;
  open: boolean;
}) => {
  const tone = toneFor(club.week.pct);
  return (
    <details id={`club-${club.id}`} open={open} className={`group ${CARD} mb-3 overflow-hidden`}>
      <summary className="flex cursor-pointer list-none items-center gap-4 p-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
        <ScoreRing value={club.week.pct} size={52} stroke={12} textClass="text-xs" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-slate-800 dark:text-slate-100">{club.name}</p>
          <p className="truncate text-xs text-slate-400">
            {club.supervisors.length > 0
              ? club.supervisors.map((s) => `${s.name} ${s.surname}`).join(", ")
              : L.noSupervisor}
          </p>
        </div>
        <RankBadge rank={club.rank} />
        <span className="text-slate-400 transition group-open:rotate-180" aria-hidden>
          ▾
        </span>
      </summary>

      <div className="border-t border-gray-100 dark:border-slate-800">
        <div className="p-4">
          <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <span aria-hidden>👩‍🏫</span> {L.supervisorsTitle}
          </p>
          {club.supervisors.length === 0 ? (
            <p className="text-sm text-slate-500">{L.noSupervisor}</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {club.supervisors.map((s) => (
                <div key={s.id} className={`flex items-center gap-4 rounded-2xl border p-3 ${tone.soft} ${tone.border}`}>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300 to-orange-400 text-sm font-bold text-white">
                    {`${s.name[0] ?? ""}${s.surname[0] ?? ""}`.toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {s.name} {s.surname}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {club.daysHeld > 0 ? L.registersTaken(club.daysHeld) : L.noRegistersWeek}
                    </p>
                    <div className="mt-1.5">
                      <RateBar pct={club.week.pct} />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-bold ${tone.text}`}>{pctText(club.week.pct)}</p>
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">{L.supervisorRating}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="border-t border-gray-100 dark:border-slate-800">
          <p className="px-4 pt-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <span aria-hidden>🏫</span> {L.byClassTitle}
          </p>
          <div className="mt-2">
            <ClassTable club={club} L={L} />
          </div>
        </div>
      </div>
    </details>
  );
};

export const InsightsLegend = ({ L }: { L: ClubInsightsLabels }) => (
  <div className="mb-3 flex flex-wrap gap-2 text-[11px]">
    <span className={`rounded-full px-2.5 py-1 font-semibold ${TONE.great.chip}`}>{L.legendGreat}</span>
    <span className={`rounded-full px-2.5 py-1 font-semibold ${TONE.fair.chip}`}>{L.legendFair}</span>
    <span className={`rounded-full px-2.5 py-1 font-semibold ${TONE.low.chip}`}>{L.legendLow}</span>
  </div>
);

// --- Needs checking -----------------------------------------------------------

const Chips = ({ items, tone = "slate" }: { items: string[]; tone?: "slate" | "rose" }) => (
  <div className="flex flex-wrap gap-1">
    {items.map((x) => (
      <span
        key={x}
        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
          tone === "rose"
            ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
        }`}
      >
        {x}
      </span>
    ))}
  </div>
);

const SectionHead = ({ title, hint, count }: { title: string; hint: string; count: number }) => (
  <div className="px-4 pt-4">
    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
      {title} <span className="ml-1 rounded-full bg-rose-600 px-2 py-0.5 text-[11px] font-bold text-white">{count}</span>
    </h3>
    <p className="text-xs text-slate-400">{hint}</p>
  </div>
);

const TH = "px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400";
const HEAD_ROW = "bg-slate-50 dark:bg-slate-800/60";
const BODY = "divide-y divide-gray-100 dark:divide-slate-800";

export const ClubIntegrityPanel = ({ R, data }: { R: ClubRulesLabels; data: ClubIntegrity }) => (
  <div className={`${CARD} mb-4 overflow-hidden`}>
    <div className="px-4 pt-4">
      <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
        <span aria-hidden>🚩</span> {R.integrityTitle}
      </h2>
      <p className="text-xs text-slate-400">{R.integritySubtitle}</p>
    </div>

    {data.total === 0 && <p className="px-4 py-6 text-sm text-emerald-600 dark:text-emerald-400">✅ {R.allClear}</p>}

    {data.mismatches.length > 0 && (
      <div className="pb-2">
        <SectionHead title={R.mismatchTitle} hint={R.mismatchHint} count={data.mismatches.length} />
        <div className="overflow-x-auto">
          <table className="mt-2 w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className={HEAD_ROW}>
                <th className={`${TH} pl-4`}>{R.studentCol}</th>
                <th className={TH}>{R.classCol}</th>
                <th className={TH}>{R.classStatusCol}</th>
                <th className={`${TH} hidden md:table-cell`}>{R.classSupervisorCol}</th>
                <th className={TH}>{R.clubCol}</th>
                <th className={`${TH} hidden md:table-cell`}>{R.clubSupervisorCol}</th>
              </tr>
            </thead>
            <tbody className={BODY}>
              {data.mismatches.map((m) => (
                <tr key={m.studentId}>
                  <td className="py-2.5 pl-4 pr-3 font-semibold text-slate-800 dark:text-slate-100">{m.student}</td>
                  <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400">{m.className || R.noClass}</td>
                  <td className="px-3 py-2.5">
                    <Chips items={[m.classStatus === "ABSENT" ? R.statusABSENT : R.statusEXCUSED]} tone="rose" />
                  </td>
                  <td className="hidden px-3 py-2.5 text-slate-500 dark:text-slate-400 md:table-cell">
                    {m.classSupervisor ?? R.none}
                  </td>
                  <td className="px-3 py-2.5">
                    <Chips items={m.clubs} />
                  </td>
                  <td className="hidden px-3 py-2.5 text-slate-500 dark:text-slate-400 md:table-cell">
                    {m.clubSupervisors.length > 0 ? m.clubSupervisors.join(", ") : R.noSupervisor}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )}

    {data.doubleToday.length > 0 && (
      <div className="pb-2">
        <SectionHead title={R.doubleTitle} hint={R.doubleHint} count={data.doubleToday.length} />
        <div className="overflow-x-auto">
          <table className="mt-2 w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className={HEAD_ROW}>
                <th className={`${TH} pl-4`}>{R.studentCol}</th>
                <th className={TH}>{R.classCol}</th>
                <th className={TH}>{R.clubsCol}</th>
              </tr>
            </thead>
            <tbody className={BODY}>
              {data.doubleToday.map((r) => (
                <tr key={r.studentId}>
                  <td className="py-2.5 pl-4 pr-3 font-semibold text-slate-800 dark:text-slate-100">{r.student}</td>
                  <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400">{r.className || R.noClass}</td>
                  <td className="px-3 py-2.5">
                    <Chips items={r.clubs} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )}

    {data.overLimit.length > 0 && (
      <div className="pb-4">
        <SectionHead title={R.overTitle} hint={R.overHint} count={data.overLimit.length} />
        <div className="overflow-x-auto">
          <table className="mt-2 w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className={HEAD_ROW}>
                <th className={`${TH} pl-4`}>{R.studentCol}</th>
                <th className={TH}>{R.classCol}</th>
                <th className={`${TH} text-center`}>{R.countCol}</th>
                <th className={TH}>{R.clubsCol}</th>
              </tr>
            </thead>
            <tbody className={BODY}>
              {data.overLimit.map((r) => (
                <tr key={r.studentId}>
                  <td className="py-2.5 pl-4 pr-3 font-semibold text-slate-800 dark:text-slate-100">{r.student}</td>
                  <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400">{r.className || R.noClass}</td>
                  <td className="px-3 py-2.5 text-center font-bold text-rose-600 dark:text-rose-400">{r.clubs.length}</td>
                  <td className="px-3 py-2.5">
                    <Chips items={r.clubs} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )}
  </div>
);
