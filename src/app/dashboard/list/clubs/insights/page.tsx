import Link from "next/link";
import { getLocale } from "next-intl/server";
import PageHero from "@/components/PageHero";
import { requireRole } from "@/lib/auth";
import { routeAccessMap } from "@/lib/settings";
import { getClubInsights, resolveClubWeek } from "@/lib/clubInsights";
import { clubInsightsLabels } from "@/lib/clubInsightsLabels";
import { getSupervisedClubIds } from "@/lib/clubSupervision";
import { getClubIntegrity } from "@/lib/clubIntegrity";
import { clubRulesLabels } from "@/lib/clubRulesLabels";
import { addDays } from "@/lib/uniform";
import {
  ClubDetails,
  ClubIntegrityPanel,
  DailyTotals,
  InsightsLegend,
  TodayCards,
  WeekNav,
  WeeklyRating,
} from "@/components/ClubInsights";

type SP = { week?: string; clubId?: string };

// The principal's window on the after-school clubs: how many students came
// today, how many came every day of the week, a weekly rating for each club,
// and - inside each club - its supervisor's rating and attendance by class.
// Admins see every club; a teacher only the clubs they supervise.
const ClubInsightsPage = async ({ searchParams }: { searchParams: SP }) => {
  const { userId, role } = requireRole(routeAccessMap["/dashboard/list/clubs/insights(.*)"]);
  const locale = await getLocale();
  const L = clubInsightsLabels(locale);
  const R = clubRulesLabels(locale);

  const clubIds = role === "teacher" ? await getSupervisedClubIds(userId) : undefined;
  const [data, integrity] = await Promise.all([
    getClubInsights({ weekOf: searchParams.week, clubIds }),
    getClubIntegrity({ clubIds }),
  ]);

  const { monday: thisMonday } = resolveClubWeek(undefined);
  const isCurrentWeek = data.monday === thisMonday;
  const nextMonday = addDays(data.monday, 7);
  const nextHref = nextMonday <= data.today ? `?week=${nextMonday}` : null;

  const selectedClubId = Number(searchParams.clubId);
  const weekQs = isCurrentWeek ? "" : `&week=${data.monday}`;
  const clubHref = (id: number) => `?clubId=${id}${weekQs}#club-${id}`;

  return (
    <div className="panel-card p-4 md:p-5 flex-1 m-4 mt-0 list-page-shell">
      <PageHero
        title={L.title}
        subtitle={L.subtitle}
        emoji="🎯"
        stats={[
          { label: L.studentsToday, value: data.todaySummary.uniqueCame },
          { label: R.rateTodayTitle, value: data.todaySummary.pct === null ? "-" : `${data.todaySummary.pct}%` },
          { label: L.clubsMet, value: L.clubsMetOf(data.todaySummary.clubsMet, data.todaySummary.clubsTotal) },
        ]}
        action={
          <Link
            href="/dashboard/list/clubs"
            className="inline-block rounded-md bg-white/90 px-3 py-1.5 text-xs font-semibold text-blue-900 hover:bg-white"
          >
            &larr; {L.backToClubs}
          </Link>
        }
      />

      {data.clubs.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-base font-semibold text-slate-700 dark:text-slate-200">{L.emptyTitle}</p>
          <p className="mt-1 text-sm text-slate-400">{L.emptyBody}</p>
        </div>
      ) : (
        <>
          <TodayCards L={L} R={R} data={data} multiClub={integrity.doubleToday.length} />

          <ClubIntegrityPanel R={R} data={integrity} />

          <WeekNav
            L={L}
            locale={locale}
            data={data}
            prevHref={`?week=${addDays(data.monday, -7)}`}
            nextHref={nextHref}
            thisWeekHref="?"
            isCurrentWeek={isCurrentWeek}
          />

          <DailyTotals L={L} locale={locale} data={data} />

          <InsightsLegend L={L} />
          <WeeklyRating L={L} locale={locale} data={data} clubHref={clubHref} />

          <div className="mb-2 mt-6">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              <span aria-hidden>🔎</span> {L.insideTitle}
            </h2>
            <p className="text-xs text-slate-400">{L.insideHint}</p>
          </div>
          <div className="mt-3">
            {data.clubs.map((club) => (
              <ClubDetails key={club.id} L={L} club={club} open={club.id === selectedClubId} />
            ))}
          </div>

          <p className="mt-5 text-[11px] leading-relaxed text-slate-400">{L.footnote}</p>
        </>
      )}
    </div>
  );
};

export default ClubInsightsPage;
