import PageHero from "@/components/PageHero";
import ClerkSyncList, { OrphanRow } from "@/components/ClerkSyncList";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { routeAccessMap } from "@/lib/settings";
import { findMissingClerkIds } from "@/lib/clerkSync";
import { getTranslations } from "next-intl/server";

// Admin-only: lists students and teachers that still exist in the school
// database but whose sign-in account has been deleted from Clerk, so they can
// be cleaned up in one go. Nothing is removed from this page without an
// explicit selection - the list is only a report.
const ClerkSyncPage = async () => {
  requireRole(routeAccessMap["/dashboard/list/clerk-sync(.*)"]);
  const t = await getTranslations("ClerkSync");

  const [students, teachers] = await Promise.all([
    prisma.student.findMany({
      select: { id: true, name: true, surname: true, username: true },
    }),
    prisma.teacher.findMany({
      select: { id: true, name: true, surname: true, username: true },
    }),
  ]);

  let rows: OrphanRow[] = [];
  let checkFailed = false;
  try {
    const missing = await findMissingClerkIds([
      ...students.map((s) => s.id),
      ...teachers.map((s) => s.id),
    ]);
    rows = [
      ...students
        .filter((s) => missing.has(s.id))
        .map((s) => ({
          key: `student:${s.id}`,
          type: "student" as const,
          name: `${s.name} ${s.surname}`,
          username: s.username,
        })),
      ...teachers
        .filter((s) => missing.has(s.id))
        .map((s) => ({
          key: `teacher:${s.id}`,
          type: "teacher" as const,
          name: `${s.name} ${s.surname}`,
          username: s.username,
        })),
    ].sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    // If Clerk can't be reached we know nothing - show an error, never a list.
    console.log("clerk-sync page: could not check Clerk:", err);
    checkFailed = true;
  }

  return (
    <div className="panel-card p-4 md:p-5 rounded-md flex-1 m-4 mt-0 list-page-shell">
      <PageHero
        title={t("title")}
        subtitle={t("subtitle")}
        emoji={t("emoji")}
        stats={[
          { label: t("stats.checked"), value: students.length + teachers.length },
          { label: t("stats.missing"), value: checkFailed ? "—" : rows.length },
        ]}
      />
      {checkFailed ? (
        <p className="mt-4 text-sm text-red-600">{t("failedCheck")}</p>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-gray-600 dark:text-slate-300">{t("none")}</p>
      ) : (
        <>
          <p className="mt-4 text-sm text-gray-600 dark:text-slate-300">{t("intro")}</p>
          <ClerkSyncList rows={rows} />
        </>
      )}
    </div>
  );
};

export default ClerkSyncPage;
