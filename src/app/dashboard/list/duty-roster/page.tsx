import { getTranslations } from "next-intl/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { routeAccessMap } from "@/lib/settings";
import { ensureDuty, getDutySettings, getRoster } from "@/lib/duty";
import DutyRosterAdmin from "@/components/duty/DutyRosterAdmin";
import { Hero } from "@/components/hallPass/HallPassUi";

export const dynamic = "force-dynamic";

// Admin-only: edit the duty roster, link names to accounts, import, settings, days off.
const DutyRosterPage = async () => {
  requireRole(routeAccessMap["/dashboard/list/duty-roster(.*)"]);
  const t = await getTranslations("Duty");

  const ok = await ensureDuty();
  if (!ok) {
    return <div className="p-4 text-sm text-red-600">{t("tablesUnavailable")}</div>;
  }

  const [roster, settings, daysOff, accounts] = await Promise.all([
    getRoster(),
    getDutySettings(),
    prisma.dutyDayOff.findMany({ orderBy: { date: "asc" } }),
    prisma.teacher.findMany({ select: { id: true, name: true, surname: true, username: true }, orderBy: [{ surname: "asc" }, { name: "asc" }] }),
  ]);

  return (
    <div className="flex flex-col gap-4 p-4">
      <Hero title={t("adminTitle")} subtitle={t("adminSubtitle")} />
      <DutyRosterAdmin
        slots={roster.slots}
        teachers={roster.teachers}
        settings={settings}
        daysOff={daysOff.map((d) => ({ date: d.date, reason: d.reason }))}
        accounts={accounts.map((a) => ({ id: a.id, label: `${a.surname} ${a.name} (${a.username})` }))}
      />
    </div>
  );
};

export default DutyRosterPage;
