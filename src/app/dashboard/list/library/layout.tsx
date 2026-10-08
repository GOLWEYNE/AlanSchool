import { ReactNode } from "react";
import { auth } from "@clerk/nextjs/server";
import { getTranslations } from "next-intl/server";
import { getUserRole, requireRole } from "@/lib/auth";
import { routeAccessMap } from "@/lib/settings";
import { canManageLibrary, ensureLibrary } from "@/lib/library";
import { LibraryNav } from "@/components/library/LibraryClient";
import { CARD } from "@/components/library/LibraryUi";

const BASE = "/dashboard/list/library";

// Shared frame for every library page: hero banner, tab bar, and a friendly
// notice if the library tables could not be prepared.
export default async function LibraryLayout({ children }: { children: ReactNode }) {
  requireRole(routeAccessMap["/dashboard/list/library(.*)"]);
  const { userId, sessionClaims } = await auth();
  const role = getUserRole(sessionClaims);
  const t = await getTranslations("Library");

  const ready = await ensureLibrary();
  const manager = ready ? await canManageLibrary(userId, role) : false;

  const tabs = [
    { href: BASE, label: t("tabs.home") },
    { href: BASE + "/books", label: t("tabs.books") },
    { href: BASE + "/stats", label: t("tabs.stats") },
    { href: BASE + "/community", label: t("tabs.community") },
    ...(manager ? [{ href: BASE + "/desk", label: t("tabs.desk") }] : []),
  ];

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="page-top-banner shine-hover p-5 md:p-6">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          <span className="mr-2">📚</span>
          {t("title")}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-blue-50 md:text-base">{t("subtitle")}</p>
      </div>
      <LibraryNav tabs={tabs} />
      {ready ? (
        children
      ) : (
        <div className={CARD}>
          <h2 className="text-lg font-bold text-gray-800 dark:text-blue-100">{t("setup.title")}</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-slate-300">{t("setup.body")}</p>
          <code className="mt-3 block rounded-lg bg-gray-100 p-3 text-xs dark:bg-slate-800">
            npx prisma migrate deploy
          </code>
        </div>
      )}
    </div>
  );
}
