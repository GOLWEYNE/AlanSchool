import Link from "next/link";
import type { ReactNode } from "react";
import { fmtDay, ScoreRing, toneOf } from "@/components/LessonMonitoring";
import { addOlympiad, deleteOlympiad } from "@/lib/olympiadActions";
import {
  OLYMPIAD_LEVELS,
  OLYMPIAD_RESULTS,
  type OlympiadResult,
  type OlympiadRow,
  type OlympiadSummary,
} from "@/lib/olympiads";
import type { StudentInsightsLabels as Labels } from "@/lib/studentInsightsLabels";
import {
  DAY_OPTIONS,
  type ClassDetail,
  type ClassSummary,
  type Flag,
  type Pct,
  type SchoolTotals,
  type StudentMetrics,
  type StudentProfile,
} from "@/lib/studentInsights";

// Presentational pieces of Student insights. Server components only: the only
// interactivity is links and plain forms (the olympiad form posts to a server action).

const CARD = "glass-surface";

const TEXT = {
  great: "text-emerald-600 dark:text-emerald-400",
  fair: "text-amber-600 dark:text-amber-400",
  low: "text-rose-600 dark:text-rose-400",
  none: "text-slate-400 dark:text-slate-500",
} as const;
const BAR = {
  great: "bg-emerald-500",
  fair: "bg-amber-400",
  low: "bg-rose-500",
  none: "bg-slate-300 dark:bg-slate-600",
} as const;
const CHIP = {
  great: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  fair: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  low: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  none: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
} as const;

const show = (p: Pct) => (p === null ? "-" : `${p}%`);

const PctChip = ({ value }: { value: Pct }) => (
  <span className={`inline-block min-w-[3rem] rounded-full px-2 py-0.5 text-center text-xs font-bold ${CHIP[toneOf(value)]}`}>
    {show(value)}
  </span>
);

const MiniBar = ({ value }: { value: Pct }) => (
  <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800">
    <div
      className={`h-1.5 rounded-full ${BAR[toneOf(value)]}`}
      style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%` }}
    />
  </div>
);

const Section = ({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) => (
  <section className="mt-6">
    <div className="mb-2">
      <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
    {children}
  </section>
);

const Th = ({ children, className = "" }: { children?: ReactNode; className?: string }) => (
  <th className={`px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400 ${className}`}>
    {children}
  </th>
);

const ROW = "border-t border-gray-100 dark:border-slate-800";

export const MEDAL: Record<OlympiadResult, string> = {
  FIRST: "🥇",
  SECOND: "🥈",
  THIRD: "🥉",
  SPECIAL: "⭐",
  PARTICIPANT: "🎗️",
};

const LEVEL_CHIP: Record<string, string> = {
  SCHOOL: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  CITY: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  REGION: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
  REPUBLIC: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  INTERNATIONAL: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300",
};

// --- period selector ---------------------------------------------------------

export const PeriodBar = ({
  L,
  days,
  href,
}: {
  L: Labels;
  days: number;
  href: (days: number) => string;
}) => {
  const name = (d: number) => (d === 7 ? L.last7 : d === 30 ? L.last30 : d === 90 ? L.last90 : L.allTime);
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{L.period}</span>
      <div className="inline-flex flex-wrap gap-1 rounded-full bg-slate-100/80 p-1 dark:bg-slate-800/70">
      {DAY_OPTIONS.map((d) => (
        <Link
          key={d}
          href={href(d)}
          className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-300 ${
            d === days
              ? "bg-white text-blue-700 shadow-sm dark:bg-slate-600 dark:text-white"
              : "text-slate-600 hover:text-blue-700 dark:text-slate-300 dark:hover:text-white"
          }`}
        >
          {name(d)}
        </Link>
      ))}
      </div>
      <span className="text-[11px] text-slate-400">{L.periodNote}</span>
    </div>
  );
};

export const InsightsLegend = ({ L }: { L: Labels }) => (
  <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold">
    <span className={`rounded-full px-2.5 py-1 ${CHIP.great}`}>{L.legendGreat}</span>
    <span className={`rounded-full px-2.5 py-1 ${CHIP.fair}`}>{L.legendFair}</span>
    <span className={`rounded-full px-2.5 py-1 ${CHIP.low}`}>{L.legendLow}</span>
  </div>
);

// --- tiles --------------------------------------------------------------------

const Tile = ({
  label,
  value,
  sub,
  ring = true,
  big,
}: {
  label: string;
  value: Pct | string | number;
  sub?: string;
  ring?: boolean;
  big?: boolean;
}) => (
  <div className={`${CARD} flex items-center gap-3 p-4`}>
    {ring && typeof value !== "string" ? (
      <ScoreRing value={value as Pct} size={big ? 84 : 68} stroke={9} textClass={big ? "text-lg" : "text-sm"} />
    ) : (
      <div className="flex h-[68px] min-w-[68px] items-center justify-center rounded-2xl bg-blue-50 px-3 text-2xl font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
        {value ?? "-"}
      </div>
    )}
    <div className="min-w-0">
      <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  </div>
);

export const SchoolSummary = ({ L, school }: { L: Labels; school: SchoolTotals }) => (
  <Section title={L.schoolTitle}>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Tile ring={false} label={L.students} value={school.students} sub={`${school.classes} ${L.classes.toLowerCase()}`} />
      <Tile label={L.attendance} value={school.attendance} />
      <Tile label={L.uniform} value={school.uniform} />
      <Tile label={L.kpa} value={school.kpa} sub={L.kpaNote} />
      <Tile label={L.grades} value={school.grades} />
      <Tile label={L.assignments} value={school.assignments} />
      <Tile
        ring={false}
        label={L.olympiads}
        value={school.olympiadEntries}
        sub={`${L.prizesOf(school.olympiadPrizes, school.olympiadEntries)} - ${school.olympiadStudents} ${L.students.toLowerCase()}`}
      />
      <Tile ring={false} label={L.needAttention} value={school.attention} sub={L.students.toLowerCase()} />
    </div>
  </Section>
);

// --- class table --------------------------------------------------------------

const Cell = ({ value, small }: { value: Pct; small?: string }) => (
  <td className="px-3 py-2.5">
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <PctChip value={value} />
        {small && <span className="hidden text-[10px] text-slate-400 xl:inline">{small}</span>}
      </div>
      <MiniBar value={value} />
    </div>
  </td>
);

const rankMark = (rank: number | null) =>
  rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : rank === null ? "-" : String(rank);

export const ClassTable = ({
  L,
  classes,
  classHref,
}: {
  L: Labels;
  classes: ClassSummary[];
  classHref: (id: number) => string;
}) => (
  <Section title={L.classesTitle}>
    <div className={`${CARD} overflow-x-auto`}>
      <table className="w-full min-w-[880px] text-sm">
        <thead>
          <tr>
            <Th>{L.rankCol}</Th>
            <Th>{L.classCol}</Th>
            <Th>{L.attendance}</Th>
            <Th>{L.uniform}</Th>
            <Th>{L.kpa}</Th>
            <Th>{L.grades}</Th>
            <Th>{L.assignments}</Th>
            <Th>{L.olympiads}</Th>
            <Th>{L.index}</Th>
          </tr>
        </thead>
        <tbody>
          {classes.map((c) => (
            <tr key={c.id} className={`${ROW} hover:bg-slate-50 dark:hover:bg-slate-800/40`}>
              <td className="px-3 py-2.5 text-center text-base">{rankMark(c.rank)}</td>
              <td className="px-3 py-2.5">
                <Link href={classHref(c.id)} className="font-bold text-blue-700 hover:underline dark:text-blue-300">
                  {c.name}
                </Link>
                <div className="text-[11px] text-slate-400">
                  {c.students} {L.students.toLowerCase()} · {c.supervisor ?? L.noSupervisor}
                </div>
                {c.attention > 0 && (
                  <div className="text-[11px] font-semibold text-rose-500">
                    {c.attention} {L.needAttention.toLowerCase()}
                  </div>
                )}
              </td>
              <Cell value={c.attendance.pct} small={`${c.attendance.num}/${c.attendance.den}`} />
              <Cell value={c.uniform.pct} small={`${c.uniform.num}/${c.uniform.den}`} />
              <Cell value={c.kpa} />
              <Cell value={c.grades.pct} />
              <Cell value={c.assignments.pct} small={`${c.assignments.num}/${c.assignments.den}`} />
              <td className="px-3 py-2.5 text-xs text-slate-600 dark:text-slate-300">
                <div className="font-semibold">🏅 {c.olympiads.entries}</div>
                <div className="text-[11px] text-slate-400">{L.prizesOf(c.olympiads.prizes, c.olympiads.entries)}</div>
              </td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <ScoreRing value={c.index} size={44} stroke={11} textClass="text-[11px]" />
                  <Link
                    href={classHref(c.id)}
                    className="rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-700"
                  >
                    {L.openClass}
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </Section>
);

// --- class detail ----------------------------------------------------------------

const FlagChips = ({ L, flags }: { L: Labels; flags: Flag[] }) => {
  if (flags.length === 0) return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${CHIP.great}`}>{L.allGood}</span>;
  const name: Record<Flag, string> = {
    attendance: L.flagAttendance,
    uniform: L.flagUniform,
    grades: L.flagGrades,
    work: L.flagWork,
  };
  return (
    <div className="flex flex-wrap gap-1">
      {flags.map((f) => (
        <span key={f} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${CHIP.low}`}>
          {name[f]}
        </span>
      ))}
    </div>
  );
};

const OlympiadBadge = ({ L, o }: { L: Labels; o: OlympiadSummary }) =>
  o.entries === 0 ? (
    <span className="text-slate-300">-</span>
  ) : (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
        🏅 {o.entries}
        {o.prizes > 0 && <span className="ml-1 text-amber-600">({o.prizes})</span>}
      </span>
      {o.best && (
        <span className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold ${LEVEL_CHIP[o.best.level]}`}>
          {MEDAL[o.best.result]} {L.olympiadLevels[o.best.level]}
        </span>
      )}
    </div>
  );

export const ClassStats = ({ L, summary }: { L: Labels; summary: ClassSummary }) => (
  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <Tile label={L.index} value={summary.index} big sub={summary.rank ? `#${summary.rank}` : undefined} />
    <Tile label={L.attendance} value={summary.attendance.pct} sub={`${summary.attendance.num}/${summary.attendance.den}`} />
    <Tile label={L.uniform} value={summary.uniform.pct} sub={`${summary.uniform.num}/${summary.uniform.den}`} />
    <Tile label={L.kpa} value={summary.kpa} sub={L.kpaNote} />
    <Tile label={L.grades} value={summary.grades.pct} />
    <Tile label={L.assignments} value={summary.assignments.pct} sub={`${summary.assignments.num}/${summary.assignments.den}`} />
    <Tile
      ring={false}
      label={L.olympiads}
      value={summary.olympiads.entries}
      sub={`${L.prizesOf(summary.olympiads.prizes, summary.olympiads.entries)}`}
    />
    <Tile ring={false} label={L.needAttention} value={summary.attention} sub={L.students.toLowerCase()} />
  </div>
);

export const StudentTable = ({
  L,
  detail,
  studentHref,
}: {
  L: Labels;
  detail: ClassDetail;
  studentHref: (id: string) => string;
}) => (
  <Section title={L.classStudentsTitle(detail.students.length)}>
    <div className={`${CARD} overflow-x-auto`}>
      <table className="w-full min-w-[1000px] text-sm">
        <thead>
          <tr>
            <Th>{L.rankCol}</Th>
            <Th>{L.studentCol}</Th>
            <Th>{L.attendance}</Th>
            <Th>{L.uniform}</Th>
            <Th>{L.grades}</Th>
            <Th>{L.assignments}</Th>
            <Th>{L.olympiadCol}</Th>
            <Th>{L.clubsCol}</Th>
            <Th>{L.behaviorCol}</Th>
            <Th>{L.index}</Th>
            <Th>{L.flagsCol}</Th>
          </tr>
        </thead>
        <tbody>
          {detail.students.map((s) => (
            <tr key={s.id} className={`${ROW} hover:bg-slate-50 dark:hover:bg-slate-800/40`}>
              <td className="px-3 py-2.5 text-center">{rankMark(s.rank)}</td>
              <td className="px-3 py-2.5">
                <Link href={studentHref(s.id)} className="font-semibold text-blue-700 hover:underline dark:text-blue-300">
                  {s.surname} {s.name}
                </Link>
              </td>
              <Cell value={s.metrics.attendance.pct} small={`${s.metrics.attendance.num}/${s.metrics.attendance.den}`} />
              <Cell value={s.metrics.uniform.pct} small={`${s.metrics.uniform.num}/${s.metrics.uniform.den}`} />
              <Cell value={s.metrics.grades.pct} />
              <Cell value={s.metrics.assignments.pct} small={`${s.metrics.assignments.num}/${s.metrics.assignments.den}`} />
              <td className="px-3 py-2.5">
                <OlympiadBadge L={L} o={s.metrics.olympiads} />
              </td>
              <td className="px-3 py-2.5 text-xs text-slate-600 dark:text-slate-300">{s.metrics.clubs || "-"}</td>
              <td className="px-3 py-2.5 text-xs">
                <span className="text-emerald-600">+{s.metrics.behavior.positive}</span>{" "}
                <span className="text-amber-600">!{s.metrics.behavior.concern}</span>{" "}
                <span className="text-rose-600">x{s.metrics.behavior.incident}</span>
              </td>
              <td className="px-3 py-2.5">
                <ScoreRing value={s.metrics.index} size={40} stroke={11} textClass="text-[10px]" />
              </td>
              <td className="px-3 py-2.5">
                <FlagChips L={L} flags={s.flags} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </Section>
);

// --- student profile ---------------------------------------------------------------

const Compare = ({ L, own, cls }: { L: Labels; own: Pct; cls: Pct }) => {
  if (own === null || cls === null) return null;
  const d = own - cls;
  return (
    <span className={`text-[11px] font-semibold ${d >= 0 ? TEXT.great : TEXT.low}`}>
      {d >= 0 ? "+" : ""}
      {d} {L.vsClass}
    </span>
  );
};

const ProfileTile = ({
  L,
  label,
  value,
  cls,
  sub,
}: {
  L: Labels;
  label: string;
  value: Pct;
  cls: Pct;
  sub?: string;
}) => (
  <div className={`${CARD} flex items-center gap-3 p-4`}>
    <ScoreRing value={value} size={72} stroke={9} textClass="text-base" />
    <div>
      <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
      <div className="text-[11px] text-slate-400">
        {L.classAverage}: {show(cls)}
      </div>
      <Compare L={L} own={value} cls={cls} />
    </div>
  </div>
);

export const ProfileHeader = ({ L, p }: { L: Labels; p: StudentProfile }) => (
  <div className={`${CARD} mt-4 p-4`}>
    <div className="flex flex-wrap items-center gap-4">
      <ScoreRing value={p.metrics.index} size={96} stroke={10} textClass="text-xl" />
      <div className="min-w-0 flex-1">
        <div className="text-xl font-bold text-slate-800 dark:text-slate-100">
          {p.student.surname} {p.student.name}
        </div>
        <div className="text-sm text-slate-500">
          {p.student.className} · {p.student.supervisor ?? L.noSupervisor}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
          {p.rank && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
              {L.rankInClass(p.rank, p.classSize)}
            </span>
          )}
          <FlagChips L={L} flags={p.flags} />
        </div>
      </div>
      <div className="text-right text-xs text-slate-400">
        <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">{L.index}</div>
        {L.classAverage}: {show(p.classAvg.index)}
        <br />
        <Compare L={L} own={p.metrics.index} cls={p.classAvg.index} />
      </div>
    </div>
  </div>
);

export const ProfileTiles = ({ L, p }: { L: Labels; p: StudentProfile }) => {
  const m: StudentMetrics = p.metrics;
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <ProfileTile
        L={L}
        label={L.attendance}
        value={m.attendance.pct}
        cls={p.classAvg.attendance}
        sub={`${L.came(m.attendance.num, m.attendance.den)} · ${L.lateCount(m.late)} · ${L.absentCount(m.absent)}`}
      />
      <ProfileTile
        L={L}
        label={L.uniform}
        value={m.uniform.pct}
        cls={p.classAvg.uniform}
        sub={L.uniformSummary(m.uniform.num, m.uniform.den)}
      />
      <ProfileTile
        L={L}
        label={L.grades}
        value={m.grades.pct}
        cls={p.classAvg.grades}
        sub={`${L.examAvg}: ${show(m.exams.pct)} · ${L.homeworkAvg}: ${show(m.homework.pct)}`}
      />
      <ProfileTile
        L={L}
        label={L.assignments}
        value={m.assignments.pct}
        cls={p.classAvg.assignments}
        sub={L.handedInSummary(m.assignments.num, m.assignments.den)}
      />
    </div>
  );
};

export const WeeklyAttendance = ({ L, p, locale }: { L: Labels; p: StudentProfile; locale: string }) => (
  <Section title={L.attendanceByWeek}>
    {p.weeks.length === 0 ? (
      <div className={`${CARD} p-5 text-sm text-slate-400`}>{L.noData}</div>
    ) : (
      <div className={`${CARD} p-4`}>
        <div className="flex items-end gap-2 overflow-x-auto pb-1">
          {p.weeks.map((w) => (
            <div key={w.week} className="flex min-w-[52px] flex-1 flex-col items-center gap-1">
              <span className={`text-xs font-bold ${TEXT[toneOf(w.pct)]}`}>{show(w.pct)}</span>
              <div className="flex h-24 w-full items-end rounded-md bg-slate-100 dark:bg-slate-800">
                <div
                  className={`w-full rounded-md ${BAR[toneOf(w.pct)]}`}
                  style={{ height: `${Math.max(4, w.pct ?? 0)}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-400">
                {fmtDay(w.week, locale, { day: "numeric", month: "short" })}
              </span>
              <span className="text-[10px] text-slate-400">
                {w.came}/{w.marked}
              </span>
            </div>
          ))}
        </div>
      </div>
    )}
  </Section>
);

export const UniformSection = ({ L, p, locale }: { L: Labels; p: StudentProfile; locale: string }) => {
  const label = { FULL: L.uniformFull, PARTIAL: L.uniformPartial, NONE: L.uniformNone } as const;
  const chip = { FULL: CHIP.great, PARTIAL: CHIP.fair, NONE: CHIP.low } as const;
  return (
    <Section title={L.uniformTitle}>
      {p.uniformDays.length === 0 ? (
        <div className={`${CARD} p-5 text-sm text-slate-400`}>{L.noChecks}</div>
      ) : (
        <div className={`${CARD} divide-y divide-gray-100 dark:divide-slate-800`}>
          {p.uniformDays.map((u) => (
            <div key={u.date} className="flex flex-wrap items-center gap-3 px-4 py-2 text-sm">
              <span className="w-28 text-slate-600 dark:text-slate-300">
                {fmtDay(u.date, locale, { weekday: "short", day: "numeric", month: "short" })}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${chip[u.status]}`}>{label[u.status]}</span>
              {u.missing.length > 0 && (
                <span className="text-xs text-slate-400">
                  {L.missing}: {u.missing.join(", ")}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
};

export const WorkSection = ({ L, p, locale }: { L: Labels; p: StudentProfile; locale: string }) => (
  <>
    <Section title={L.workTitle}>
      {p.work.length === 0 ? (
        <div className={`${CARD} p-5 text-sm text-slate-400`}>{L.noWork}</div>
      ) : (
        <div className={`${CARD} overflow-x-auto`}>
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr>
                <Th>{L.titleCol}</Th>
                <Th>{L.subjectCol}</Th>
                <Th>{L.dueCol}</Th>
                <Th>{L.statusCol}</Th>
                <Th>{L.scoreCol}</Th>
              </tr>
            </thead>
            <tbody>
              {p.work.map((w, i) => (
                <tr key={`${w.title}-${i}`} className={ROW}>
                  <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-200">{w.title}</td>
                  <td className="px-3 py-2 text-slate-500">{w.subject}</td>
                  <td className="px-3 py-2 text-slate-500">{fmtDay(w.date, locale, { day: "numeric", month: "short" })}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${w.state === "done" ? CHIP.great : CHIP.low}`}>
                      {w.state === "done" ? L.handedIn : L.notHandedIn}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <PctChip value={w.pct} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
    <Section title={L.examsTitle}>
      {p.exams.length === 0 ? (
        <div className={`${CARD} p-5 text-sm text-slate-400`}>{L.noExams}</div>
      ) : (
        <div className={`${CARD} overflow-x-auto`}>
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr>
                <Th>{L.titleCol}</Th>
                <Th>{L.subjectCol}</Th>
                <Th>{L.dateCol}</Th>
                <Th>{L.scoreCol}</Th>
              </tr>
            </thead>
            <tbody>
              {p.exams.map((e, i) => (
                <tr key={`${e.title}-${i}`} className={ROW}>
                  <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-200">{e.title}</td>
                  <td className="px-3 py-2 text-slate-500">{e.subject}</td>
                  <td className="px-3 py-2 text-slate-500">{fmtDay(e.date, locale, { day: "numeric", month: "short" })}</td>
                  <td className="px-3 py-2">
                    <PctChip value={e.pct} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  </>
);

const INPUT =
  "w-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900";

export const OlympiadSection = ({
  L,
  studentId,
  rows,
  canEdit,
  locale,
}: {
  L: Labels;
  studentId: string;
  rows: OlympiadRow[];
  canEdit: boolean;
  locale: string;
}) => (
  <Section title={`🏆 ${L.olympiadsTitle}`}>
    <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
      <div className={CARD}>
        {rows.length === 0 ? (
          <div className="p-5 text-sm text-slate-400">{L.noOlympiads}</div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-slate-800">
            {rows.map((o) => (
              <div key={o.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="text-2xl">{MEDAL[o.result]}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-800 dark:text-slate-100">{o.name}</div>
                  <div className="text-xs text-slate-400">
                    {o.subject ? `${o.subject} · ` : ""}
                    {L.olympiadResults[o.result]}
                    {o.heldOn ? ` · ${fmtDay(o.heldOn.toISOString().slice(0, 10), locale, { day: "numeric", month: "short", year: "numeric" })}` : ""}
                    {o.note ? ` · ${o.note}` : ""}
                  </div>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${LEVEL_CHIP[o.level]}`}>
                  {L.olympiadLevels[o.level]}
                </span>
                {canEdit && (
                  <form action={deleteOlympiad}>
                    <input type="hidden" name="id" value={o.id} />
                    <button type="submit" className="text-xs font-semibold text-rose-500 hover:underline">
                      {L.deleteOlympiad}
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {canEdit && (
        <form action={addOlympiad} className={`${CARD} flex flex-col gap-2 p-4`}>
          <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">{L.addOlympiad}</div>
          <input type="hidden" name="studentId" value={studentId} />
          <input name="name" required minLength={2} maxLength={160} placeholder={L.olympiadName} className={INPUT} />
          <input name="subject" maxLength={80} placeholder={L.olympiadSubject} className={INPUT} />
          <select name="level" defaultValue="SCHOOL" className={INPUT} aria-label={L.olympiadLevel}>
            {OLYMPIAD_LEVELS.map((lv) => (
              <option key={lv} value={lv}>
                {L.olympiadLevels[lv]}
              </option>
            ))}
          </select>
          <select name="result" defaultValue="PARTICIPANT" className={INPUT} aria-label={L.olympiadResult}>
            {OLYMPIAD_RESULTS.map((r) => (
              <option key={r} value={r}>
                {MEDAL[r]} {L.olympiadResults[r]}
              </option>
            ))}
          </select>
          <input name="heldOn" type="date" className={INPUT} aria-label={L.olympiadDate} />
          <input name="note" maxLength={300} placeholder={L.olympiadNote} className={INPUT} />
          <button type="submit" className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            {L.saveOlympiad}
          </button>
        </form>
      )}
    </div>
  </Section>
);

export const ExtrasSection = ({ L, p, locale }: { L: Labels; p: StudentProfile; locale: string }) => {
  const behaviorChip = { POSITIVE: CHIP.great, CONCERN: CHIP.fair, INCIDENT: CHIP.low } as const;
  const behaviorName = { POSITIVE: L.positive, CONCERN: L.concern, INCIDENT: L.incident } as const;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Section title={`🎯 ${L.clubsTitle}`}>
        <div className={`${CARD} divide-y divide-gray-100 dark:divide-slate-800`}>
          {p.clubs.length === 0 ? (
            <div className="p-5 text-sm text-slate-400">{L.noClubs}</div>
          ) : (
            p.clubs.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">{c.name}</div>
                  <div className="text-[11px] text-slate-400">{L.clubCameOf(c.came, c.marked)}</div>
                </div>
                <PctChip value={c.pct} />
              </div>
            ))
          )}
        </div>
      </Section>
      <Section title={L.behaviorTitle}>
        <div className={`${CARD} divide-y divide-gray-100 dark:divide-slate-800`}>
          {p.behavior.length === 0 ? (
            <div className="p-5 text-sm text-slate-400">{L.noBehavior}</div>
          ) : (
            p.behavior.map((b, i) => (
              <div key={`${b.date}-${i}`} className="flex items-center gap-3 px-4 py-2.5">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${behaviorChip[b.type]}`}>
                  {behaviorName[b.type]}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-200">{b.title}</span>
                <span className="text-[11px] text-slate-400">{fmtDay(b.date, locale, { day: "numeric", month: "short" })}</span>
              </div>
            ))
          )}
        </div>
      </Section>
      <Section title={L.mockTitle}>
        <div className={`${CARD} divide-y divide-gray-100 dark:divide-slate-800`}>
          {p.mock.length === 0 ? (
            <div className="p-5 text-sm text-slate-400">{L.noMock}</div>
          ) : (
            p.mock.slice(-6).reverse().map((m, i) => (
              <div key={`${m.kind}-${i}`} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                  {m.kind}
                </span>
                <span className="font-bold text-slate-700 dark:text-slate-200">{m.score}</span>
                <span className="ml-auto text-[11px] text-slate-400">
                  {fmtDay(m.takenAt.toISOString().slice(0, 10), locale, { day: "numeric", month: "short" })}
                </span>
              </div>
            ))
          )}
        </div>
      </Section>
    </div>
  );
};
