import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import PageHero from "@/components/PageHero";
import prisma from "@/lib/prisma";
import { getUserRole } from "@/lib/auth";
import { currentSchoolYear } from "@/lib/schoolYear";
import { ensureTeacherProfile } from "@/lib/teacherProfile";

// Director overview: who has completed their profile, their position, and how
// their term objectives are going. Admin only (also enforced by middleware).
const TeacherProfilesPage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {
  const { sessionClaims } = auth();
  if (getUserRole(sessionClaims) !== "admin") redirect("/dashboard");

  const t = await getTranslations("TeacherProfile");
  const ready = await ensureTeacherProfile();

  const teachers = await prisma.teacher.findMany({
    orderBy: [{ surname: "asc" }, { name: "asc" }],
    select: { id: true, name: true, surname: true, img: true },
  });

  const [profiles, objectives] = ready
    ? await Promise.all([
        prisma.teacherProfile.findMany({
          select: { teacherId: true, photoUrl: true, position: true, vision: true, completedAt: true },
        }),
        prisma.teacherObjective.findMany({
          where: { schoolYear: currentSchoolYear() },
          select: { teacherId: true, status: true },
        }),
      ])
    : [[], []];

  const profileById = new Map(profiles.map((p) => [p.teacherId, p]));
  const rows = teachers.map((teacher) => {
    const profile = profileById.get(teacher.id);
    const mine = objectives.filter((o) => o.teacherId === teacher.id);
    return {
      teacher,
      profile,
      complete: !!profile?.completedAt,
      total: mine.length,
      achieved: mine.filter((o) => o.status === "ACHIEVED").length,
      inProgress: mine.filter((o) => o.status === "IN_PROGRESS").length,
    };
  });

  const completeCount = rows.filter((r) => r.complete).length;
  const filter = searchParams.filter === "pending" || searchParams.filter === "complete" ? searchParams.filter : "all";
  const shown = rows.filter((r) =>
    filter === "pending" ? !r.complete : filter === "complete" ? r.complete : true
  );

  const tabs: [string, string][] = [
    ["all", t("overview.all")],
    ["pending", t("overview.pending")],
    ["complete", t("overview.complete")],
  ];

  return (
    <div className="panel-card p-4 md:p-5 flex-1 m-4 mt-0 list-page-shell">
      <PageHero
        title={t("overview.title")}
        subtitle={t("overview.subtitle")}
        emoji="🧑‍🏫"
        stats={[
          { label: t("overview.teachers"), value: rows.length },
          { label: t("overview.completeLabel"), value: completeCount },
          { label: t("overview.pendingLabel"), value: rows.length - completeCount },
        ]}
      />

      <div className="flex flex-wrap gap-2 mb-4">
        {tabs.map(([key, label]) => (
          <Link
            key={key}
            href={key === "all" ? "/dashboard/list/teachers/profiles" : `/dashboard/list/teachers/profiles?filter=${key}`}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
              filter === key
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-200"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {!ready && <p className="text-sm text-gray-500 dark:text-slate-400">{t("errors.unavailable")}</p>}

      <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
        {shown.length === 0 && (
          <li className="p-4 text-sm text-gray-500 dark:text-slate-400">{t("overview.none")}</li>
        )}
        {shown.map(({ teacher, profile, complete, total, achieved, inProgress }) => (
          <li key={teacher.id}>
            <Link
              href={`/dashboard/list/teachers/${teacher.id}`}
              className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-slate-800/60"
            >
              {profile?.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.photoUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
              ) : (
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 text-lg font-bold text-gray-500 dark:bg-slate-700 dark:text-slate-300">
                  {teacher.name.charAt(0)}
                </span>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 dark:text-slate-100">
                  {teacher.name} {teacher.surname}
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  {profile?.position ? t(`positions.${profile.position}` as never) : t("overview.noPosition")}
                </p>
                {profile?.vision && (
                  <p className="mt-1 text-xs text-gray-600 dark:text-slate-300 line-clamp-2">{profile.vision}</p>
                )}
              </div>
              <div className="hidden text-right text-xs text-gray-500 dark:text-slate-400 md:block">
                {total > 0
                  ? t("overview.objectives", { total, achieved, inProgress })
                  : t("overview.noObjectives")}
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  complete
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                }`}
              >
                {complete ? t("overview.completeLabel") : t("overview.pendingLabel")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TeacherProfilesPage;
