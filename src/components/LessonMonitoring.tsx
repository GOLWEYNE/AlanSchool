import Link from "next/link";
import type { ReactNode } from "react";
import { dateLocale } from "@/lib/dateLocale";
import type { MonitorDay, MonitorMetric, MonitorPreset, MonitorRow, TeacherMonitor } from "@/lib/lessonMonitoring";
import type { MonitorLabels } from "@/lib/lessonMonitoringLabels";

// Presentational pieces of the Lesson monitoring cabinet. All server
// components: the only interactivity is links and plain GET forms.

type Tone = "great" | "fair" | "low" | "none";

export const toneOf = (pct: number | null): Tone =>
  pct === null ? "none" : pct >= 80 ? "great" : pct >= 50 ? "fair" : "low";

const TONE: Record<Tone, { text: string; bar: string; soft: string; border: string; chip: string; stroke: string }> = {
  great: {
    text: "text-emerald-600 dark:text-emerald-400",
    bar: "bg-emerald-500",
    soft: "bg-emerald-50 dark:bg-emerald-950/30",
    border: "border-emerald-200 dark:border-emerald-900/60",
    chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    stroke: "#10b981",
  },
  fair: {
    text: "text-amber-600 dark:text-amber-400",
    bar: "bg-amber-400",
    soft: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-200 dark:border-amber-900/60",
    chip: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    stroke: "#f59e0b",
  },
  low: {
    text: "text-rose-600 dark:text-rose-400",
    bar: "bg-rose-500",
    soft: "bg-rose-50 dark:bg-rose-950/30",
    border: "border-rose-200 dark:border-rose-900/60",
    chip: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
    stroke: "#f43f5e",
  },
  none: {
    text: "text-slate-400 dark:text-slate-500",
    bar: "bg-slate-300 dark:bg-slate-600",
    soft: "bg-slate-50 dark:bg-slate-800/40",
    border: "border-slate-200 dark:border-slate-700",
    chip: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
    stroke: "#94a3b8",
  },
};

const CARD = "rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";

const pctText = (pct: number | null) => (pct === null ? "-" : `${pct}%`);

export const fmtDay = (ymd: string, locale: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(dateLocale(locale), { ...opts, timeZone: "UTC" }).format(new Date(`${ymd}T00:00:00Z`));

// --- Ring ------------------------------------------------------------------

export const ScoreRing = ({
  value,
  size = 96,
  stroke = 10,
  onDark = false,
  textClass = "text-xl",
}: {
  value: number | null;
  size?: number;
  stroke?: number;
  onDark?: boolean;
  textClass?: string;
}) => {
  const r = 50 - stroke / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value ?? 0));
  const color = onDark ? "#ffffff" : TONE[toneOf(value)].stroke;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden>
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={onDark ? "rgba(255,255,255,0.25)" : "rgba(148,163,184,0.25)"}
          strokeWidth={stroke}
        />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(c * v) / 100} ${c}`}
        />
      </svg>
      <div
        className={`absolute inset-0 flex items-center justify-center font-bold ${textClass} ${
          onDark ? "text-white" : TONE[toneOf(value)].text
        }`}
      >
        {pctText(value)}
      </div>
    </div>
  );
};

// --- Avatar ----------------------------------------------------------------

export const TeacherAvatar = ({
  name,
  img,
  className = "h-16 w-16 text-xl",
}: {
  name: string;
  img: string | null;
  className?: string;
}) => {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return img ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={img} alt={name} className={`${className} shrink-0 rounded-2xl object-cover ring-2 ring-white/70`} />
  ) : (
    <div
      className={`${className} flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 to-orange-400 font-bold text-white ring-2 ring-white/70`}
      aria-hidden
    >
      {initials || "?"}
    </div>
  );
};

// --- Metric tile -----------------------------------------------------------

export const MetricTile = ({
  icon,
  label,
  metric,
  emptyNote,
  highlight = false,
}: {
  icon: string;
  label: string;
  metric: MonitorMetric;
  emptyNote?: string;
  highlight?: boolean;
}) => {
  const tone = TONE[toneOf(metric.pct)];
  return (
    <div className={`rounded-2xl border p-4 ${tone.soft} ${tone.border} ${highlight ? "ring-2 ring-offset-0 ring-blue-400/50" : ""}`}>
      <p className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
        <span aria-hidden>{icon}</span>
        {label}
      </p>
      <p className={`mt-2 text-3xl font-bold ${tone.text}`}>
        {pctText(metric.pct)}
        {metric.total > 0 && (
          <span className="ml-1.5 align-middle text-xs font-medium text-slate-400">
            ({metric.done}/{metric.total})
          </span>
        )}
      </p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-700/60">
        <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${metric.pct ?? 0}%` }} />
      </div>
      {metric.pct === null && emptyNote && <p className="mt-2 text-[11px] text-slate-400">{emptyNote}</p>}
    </div>
  );
};

// --- Period bar --------------------------------------------------------------

const PRESETS: MonitorPreset[] = ["today", "yesterday", "week", "month"];

export const RangeBar = ({
  L,
  preset,
  from,
  to,
  hrefFor,
  hidden,
  action,
}: {
  L: MonitorLabels;
  preset: MonitorPreset;
  from: string;
  to: string;
  hrefFor: (preset: MonitorPreset) => string;
  // Extra query params to keep when the custom range form is submitted.
  hidden: Record<string, string>;
  action?: ReactNode;
}) => (
  <div className={`${CARD} mb-4 flex flex-col gap-3 p-3 md:flex-row md:flex-wrap md:items-center`}>
    <div className="flex flex-wrap gap-1.5">
      {PRESETS.map((p) => (
        <Link
          key={p}
          href={hrefFor(p)}
          scroll={false}
          className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
            p === preset
              ? "bg-blue-600 text-white shadow"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          }`}
        >
          {L[p]}
        </Link>
      ))}
    </div>
    <form method="get" className="flex flex-wrap items-center gap-2 text-xs md:ml-auto">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input type="hidden" name="preset" value="custom" />
      <label className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
        {L.from}
        <input
          type="date"
          name="from"
          defaultValue={from}
          className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        />
      </label>
      <label className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
        {L.to}
        <input
          type="date"
          name="to"
          defaultValue={to}
          className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        />
      </label>
      <button
        type="submit"
        className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold ${
          preset === "custom" ? "bg-blue-600 text-white" : "bg-slate-800 text-white dark:bg-slate-700"
        }`}
      >
        {L.apply}
      </button>
      {action}
    </form>
  </div>
);

// --- Day by day strip ----------------------------------------------------------

const DayStrip = ({ days, L, locale }: { days: MonitorDay[]; L: MonitorLabels; locale: string }) => {
  if (days.length <= 1) return null;
  return (
    <div className={`${CARD} mb-4 p-4`}>
      <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
        <span aria-hidden>📅</span> {L.dayByDay}
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {days.map((d) => {
          const tone = TONE[toneOf(d.index)];
          return (
            <div
              key={d.date}
              className={`min-w-[78px] flex-1 rounded-xl border px-2 py-2.5 text-center ${tone.soft} ${tone.border}`}
              title={`${L.homework}: ${pctText(d.homework.pct)} - ${L.conducted}: ${pctText(d.conducted.pct)}`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {fmtDay(d.date, locale, { weekday: "short" })}
              </p>
              <p className="text-[10px] text-slate-400">{fmtDay(d.date, locale, { day: "numeric", month: "short" })}</p>
              <p className={`mt-1.5 text-lg font-bold ${tone.text}`}>{pctText(d.index)}</p>
              <div className="mx-auto mt-1.5 h-1.5 w-10 overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-700/60">
                <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${d.index ?? 0}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// --- Table -----------------------------------------------------------------

const Cell = ({ m }: { m: MonitorMetric }) => (
  <td className="px-3 py-3 text-center">
    <span className={`text-sm font-semibold ${TONE[toneOf(m.pct)].text}`}>{pctText(m.pct)}</span>
    <span className="block text-[10px] text-slate-400">({m.total > 0 ? `${m.done} / ${m.total}` : "- / -"})</span>
  </td>
);

const RowsTable = ({ rows, L }: { rows: MonitorRow[]; L: MonitorLabels }) => (
  <div className={`${CARD} overflow-hidden`}>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            <th className="px-4 py-3">{L.classCol}</th>
            <th className="px-3 py-3">{L.subjectCol}</th>
            <th className="px-3 py-3 text-center">{L.index}</th>
            <th className="px-3 py-3 text-center">{L.conducted}</th>
            <th className="px-3 py-3 text-center">{L.topics}</th>
            <th className="px-3 py-3 text-center">{L.grades}</th>
            <th className="px-3 py-3 text-center">{L.homework}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
          {rows.map((r) => {
            const tone = TONE[toneOf(r.index)];
            return (
              <tr key={r.key} className="transition hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                <td className="px-4 py-3">
                  <span className={`mr-2 inline-block h-6 w-1 rounded-full align-middle ${tone.bar}`} />
                  <span className="font-semibold text-slate-800 dark:text-slate-100">{r.className}</span>
                  <span className="ml-2 text-[11px] text-slate-400">{L.lessonsN(r.lessons)}</span>
                </td>
                <td className="px-3 py-3 text-slate-700 dark:text-slate-200">{r.subjectName}</td>
                <td className="px-3 py-3 text-center">
                  <span className={`inline-block min-w-[3.25rem] rounded-full px-2.5 py-1 text-xs font-bold ${tone.chip}`}>
                    {pctText(r.index)}
                  </span>
                </td>
                <Cell m={r.conducted} />
                <Cell m={r.topics} />
                <Cell m={r.grades} />
                <Cell m={r.homework} />
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
);

// --- One teacher's cabinet -----------------------------------------------------

export const TeacherCabinet = ({
  teacher,
  L,
  locale,
  schoolDays,
  rangeLabel,
  exportHref,
  backHref,
  title,
  subtitle,
}: {
  teacher: TeacherMonitor;
  L: MonitorLabels;
  locale: string;
  schoolDays: number;
  rangeLabel: string;
  exportHref: string;
  backHref?: string;
  title: string;
  subtitle: string;
}) => (
  <div>
    <div className="page-top-banner relative mb-4 overflow-hidden p-5 md:p-6 shine-hover">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <TeacherAvatar name={teacher.name} img={teacher.img} className="h-20 w-20 text-2xl" />
          <div className="min-w-0">
            {backHref && (
              <Link href={backHref} className="mb-1 inline-block text-xs font-semibold text-white/85 underline-offset-2 hover:underline">
                &larr; {L.back}
              </Link>
            )}
            <h1 className="truncate text-2xl font-bold tracking-tight md:text-3xl">{teacher.name}</h1>
            <p className="mt-0.5 text-sm text-blue-50">{teacher.position ?? title}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-blue-900">{rangeLabel}</span>
              <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-blue-900">
                {L.schoolDays(schoolDays)}
              </span>
              <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-blue-900">
                {L.lessonsN(teacher.lessons)}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl bg-white/15 px-4 py-3 backdrop-blur-sm">
          <ScoreRing value={teacher.index} size={96} stroke={11} onDark textClass="text-2xl" />
          <div>
            <p className="text-sm font-semibold">{L.index}</p>
            <p className="mt-1 max-w-[180px] text-[11px] text-white/80">{subtitle}</p>
          </div>
        </div>
      </div>
    </div>

    <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <MetricTile icon="📝" label={L.homework} metric={teacher.homework} highlight />
      <MetricTile icon="✅" label={L.conducted} metric={teacher.conducted} />
      <MetricTile icon="🏷️" label={L.topics} metric={teacher.topics} />
      <MetricTile icon="⭐" label={L.grades} metric={teacher.grades} emptyNote={L.noGrades} />
    </div>

    <DayStrip days={teacher.days} L={L} locale={locale} />

    <div className="mb-2 mt-5 flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{L.byClassTitle}</h2>
      <a
        href={exportHref}
        className="rounded-lg border border-emerald-500 bg-white px-3.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 dark:bg-slate-900 dark:hover:bg-emerald-950/30"
      >
        <span aria-hidden>📥</span> {L.export}
      </a>
    </div>
    {teacher.rows.length === 0 ? (
      <div className={`${CARD} p-8 text-center text-sm text-slate-500`}>{L.noLessons}</div>
    ) : (
      <RowsTable rows={teacher.rows} L={L} />
    )}
    <p className="mt-4 text-[11px] leading-relaxed text-slate-400">{L.footnote}</p>
  </div>
);

// --- Principal's overview ----------------------------------------------------------

export const OverviewSummary = ({
  L,
  average,
  gaveHomework,
  withLessons,
  needAttention,
}: {
  L: MonitorLabels;
  average: number | null;
  gaveHomework: number;
  withLessons: number;
  needAttention: number;
}) => (
  <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
    <div className={`${CARD} flex items-center gap-4 p-4`}>
      <ScoreRing value={average} size={72} stroke={11} textClass="text-base" />
      <div>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{L.schoolAverage}</p>
        <p className="text-xs text-slate-400">{L.index}</p>
      </div>
    </div>
    <div className={`${CARD} flex items-center gap-4 p-4`}>
      <ScoreRing
        value={withLessons > 0 ? Math.round((gaveHomework / withLessons) * 100) : null}
        size={72}
        stroke={11}
        textClass="text-base"
      />
      <div>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{L.homework}</p>
        <p className="text-xs text-slate-400">{L.gaveHomework(gaveHomework, withLessons)}</p>
      </div>
    </div>
    <div className={`${CARD} flex items-center gap-4 p-4`}>
      <div
        className={`flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full text-2xl font-bold ${
          needAttention > 0 ? TONE.low.chip : TONE.great.chip
        }`}
      >
        {needAttention}
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{L.needsAttention}</p>
        <p className="text-xs text-slate-400">{L.legendLow}</p>
      </div>
    </div>
  </div>
);

const MiniBar = ({ label, m }: { label: string; m: MonitorMetric }) => {
  const tone = TONE[toneOf(m.pct)];
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-[11px]">
        <span className="truncate text-slate-500 dark:text-slate-400">{label}</span>
        <span className={`font-semibold ${tone.text}`}>{pctText(m.pct)}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-700/60">
        <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${m.pct ?? 0}%` }} />
      </div>
    </div>
  );
};

export const TeacherCard = ({ teacher, L, href }: { teacher: TeacherMonitor; L: MonitorLabels; href: string }) => {
  const tone = TONE[toneOf(teacher.index)];
  return (
    <Link
      href={href}
      className={`group ${CARD} block overflow-hidden p-4 transition hover:-translate-y-0.5 hover:shadow-md`}
    >
      <div className={`-mx-4 -mt-4 mb-3 h-1.5 ${tone.bar}`} />
      <div className="flex items-center gap-3">
        <TeacherAvatar name={teacher.name} img={teacher.img} className="h-12 w-12 text-base" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{teacher.name}</p>
          <p className="truncate text-[11px] text-slate-400">
            {teacher.lessons > 0 ? L.lessonsN(teacher.lessons) : L.noLessons}
          </p>
        </div>
        <ScoreRing value={teacher.index} size={56} stroke={12} textClass="text-xs" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
        <MiniBar label={L.homework} m={teacher.homework} />
        <MiniBar label={L.conducted} m={teacher.conducted} />
        <MiniBar label={L.topics} m={teacher.topics} />
        <MiniBar label={L.grades} m={teacher.grades} />
      </div>
      <p className="mt-3 text-right text-[11px] font-semibold text-blue-600 opacity-80 transition group-hover:opacity-100 dark:text-blue-400">
        {L.openCabinet} &rarr;
      </p>
    </Link>
  );
};

export const Legend = ({ L }: { L: MonitorLabels }) => (
  <div className="mb-3 flex flex-wrap gap-2 text-[11px]">
    <span className={`rounded-full px-2.5 py-1 font-semibold ${TONE.great.chip}`}>{L.legendGreat}</span>
    <span className={`rounded-full px-2.5 py-1 font-semibold ${TONE.fair.chip}`}>{L.legendFair}</span>
    <span className={`rounded-full px-2.5 py-1 font-semibold ${TONE.low.chip}`}>{L.legendLow}</span>
  </div>
);
