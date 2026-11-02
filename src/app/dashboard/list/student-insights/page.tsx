import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import PageHero from "@/components/PageHero";
import { requireRole } from "@/lib/auth";
import { routeAccessMap } from "@/lib/settings";
import { getTeacherClassIds } from "@/lib/teacherScope";
import { getClassDetail, getOverview, parseDays } from "@/lib/studentInsights";
import { studentInsightsLabels } from "@/lib/studentInsightsLabels";
import {
  ClassStats,
  ClassTable,
  InsightsLegend,
  PeriodBar,
  SchoolSummary,
  StudentTable,
} from "@/components/StudentInsights";

type SP = { classId?: string; days?: string };

const BASE = "/dashboard/list/student-insights";

// The principal's window on every class and every student: attendance, uniform,
// KPA, grades, assignments, clubs and olympiads. Admins see all classes; a
// teacher sees the classes they supervise or teach in.
const StudentInsightsPage = async ({ searchParams }: { searchParams: SP }) => {
  const { userId, role } = requireRole(routeAccessMap["/dashboard/list/student-insights(.*)"]);
  const locale = await getLocale();
  const L = studentInsightsLabels(locale);
  const days = parseDays(searchParams.days);
  const daysQs = days === 30 ? "" : `days=${days}`;

  const allowedClassIds = role === "teacher" ? await getTeacherClassIds(userId) : undefined;
  const classId = Number(searchParams.classId);

  // ---- one class -------------------------------------------------------------
  if (Number.isInteger(classId) && classId > 0) {
    if (allowedClassIds && !allowedClassIds.includes(classId)) return notFound();
    const detail = await getClassDetail({ classId, days });
    if (!detail) return notFound();
    const sum = detail.summary;
    return (
      <div className="panel-card p-4 md:p-5 flex-1 m-4 mt-0 list-page-shell">
        <PageHero
          title={`${L.title} · ${sum.name}`}
          subtitle={sum.supervisor ?? L.noSupervisor}
          emoji="🎓"
          stats={[
            { label: L.students, value: sum.students },
            { label: L.attendance, value: sum.attendance.pct === null ? "-" : `${sum.attendance.pct}%` },
            { label: L.index, value: sum.index === null ? "-" : `${sum.index}%` },
          ]}
          action={
            <Link
              href={daysQs ? `${BASE}?${daysQs}` : BASE}
              className="inline-block rounded-md bg-white/90 px-3 py-1.5 text-xs font-semibold text-blue-900 hover:bg-white"
            >
              &larr; {L.backToAll}
            </Link>
          }
        />
        <PeriodBar L={L} days={days} href={(d) => `${BASE}?classId=${classId}${d === 30 ? "" : `&days=${d}`}`} />
        <ClassStats L={L} summary={sum} />
        <InsightsLegend L={L} />
        <StudentTable
          L={L}
          detail={detail}
          studentHref={(id) => `${BASE}/${id}${daysQs ? `?${daysQs}` : ""}`}
        />
        <p className="mt-5 text-[11px] leading-relaxed text-slate-400">{L.footnote}</p>
      </div>
    );
  }

  // ---- all classes ---------------------------------------------------------------
  const data = await getOverview({ days, classIds: allowedClassIds });
  const school = data.school;
  return (
    <div className="panel-card p-4 md:p-5 flex-1 m-4 mt-0 list-page-shell">
      <PageHero
        title={L.title}
        subtitle={L.subtitle}
        emoji="🎓"
        stats={[
          { label: L.students, value: school.students },
          { label: L.attendance, value: school.attendance === null ? "-" : `${school.attendance}%` },
          { label: L.olympiads, value: school.olympiadEntries },
        ]}
      />
      <PeriodBar L={L} days={days} href={(d) => (d === 30 ? BASE : `${BASE}?days=${d}`)} />

      {data.classes.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-base font-semibold text-slate-700 dark:text-slate-200">{L.emptyTitle}</p>
          <p className="mt-1 text-sm text-slate-400">{L.emptyBody}</p>
        </div>
      ) : (
        <>
          <SchoolSummary L={L} school={school} />
          <InsightsLegend L={L} />
          <ClassTable
            L={L}
            classes={data.classes}
            classHref={(id) => `${BASE}?classId=${id}${days === 30 ? "" : `&days=${days}`}`}
          />
          <p className="mt-5 text-[11px] leading-relaxed text-slate-400">{L.footnote}</p>
        </>
      )}
    </div>
  );
};

export default StudentInsightsPage;
