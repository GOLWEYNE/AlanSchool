import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import { SignOutButton } from "@clerk/nextjs";
import { getTranslations } from "next-intl/server";
import prisma from "@/lib/prisma";
import { getUserRole, homeFor } from "@/lib/auth";
import { currentSchoolYear } from "@/lib/schoolYear";
import { getSupervisedClubIds } from "@/lib/clubSupervision";
import { ensureTeacherProfile, parseAchievements, type PositionKey } from "@/lib/teacherProfile";
import TeacherProfileForm, { type ProfileFormData } from "@/components/TeacherProfileForm";

// First-login "Complete your profile" screen for teachers. It lives outside the
// /dashboard layout on purpose: the dashboard sends teachers here until the
// required parts (photo + position) are done, so this page can't be behind
// that same gate. Teachers come back to it later to edit their profile.
export default async function CompleteProfilePage() {
  const { userId, sessionClaims } = auth();
  if (!userId) redirect("/sign-in");
  const role = getUserRole(sessionClaims);
  if (role !== "teacher") redirect(homeFor(role));

  const t = await getTranslations("TeacherProfile");
  const ready = await ensureTeacherProfile();
  const teacher = ready
    ? await prisma.teacher.findUnique({
        where: { id: userId },
        select: {
          name: true,
          surname: true,
          classes: { select: { name: true } },
          profile: true,
          objectives: { where: { schoolYear: currentSchoolYear() }, orderBy: [{ term: "asc" }, { id: "asc" }] },
        },
      })
    : null;

  if (!teacher) {
    // No teacher record (or tables unavailable): nothing to complete, never trap the user.
    redirect(homeFor(role));
  }

  const clubIds = await getSupervisedClubIds(userId);
  const clubs = clubIds.length
    ? await prisma.club.findMany({ where: { id: { in: clubIds } }, select: { name: true }, orderBy: { name: "asc" } })
    : [];

  const profile = teacher.profile;
  const firstTime = !profile?.completedAt;
  const user = await currentUser();

  const initial: ProfileFormData = {
    position: (profile?.position as PositionKey | null) ?? "",
    department: profile?.department ?? "",
    yearJoined: profile?.yearJoined ? String(profile.yearJoined) : "",
    yearsExperience: profile?.yearsExperience != null ? String(profile.yearsExperience) : "",
    about: profile?.about ?? "",
    education: profile?.education ?? "",
    previousSchools: profile?.previousSchools ?? "",
    certificates: profile?.certificates ?? "",
    achievements: parseAchievements(profile?.achievements).map((a) => ({
      title: a.title,
      year: a.year ? String(a.year) : "",
      note: a.note ?? "",
    })),
    vision: profile?.vision ?? "",
    objectives: teacher.objectives.map((o) => ({
      term: o.term,
      text: o.text,
      status: (["PLANNED", "IN_PROGRESS", "ACHIEVED"].includes(o.status) ? o.status : "PLANNED") as ProfileFormData["objectives"][number]["status"],
    })),
  };

  return (
    <div className="min-h-screen app-shell-bg px-4 py-6 md:px-8">
      <div className="mx-auto flex max-w-4xl flex-col gap-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Image src="/Alan.png" alt="logo" width={32} height={32} />
            <span className="font-bold text-blue-900 dark:text-blue-100">AlanSchool</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            {!firstTime && (
              <Link href="/dashboard/teacher" className="font-semibold text-blue-700 hover:underline dark:text-blue-300">
                {t("backToDashboard")}
              </Link>
            )}
            <SignOutButton redirectUrl="/sign-in">
              <button type="button" className="font-semibold text-gray-600 hover:underline dark:text-slate-300">
                {t("logout")}
              </button>
            </SignOutButton>
          </div>
        </div>

        <div className="rounded-2xl bg-gradient-to-r from-blue-700 via-cyan-600 to-blue-400 p-6 text-white shadow-xl">
          <h1 className="text-3xl font-bold">
            {firstTime ? t("welcomeTitle", { name: teacher.name }) : t("editTitle")}
          </h1>
          <p className="mt-2 text-sm text-cyan-50">{firstTime ? t("welcomeSubtitle") : t("editSubtitle")}</p>
          <p className="mt-1 text-xs text-cyan-100">
            {teacher.name} {teacher.surname} · {user?.emailAddresses[0]?.emailAddress ?? ""}
          </p>
        </div>

        <TeacherProfileForm
          initial={initial}
          supervises={{ classes: teacher.classes.map((c) => c.name), clubs: clubs.map((c) => c.name) }}
          firstTime={firstTime}
        />
      </div>
    </div>
  );
}
