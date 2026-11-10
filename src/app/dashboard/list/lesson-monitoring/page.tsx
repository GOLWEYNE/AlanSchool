import Link from "next/link";
import { getLocale } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { routeAccessMap } from "@/lib/settings";
import { getLessonMonitoring, resolveMonitorRange, type MonitorPreset } from "@/lib/lessonMonitoring";
import { monitorLabels } from "@/lib/lessonMonitoringLabels";
import {
  Legend,
  OverviewSummary,
  RangeBar,
  TeacherCabinet,
  TeacherCard,
  fmtDay,
} from "@/components/LessonMonitoring";

type SP = { preset?: string; from?: string; to?: string; teacherId?: string; q?: string };

// The principal's window on daily lesson work. Admins see every teacher (lowest
// journal index first) and can open any teacher's cabinet; a teacher is taken
// straight to their own cabinet and can never see anyone else's.
const LessonMonitoringPage = async ({ searchParams }: { searchParams: SP }) => {
  const { userId, role } = requireRole(routeAccessMap["/dashboard/list/lesson-monitoring(.*)"]);
  const locale = await getLocale();
  const L = monitorLabels(locale);

  const range = resolveMonitorRange(searchParams);
  const isAdmin = role === "admin";
  const teacherId = isAdmin ? searchParams.teacherId || undefined : userId;
  const data = await getLessonMonitoring({ range, teacherId });

  const dayFmt: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
  const rangeLabel =
    range.from === range.to
      ? fmtDay(range.from, locale, dayFmt)
      : `${fmtDay(range.from, locale, dayFmt)} - ${fmtDay(range.to, locale, dayFmt)}`;

  const baseParams = new URLSearchParams();
  if (isAdmin && teacherId) baseParams.set("teacherId", teacherId);
  if (isAdmin && searchParams.q) baseParams.set("q", searchParams.q);

  const hrefFor = (p: MonitorPreset) => {
    const qs = new URLSearchParams(baseParams);
    qs.set("preset", p);
    return `?${qs.toString()}`;
  };
  const hidden: Record<string, string> = {};
  baseParams.forEach((v, k) => {
    hidden[k] = v;
  });

  const exportParams = new URLSearchParams({ from: range.from, to: range.to });
  if (isAdmin && teacherId) exportParams.set("teacherId", teacherId);
  const exportHref = `/api/lesson-monitoring/export?${exportParams.toString()}`;

  // ---- One teacher's cabinet (a teacher's own, or the principal drilling in) ----
  if (teacherId) {
    const teacher = data.teachers[0];
    return (
      <div className="flex-1 p-4 md:p-6">
        <RangeBar
          L={L}
          preset={range.preset}
          from={range.from}
          to={range.to}
          hrefFor={hrefFor}
          hidden={hidden}
        />
        {teacher ? (
          <TeacherCabinet
            teacher={teacher}
            L={L}
            locale={locale}
            schoolDays={data.schoolDays.length}
            rangeLabel={rangeLabel}
            exportHref={exportHref}
            backHref={isAdmin ? `?preset=${range.preset}${range.preset === "custom" ? `&from=${range.from}&to=${range.to}` : ""}` : undefined}
            title={isAdmin ? L.title : L.myTitle}
            subtitle={L.liveNote}
          />
        ) : (
          <div className="glass-surface p-10 text-center">
            <p className="text-base font-semibold text-slate-700 dark:text-slate-200">{L.noLessons}</p>
            {isAdmin && (
              <Link href="?" className="mt-3 inline-block text-sm font-semibold text-blue-600 hover:underline">
                &larr; {L.back}
              </Link>
            )}
          </div>
        )}
      </div>
    );
  }

  // ---- Principal's overview of every teacher ----
  const withLessons = data.teachers.filter((t) => t.lessons > 0);
  const scored = withLessons.filter((t) => t.index !== null);
  const average = scored.length
    ? Math.round(scored.reduce((s, t) => s + (t.index as number), 0) / scored.length)
    : null;
  const gaveHomework = withLessons.filter((t) => t.homework.done > 0).length;
  const needAttention = scored.filter((t) => (t.index as number) < 50).length;

  const q = (searchParams.q ?? "").trim().toLowerCase();
  const shown = q ? data.teachers.filter((t) => t.name.toLowerCase().includes(q)) : data.teachers;

  const openHref = (id: string) => {
    const qs = new URLSearchParams({ teacherId: id, preset: range.preset });
    if (range.preset === "custom") {
      qs.set("from", range.from);
      qs.set("to", range.to);
    }
    return `?${qs.toString()}`;
  };

  return (
    <div className="flex-1 p-4 md:p-6">
      <div className="page-top-banner mb-4 p-5 shine-hover md:p-6">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          <span className="mr-2" aria-hidden>
            🧭
          </span>
          {L.title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-blue-50 md:text-base">{L.subtitle}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-blue-900">{rangeLabel}</span>
          <span className="rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-blue-900">
            {L.schoolDays(data.schoolDays.length)}
          </span>
          <span className="rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-blue-900">
            {L.teachersN(withLessons.length)}
          </span>
          <span className="rounded-full bg-white/20 px-3 py-1.5 text-xs font-semibold">{L.liveNote}</span>
        </div>
      </div>

      <RangeBar L={L} preset={range.preset} from={range.from} to={range.to} hrefFor={hrefFor} hidden={hidden} />

      <OverviewSummary
        L={L}
        average={average}
        gaveHomework={gaveHomework}
        withLessons={withLessons.length}
        needAttention={needAttention}
      />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <Legend L={L} />
        <form method="get" className="flex items-center gap-2">
          <input type="hidden" name="preset" value={range.preset} />
          {range.preset === "custom" && <input type="hidden" name="from" value={range.from} />}
          {range.preset === "custom" && <input type="hidden" name="to" value={range.to} />}
          <input
            type="search"
            name="q"
            defaultValue={searchParams.q ?? ""}
            placeholder={L.search}
            className="w-56 rounded-full border border-gray-200/80 bg-white/70 px-4 py-2 text-xs text-slate-700 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200"
          />
        </form>
      </div>

      {shown.length === 0 ? (
        <div className="glass-surface p-10 text-center">
          <p className="text-base font-semibold text-slate-700 dark:text-slate-200">{L.emptyTitle}</p>
          <p className="mt-1 text-sm text-slate-400">{L.emptyBody}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((t) => (
            <TeacherCard key={t.id} teacher={t} L={L} href={openHref(t.id)} />
          ))}
        </div>
      )}

      <p className="mt-5 text-[11px] leading-relaxed text-slate-400">{L.footnote}</p>
    </div>
  );
};

export default LessonMonitoringPage;
