import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { routeAccessMap } from "@/lib/settings";
import { isValidYmd, loadNoiseDay } from "@/lib/noise";
import NoiseTodayBoard from "@/components/noise/NoiseTodayBoard";
import { Hero } from "@/components/hallPass/HallPassUi";

export const dynamic = "force-dynamic";

// Admin view: which classes are noisy today. Each classroom board (a teacher account
// signed in on the Promethean panel) reports loudness numbers; this page ranks them.
const NoiseMonitorPage = async ({ searchParams }: { searchParams: { date?: string } }) => {
  requireRole(routeAccessMap["/dashboard/list/noise-monitor"]);
  const t = await getTranslations("Noise");
  const payload = await loadNoiseDay(isValidYmd(searchParams.date) ? searchParams.date : undefined);

  return (
    <div className="flex flex-col gap-4 p-4">
      <Hero title={t("title")} subtitle={t("subtitleAdmin")} />
      <div>
        <Link
          href="/dashboard/list/noise-monitor/board"
          className="inline-block rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {t("admin.openBoard")}
        </Link>
      </div>
      <NoiseTodayBoard initial={payload} />
    </div>
  );
};

export default NoiseMonitorPage;
