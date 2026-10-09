import { getTranslations } from "next-intl/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { routeAccessMap } from "@/lib/settings";
import { ensureHallPass, closeStalePasses } from "@/lib/hallPass";
import DestinationManager from "@/components/hallPass/DestinationManager";
import RestrictedGroupManager from "@/components/hallPass/RestrictedGroupManager";
import { CARD, Hero, StaffNav } from "@/components/hallPass/HallPassUi";

export const dynamic = "force-dynamic";

type TFn = (key: string, values?: Record<string, string | number>) => string;

// Admin-only configuration: destinations (limits, on/off) and restricted groups.
const HallPassSettingsPage = async () => {
  const { role } = requireRole(routeAccessMap["/dashboard/list/hall-pass/settings(.*)"]);
  const t = (await getTranslations("HallPass")) as unknown as TFn;

  await ensureHallPass();
  await closeStalePasses();

  const [destinations, groups, outNow] = await Promise.all([
    prisma.passDestination.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.restrictedGroup.findMany({
      orderBy: { name: "asc" },
      include: {
        members: {
          include: { student: { select: { id: true, name: true, surname: true, username: true, class: { select: { name: true } } } } },
        },
      },
    }),
    prisma.hallPass.findMany({ where: { status: "ACTIVE" }, select: { studentId: true } }),
  ]);
  const outIds = new Set(outNow.map((p) => p.studentId));

  return (
    <div className="flex flex-col gap-4 p-4">
      <Hero title={t("title")} subtitle={t("subtitleSettings")} />
      <StaffNav
        active="settings"
        role={role}
        labels={{ live: t("nav.live"), history: t("nav.history"), settings: t("nav.settings") }}
      />

      <section className={CARD + " flex flex-col gap-3"}>
        <h2 className="text-lg font-semibold dark:text-slate-100">{t("settings.destinations.title")}</h2>
        <DestinationManager
          destinations={destinations.map((d) => ({
            id: d.id,
            name: d.name,
            maxMinutes: d.maxMinutes,
            maxConcurrent: d.maxConcurrent,
            active: d.active,
            sortOrder: d.sortOrder,
          }))}
        />
      </section>

      <section className={CARD + " flex flex-col gap-3"}>
        <h2 className="text-lg font-semibold dark:text-slate-100">{t("settings.groups.title")}</h2>
        <RestrictedGroupManager
          groups={groups.map((g) => {
            const members = g.members
              .map((m) => ({
                id: m.student.id,
                name: `${m.student.name} ${m.student.surname}`,
                username: m.student.username,
                className: m.student.class.name,
                isOut: outIds.has(m.student.id),
              }))
              .sort((a, b) => a.name.localeCompare(b.name));
            return {
              id: g.id,
              name: g.name,
              note: g.note,
              active: g.active,
              outNow: members.filter((m) => m.isOut).length,
              members,
            };
          })}
        />
      </section>
    </div>
  );
};

export default HallPassSettingsPage;
