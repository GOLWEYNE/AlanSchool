import type { CSSProperties } from "react";
import { Award, IdCard, Target } from "lucide-react";
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

  const rise = { "--i": 2 } as CSSProperties;

  if (!profile?.completedAt) {
    return (
      <div
        className="glass-surface glass-rise p-5 text-sm text-slate-500 dark:text-slate-400"
        style={rise}
      >
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

  // Position and "about" are already shown in the page header above, so this
  // card keeps to the details that are not.
  return (
    <section className="glass-surface glass-rise flex flex-col gap-4 p-5" style={rise}>
      <h2 className="flex items-center gap-3 text-lg font-bold text-blue-900 dark:text-blue-100">
        <span className="glass-icon glass-icon--blue !h-9 !w-9 !rounded-xl">
          <IdCard className="h-4 w-4" aria-hidden="true" />
        </span>
        {t("card.title")}
      </h2>
      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        {rows
          .filter(([, v]) => v)
          .map(([label, value]) => (
            <div key={label} className="glass-row rounded-xl bg-blue-500/5 p-3">
              <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</dt>
              <dd className="mt-0.5 font-semibold text-blue-900 whitespace-pre-line dark:text-blue-100">{value}</dd>
            </div>
          ))}
      </dl>
      {achievements.length > 0 && (
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-blue-900 dark:text-blue-100">
            <Award className="h-4 w-4 text-yellow-500" aria-hidden="true" />
            {t("achievements.title")}
          </h3>
          <ul className="mt-2 flex flex-col gap-1.5 text-sm">
            {achievements.map((a, i) => (
              <li key={i} className="glass-row flex items-start gap-2 rounded-xl bg-yellow-400/10 px-3 py-2">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gradient-to-br from-yellow-300 to-yellow-500" />
                <span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">{a.title}</span>
                  {a.year ? <span className="text-slate-500 dark:text-slate-400"> ({a.year})</span> : null}
                  {a.note ? <span className="text-slate-500 dark:text-slate-400"> - {a.note}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {canSeeGoals && (profile.vision || objectives.length > 0) && (
        <div className="rounded-2xl border border-blue-200/60 bg-blue-500/5 p-4 dark:border-slate-700">
          <h3 className="flex items-center gap-2 text-sm font-bold text-blue-900 dark:text-blue-100">
            <Target className="h-4 w-4 text-blue-600 dark:text-blue-300" aria-hidden="true" />
            {t("goals.title")}
          </h3>
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
                          <span className="text-xs text-slate-500 dark:text-slate-400">
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
    </section>
  );
}
