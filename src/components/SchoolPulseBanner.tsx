import Link from "next/link";
import { getLocale } from "next-intl/server";
import { getSchoolPulse, parsePeriod, type DutyStat, type PulsePeriod } from "@/lib/schoolPulse";
import { pulseLabels } from "@/lib/schoolPulseLabels";
import { dateLocale } from "@/lib/dateLocale";

const PERIODS: PulsePeriod[] = ["day", "week", "term"];

// Ring gauge: big percentage inside a circular progress track.
const Ring = ({ value, color }: { value: number | null; color: string }) => {
  const r = 38;
  const c = 2 * Math.PI * r;
  const v = value ?? 0;
  return (
    <svg viewBox="0 0 100 100" className="w-24 h-24 shrink-0 -rotate-90" aria-hidden>
      <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="10" />
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${(c * v) / 100} ${c}`}
      />
    </svg>
  );
};

const Gauge = ({
  emoji,
  title,
  stat,
  color,
  hint,
  extra,
  noData,
}: {
  emoji: string;
  title: string;
  stat: Pick<DutyStat, "pct" | "onTrack" | "expected">;
  color: string;
  hint: string;
  extra?: string | null;
  noData: string;
}) => (
  <div className="rounded-xl bg-white/15 p-4 backdrop-blur-sm flex items-center gap-4">
    <div className="relative">
      <Ring value={stat.pct} color={color} />
      <div className="absolute inset-0 flex items-center justify-center text-xl font-bold">
        {stat.pct === null ? "-" : `${stat.pct}%`}
      </div>
    </div>
    <div className="min-w-0">
      <p className="text-sm font-semibold flex items-center gap-1.5">
        <span aria-hidden>{emoji}</span>
        <span className="truncate">{title}</span>
      </p>
      {stat.pct === null ? (
        <p className="text-xs text-white/80 mt-1">{noData}</p>
      ) : (
        <>
          <p className="text-xs text-white/90 mt-1">{hint}</p>
          {extra && <p className="text-[11px] text-white/70 mt-0.5">{extra}</p>}
        </>
      )}
    </div>
  </div>
);

const SchoolPulseBanner = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {
  const locale = await getLocale();
  const L = pulseLabels(locale);
  const period = parsePeriod(searchParams.pulse);
  const pulse = await getSchoolPulse(period);
  const { range } = pulse;

  const hrefFor = (p: PulsePeriod) => {
    const qs = new URLSearchParams();
    Object.entries(searchParams).forEach(([k, v]) => {
      if (v !== undefined && k !== "pulse") qs.set(k, v);
    });
    qs.set("pulse", p);
    return `?${qs.toString()}`;
  };

  const fmt = new Intl.DateTimeFormat(dateLocale(locale), { day: "numeric", month: "short", timeZone: "UTC" });
  const rangeLabel =
    range.from === range.to
      ? fmt.format(new Date(`${range.from}T00:00:00Z`))
      : `${fmt.format(new Date(`${range.from}T00:00:00Z`))} - ${fmt.format(new Date(`${range.to}T00:00:00Z`))}`;
  const periodTitle = period === "term" && range.termNumber ? L.termN(range.termNumber) : L[period];

  const maxLessons = Math.max(1, ...pulse.week.map((d) => d.lessons));

  const dutyHint = (s: DutyStat) =>
    period === "day"
      ? `${L.teachersOf(s.onTrack, s.expected)} ${L.doneToday}`
      : `${L.teachersOf(s.onTrack, s.expected)} ${L.onTrackHint}`;
  const dutyExtra = (s: DutyStat) =>
    period === "day" ? null : s.daysPct === null ? null : L.daysDone(s.daysDone, s.daysExpected);

  return (
    <div className="relative overflow-hidden rounded-2xl p-5 text-white shine-hover bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-600 shadow-lg">
      <div
        className="pointer-events-none absolute inset-0 opacity-15"
        style={{
          backgroundImage: "radial-gradient(circle, #fff 1.5px, transparent 1.5px)",
          backgroundSize: "20px 20px",
        }}
      />

      {/* HEADER + PERIOD SWITCH */}
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <span aria-hidden>📊</span> {L.title}
          </h2>
          <p className="text-sm text-blue-50 mt-1">{L.subtitle}</p>
          <p className="text-xs text-white/80 mt-2">
            <span className="rounded-full bg-white/20 px-2 py-0.5 font-semibold">{periodTitle}</span>{" "}
            {rangeLabel} · {L.schoolDays(pulse.schoolDays)}
          </p>
        </div>
        <div className="flex rounded-full bg-white/15 p-1 text-xs font-semibold">
          {PERIODS.map((p) => (
            <Link
              key={p}
              href={hrefFor(p)}
              scroll={false}
              className={`rounded-full px-3 py-1.5 transition ${
                p === period ? "bg-white text-blue-700 shadow" : "text-white/90 hover:bg-white/15"
              }`}
            >
              {L[p]}
            </Link>
          ))}
        </div>
      </div>

      {/* THREE DUTY GAUGES */}
      <div className="relative mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
        <Gauge
          emoji="🎯"
          title={L.kpa}
          stat={pulse.kpa}
          color="#fde68a"
          hint={`${L.teachersOf(pulse.kpa.onTrack, pulse.kpa.expected)} ${L.kpaHint(pulse.kpa.target)}`}
          extra={pulse.kpa.avgCoverage === null ? null : L.avgCoverage(pulse.kpa.avgCoverage)}
          noData={L.noData}
        />
        <Gauge
          emoji="👔"
          title={L.uniform}
          stat={pulse.uniform}
          color="#a7f3d0"
          hint={dutyHint(pulse.uniform)}
          extra={dutyExtra(pulse.uniform)}
          noData={L.noData}
        />
        <Gauge
          emoji="📝"
          title={L.attendance}
          stat={pulse.attendance}
          color="#bae6fd"
          hint={dutyHint(pulse.attendance)}
          extra={dutyExtra(pulse.attendance)}
          noData={L.noData}
        />
      </div>

      {/* CLUBS + TIMETABLE */}
      <div className="relative mt-3 grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* clubs */}
        <div className="rounded-xl bg-white/15 p-4 backdrop-blur-sm">
          <p className="text-sm font-semibold flex items-center gap-1.5">
            <span aria-hidden>🎨</span> {L.clubs}
          </p>
          <p className="mt-2 flex items-baseline gap-1.5">
            <span className="text-4xl font-bold">{pulse.clubs.active}</span>
            <span className="text-sm text-white/80">
              {L.ofTotal(pulse.clubs.total)} {L.activeClubs}
            </span>
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            <span className="rounded-full bg-white/20 px-2 py-1">
              👦 {pulse.clubs.studentsEnrolled} {L.studentsInClubs}
            </span>
            <span className="rounded-full bg-white/20 px-2 py-1">
              ✅ {pulse.clubs.sessions} {L.clubSessions}
            </span>
            {pulse.clubs.withoutLeader > 0 && (
              <span className="rounded-full bg-amber-300 text-amber-900 px-2 py-1 font-semibold">
                ⚠️ {L.noLeader(pulse.clubs.withoutLeader)}
              </span>
            )}
          </div>
        </div>

        {/* timetable */}
        <div className="rounded-xl bg-white/15 p-4 backdrop-blur-sm lg:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold flex items-center gap-1.5">
              <span aria-hidden>🗓️</span> {L.schedule}
            </p>
            {pulse.today.isSchoolDay && (
              <span className="text-[11px] text-white/85">{L.teachingToday(pulse.today.teachersTeaching)}</span>
            )}
          </div>
          <div className="mt-3 grid grid-cols-5 gap-2">
            {pulse.week.map((d) => (
              <div
                key={d.day}
                className={`rounded-lg px-2 py-2 text-center ${
                  d.isToday ? "bg-white text-blue-800 shadow" : "bg-white/10"
                }`}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide">{L.days[d.day]}</p>
                <div className="mx-auto mt-2 flex h-12 w-4 items-end overflow-hidden rounded-full bg-black/10">
                  <div
                    className={`w-full rounded-full ${d.isToday ? "bg-blue-600" : "bg-white/80"}`}
                    style={{ height: `${Math.max(8, Math.round((d.lessons / maxLessons) * 100))}%` }}
                  />
                </div>
                <p className="mt-1 text-sm font-bold">{d.lessons}</p>
                <p className={`text-[10px] ${d.isToday ? "text-blue-700" : "text-white/75"}`}>
                  {L.lessons} · {d.teachers} {L.teachers}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-white/90">
            {pulse.today.isSchoolDay ? (
              <>
                {L.todayLive}: <b>{pulse.today.inProgress}</b> {L.inProgress} · <b>{pulse.today.finished}</b>{" "}
                {L.finished} · <b>{pulse.today.upcoming}</b> {L.upcoming}
              </>
            ) : (
              L.noSchoolToday
            )}
          </p>
        </div>
      </div>

      {/* NEEDS A NUDGE */}
      <div className="relative mt-3 rounded-xl bg-white/10 p-4">
        <p className="text-sm font-semibold flex items-center gap-1.5">
          <span aria-hidden>💬</span> {L.nudge}
        </p>
        {pulse.nudges.length === 0 ? (
          <p className="mt-2 text-xs text-white/85">{L.nudgeNone}</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {pulse.nudges.map((t) => (
              <span key={t.id} className="rounded-full bg-white/90 text-blue-900 px-3 py-1 text-xs">
                <b>{t.name}</b>
                {t.attendance !== null && t.attendance < 80 && ` · ${L.att} ${t.attendance}%`}
                {t.uniform !== null && t.uniform < 80 && ` · ${L.uni} ${t.uniform}%`}
                {t.kpa !== null && t.kpa < pulse.kpa.target && ` · ${L.kpaShort} ${t.kpa}%`}
              </span>
            ))}
          </div>
        )}
        <p className="mt-3 text-[10px] text-white/60">{L.footnote}</p>
      </div>
    </div>
  );
};

export default SchoolPulseBanner;
