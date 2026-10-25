import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { routeAccessMap } from "@/lib/settings";
import prisma from "@/lib/prisma";
import { teacherClassWhere } from "@/lib/teacherScope";
import { getNoiseSettings } from "@/lib/noise";
import ClassroomMonitor from "@/components/noise/ClassroomMonitor";
import { Hero } from "@/components/hallPass/HallPassUi";

export const dynamic = "force-dynamic";

// The classroom board. A teacher account signed in on the Promethean panel picks the
// class once, presses Start, and the screen turns green / yellow / red with the noise.
// Admins can open it for any class (handy for testing).
const NoiseBoardPage = async () => {
  const { userId, role } = requireRole(routeAccessMap["/dashboard/list/noise-monitor/board(.*)"]);
  const t = await getTranslations("Noise");

  const classes = await prisma.class.findMany({
    where: role === "admin" ? {} : teacherClassWhere(userId),
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const settings = await getNoiseSettings();

  return (
    <div className="flex flex-col gap-4 p-4">
      <Hero title={t("title")} subtitle={t("subtitleBoard")} />
      <ClassroomMonitor classes={classes} initialSettings={settings} />
    </div>
  );
};

export default NoiseBoardPage;
