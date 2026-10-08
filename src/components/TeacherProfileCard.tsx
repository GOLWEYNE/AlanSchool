import { getTranslations } from "next-intl/server";
import prisma from "@/lib/prisma";
import { currentSchoolYear } from "@/lib/schoolYear";
import { TERMS, ensureTeacherProfile, parseAchievements } from "@/lib/teacherProfile";

// Read-only view of a teacher's own profile (background, achievements, and, for
// the teacher and admins only, their vision and term objectives).
export default async function TeacherProfileCard({
  teacherId,
  canSeeGoals,
}: {
  teacherId: string;
  canSeeGoals: boolean;
}) {
  if (!(await ensureTeacherProfile())) return null;
  const t = await getTranslations("TeacherProfile");

  const [profile, objectives] = await Promise.all([
    prisma.teacherProfile.findUnique({ where: { teacherId } }),
    canSeeGoals
      ? prisma.teacherObjective.findMany({
          where: { teacherId, schoolYear: currentSchoolYear() },
          orderBy: [{ term: "asc" }, { id: "asc" }],
        })
      : Promise.resolve([]),
  ]);

  if (!profile?.completedAt) {
    return (
      <div className="bg-white dark:bg-slate-900 p-4 rounded-md text-sm text-gray-500 dark:text-slate-400">
        {t("card.notCompleted")}
      </div>
    );
  }

  const achievements = parseAchievements(profile.achievements);
  const rows: [string, string | null | undefined][] = [
    [t("identity.department"), profile.department],
    [t("identity.yearJoined"), profile.yearJoined ? String(profile.yearJoined) : null],
    [t("background.yearsExperience"), profile.yearsExperience != null ? String(profile.yearsExperience) : null],
    [t("background.education"), profile.education],
    [t("background.previousSchools"), profile.previousSchools],
    [t("background.certificates"), profile.certificates],
  ];

  return (
    <div className="bg-white dark:bg-slate-900 p-4 rounded-md flex flex-col gap-4">
      <h2 className="text-xl font-semibold">{t("card.title")}</h2>
      {profile.position && (
        <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
          {t(`positions.${profile.position}`)}
        </p>
      )}
      {profile.about && <p className="text-sm text-gray-600 dark:text-slate-300">{profile.about}</p>}
      <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
        {rows
          .filter(([, v]) => v)
          .map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-gray-500 dark:text-slate-400">{label}</dt>
              <dd className="font-medium whitespace-pre-line">{value}</dd>
            </div>
          ))}
      </dl>
      {achievements.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold">{t("achievements.title")}</h3>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {achievements.map((a, i) => (
              <li key={i}>
                <span className="font-medium">{a.title}</span>
                {a.year ? <span className="text-gray-500"> ({a.year})</span> : null}
                {a.note ? <span className="text-gray-500"> - {a.note}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      )}
      {canSeeGoals && (profile.vision || objectives.length > 0) && (
        <div className="rounded-lg bg-blue-50 p-3 dark:bg-slate-800">
          <h3 className="text-sm font-semibold">{t("goals.title")}</h3>
          {profile.vision && <p className="mt-1 text-sm whitespace-pre-line">{profile.vision}</p>}
          {objectives.length > 0 && (
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              {TERMS.map((term) => {
                const list = objectives.filter((o) => o.term === term);
                if (list.length === 0) return null;
                return (
                  <div key={term}>
                    <p className="text-xs font-semibold text-blue-900 dark:text-blue-100">{t("goals.term", { term })}</p>
                    <ul className="mt-1 text-sm">
                      {list.map((o) => (
                        <li key={o.id}>
                          {o.text}{" "}
                          <span className="text-xs text-gray-500">
                            ({t(`status.${o.status}` as never)})
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
