import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { routeAccessMap } from "@/lib/settings";
import prisma from "@/lib/prisma";
import { loadAnnouncements, viewerAudience } from "@/lib/libraryAnnouncements";
import { ANNOUNCEMENT_TYPES, ANNOUNCEMENT_TYPE_KEYS } from "@/lib/libraryShared";
import AnnouncementCard from "@/components/library/AnnouncementCard";
import { Empty } from "@/components/library/LibraryUi";

type TFn = (key: string, values?: Record<string, string | number>) => string;
type SP = { [key: string]: string | undefined };
const BASE = "/dashboard/list/library/announcements";

// Everyone (admin, teacher, student, parent) can read announcements; students and
// parents only see school-wide ones and the ones aimed at their own grade or class.
const LibraryAnnouncements = async ({ searchParams }: { searchParams: Promise<SP> | SP }) => {
  const { userId, role } = requireRole(routeAccessMap["/dashboard/list/library(.*)"]);
  const t = (await getTranslations("Library")) as unknown as TFn;
  const sp = await Promise.resolve(searchParams);

  const type = ANNOUNCEMENT_TYPE_KEYS.includes(sp.type ?? "") ? (sp.type as string) : undefined;
  const gradeParam = parseInt(sp.grade ?? "", 10);
  const viewer = await viewerAudience(userId, role);
  const canFilterGrade = viewer.all;
  const grade = canFilterGrade && Number.isFinite(gradeParam) ? gradeParam : undefined;

  const [items, grades] = await Promise.all([
    loadAnnouncements(viewer, { type, grade, take: 40 }),
    canFilterGrade ? prisma.grade.findMany({ orderBy: { level: "asc" }, select: { level: true } }) : Promise.resolve([]),
  ]);

  const href = (nextType?: string, nextGrade?: number) => {
    const p = new URLSearchParams();
    if (nextType) p.set("type", nextType);
    if (nextGrade) p.set("grade", String(nextGrade));
    return p.toString() ? `${BASE}?${p.toString()}` : BASE;
  };
  const chip = (active: boolean) =>
    "rounded-full px-4 py-2 text-sm font-semibold transition " +
    (active
      ? "bg-amber-400 text-blue-950 shadow"
      : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Link href={href(undefined, grade)} className={chip(!type)}>
          {t("announce.allTypes")}
        </Link>
        {ANNOUNCEMENT_TYPES.map((x) => (
          <Link key={x.key} href={href(x.key, grade)} className={chip(type === x.key)}>
            {x.emoji} {t("studio.types." + x.key + ".name")}
          </Link>
        ))}
      </div>

      {canFilterGrade && grades.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-gray-600 dark:text-slate-300">{t("announce.byGrade")}:</span>
          <Link href={href(type, undefined)} className={chip(!grade)}>
            {t("studio.allGrades")}
          </Link>
          {grades.map((g) => (
            <Link key={g.level} href={href(type, g.level)} className={chip(grade === g.level)}>
              {t("studio.gradeLabel", { n: g.level })}
            </Link>
          ))}
        </div>
      )}

      {items.length === 0 ? (
        <Empty>{t("announce.empty")}</Empty>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {items.map((item) => (
            <AnnouncementCard key={item.id} item={item} t={t} />
          ))}
        </div>
      )}
    </div>
  );
};

export default LibraryAnnouncements;
