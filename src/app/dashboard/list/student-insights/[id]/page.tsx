import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import PageHero from "@/components/PageHero";
import { requireRole } from "@/lib/auth";
import { routeAccessMap } from "@/lib/settings";
import { teacherCanAccessStudent } from "@/lib/teacherScope";
import { getStudentProfile, parseDays } from "@/lib/studentInsights";
import { studentInsightsLabels } from "@/lib/studentInsightsLabels";
import {
  ExtrasSection,
  InsightsLegend,
  OlympiadSection,
  PeriodBar,
  ProfileHeader,
  ProfileTiles,
  UniformSection,
  WeeklyAttendance,
  WorkSection,
} from "@/components/StudentInsights";

const BASE = "/dashboard/list/student-insights";

// One student's full picture: attendance by week, uniform, assignments, exams,
// olympiads (editable by staff), clubs, behaviour and mock tests.
const StudentInsightProfilePage = async ({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { days?: string };
}) => {
  const { userId, role } = requireRole(routeAccessMap["/dashboard/list/student-insights(.*)"]);
  if (role === "teacher" && !(await teacherCanAccessStudent(userId, params.id))) return notFound();

  const locale = await getLocale();
  const L = studentInsightsLabels(locale);
  const days = parseDays(searchParams.days);

  const p = await getStudentProfile({ studentId: params.id, days });
  if (!p) return notFound();

  const back = `${BASE}?classId=${p.student.classId}${days === 30 ? "" : `&days=${days}`}`;

  return (
    <div className="panel-card p-4 md:p-5 flex-1 m-4 mt-0 list-page-shell">
      <PageHero
        title={`${p.student.surname} ${p.student.name}`}
        subtitle={L.profileSubtitle}
        emoji="🧑‍🎓"
        stats={[
          { label: L.classCol, value: p.student.className },
          { label: L.index, value: p.metrics.index === null ? "-" : `${p.metrics.index}%` },
          { label: L.olympiads, value: p.metrics.olympiads.entries },
        ]}
        action={
          <Link
            href={back}
            className="inline-block rounded-md bg-white/90 px-3 py-1.5 text-xs font-semibold text-blue-900 hover:bg-white"
          >
            &larr; {L.backToClass}
          </Link>
        }
      />
      <PeriodBar L={L} days={days} href={(d) => `${BASE}/${p.student.id}${d === 30 ? "" : `?days=${d}`}`} />
      <ProfileHeader L={L} p={p} />
      <ProfileTiles L={L} p={p} />
      <InsightsLegend L={L} />
      <WeeklyAttendance L={L} p={p} locale={locale} />
      <OlympiadSection L={L} studentId={p.student.id} rows={p.olympiads} canEdit locale={locale} />
      <UniformSection L={L} p={p} locale={locale} />
      <WorkSection L={L} p={p} locale={locale} />
      <ExtrasSection L={L} p={p} locale={locale} />
      <p className="mt-5 text-[11px] leading-relaxed text-slate-400">{L.footnote}</p>
    </div>
  );
};

export default StudentInsightProfilePage;
