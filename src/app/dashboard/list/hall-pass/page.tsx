import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { routeAccessMap } from "@/lib/settings";
import { loadActivePasses, loadStudentPassState } from "@/lib/hallPass";
import ActivePassBoard from "@/components/hallPass/ActivePassBoard";
import StudentPassPanel from "@/components/hallPass/StudentPassPanel";
import { Hero, StaffNav } from "@/components/hallPass/HallPassUi";

export const dynamic = "force-dynamic";

type TFn = (key: string, values?: Record<string, string | number>) => string;

// Digital hall pass. Students request / end their own pass; teachers and admins
// watch everyone who is currently out (teachers: only their own classes).
const HallPassPage = async () => {
  const { userId, role } = requireRole(routeAccessMap["/dashboard/list/hall-pass(.*)"]);
  const t = (await getTranslations("HallPass")) as unknown as TFn;

  if (role === "student") {
    const state = await loadStudentPassState(userId);
    return (
      <div className="flex flex-col gap-4 p-4">
        <Hero title={t("title")} subtitle={t("subtitleStudent")} />
        <StudentPassPanel state={state} />
      </div>
    );
  }

  const payload = await loadActivePasses({ role: role as "admin" | "teacher", userId });
  return (
    <div className="flex flex-col gap-4 p-4">
      <Hero title={t("title")} subtitle={t("subtitleStaff")} />
      <StaffNav
        active="live"
        role={role}
        labels={{ live: t("nav.live"), history: t("nav.history"), settings: t("nav.settings") }}
      />
      <ActivePassBoard initial={payload} />
    </div>
  );
};

export default HallPassPage;
