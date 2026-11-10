import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

// Styled like the top of an iPhone Settings page: a big round picture and
// name, then grouped rows (label on the left, value on the right).
const ProfilePage = async () => {
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const role = (user.publicMetadata as { role?: string } | undefined)?.role;
  const t = await getTranslations("Profiles.account");
  const tr = await getTranslations("Roles");
  const tp = await getTranslations("TeacherProfile");
  const roleLabel = role ? (tr.has(role) ? tr(role) : role) : "-";

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || "-";
  const initials =
    ((user.firstName?.[0] ?? "") + (user.lastName?.[0] ?? "")).toUpperCase() ||
    (user.username?.[0] ?? "?").toUpperCase();

  const rows: { label: string; value: string }[] = [
    { label: t("firstName"), value: user.firstName || "-" },
    { label: t("lastName"), value: user.lastName || "-" },
    { label: t("username"), value: user.username || "-" },
    { label: t("primaryEmail"), value: user.emailAddresses[0]?.emailAddress || "-" },
    { label: t("role"), value: roleLabel },
  ];

  return (
    <div className="mx-auto w-full max-w-2xl p-4">
      <div className="flex flex-col items-center gap-2 pb-5 pt-2 text-center">
        {user.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.imageUrl}
            alt=""
            className="h-24 w-24 rounded-full object-cover shadow-lg ring-4 ring-white dark:ring-slate-800"
          />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-yellow-400 text-3xl font-bold text-white shadow-lg ring-4 ring-white dark:ring-slate-800">
            {initials}
          </div>
        )}
        <h1 className="text-2xl font-bold text-blue-950 dark:text-blue-50">{fullName}</h1>
        <span className="rounded-full bg-yellow-100 px-3 py-0.5 text-xs font-semibold capitalize text-yellow-800 dark:bg-yellow-400/20 dark:text-yellow-200">
          {roleLabel}
        </span>
      </div>

      <p className="mb-1.5 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
        {t("profileTitle")}
      </p>
      <dl className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-blue-50 dark:divide-slate-800 dark:bg-slate-900/60 dark:ring-slate-800">
        {rows.map((r) => (
          <div key={r.label} className="flex min-h-12 items-center justify-between gap-4 px-4 py-3 text-sm">
            <dt className="shrink-0 text-gray-500 dark:text-slate-400">{r.label}</dt>
            <dd className="min-w-0 break-words text-right font-medium text-gray-900 dark:text-slate-100">
              {r.value}
            </dd>
          </div>
        ))}
      </dl>

      {role === "teacher" && (
        <Link
          href="/complete-profile"
          className="mt-5 flex min-h-12 items-center justify-between rounded-2xl bg-white px-4 text-sm font-semibold text-blue-700 shadow-sm ring-1 ring-blue-50 active:scale-[0.99] dark:bg-slate-900/60 dark:text-blue-300 dark:ring-slate-800"
        >
          {tp("editMyProfile")}
          <span aria-hidden="true" className="text-lg text-gray-300">
            ›
          </span>
        </Link>
      )}
    </div>
  );
};

export default ProfilePage;
