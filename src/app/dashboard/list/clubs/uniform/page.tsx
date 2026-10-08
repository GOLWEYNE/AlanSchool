import Link from "next/link";
import PageHero from "@/components/PageHero";
import UniformChecker, { type UniformLabels, type UniformRow } from "@/components/UniformChecker";
import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { getUserRole } from "@/lib/auth";
import { getTranslations } from "next-intl/server";
import { ensureClubSupervision, getSupervisedClubIds } from "@/lib/clubSupervision";
import { UNIFORM_ITEMS, isValidDateStr, schoolToday, toDbDate, type UniformStatusKey } from "@/lib/uniform";

type TFn = (key: string, values?: Record<string, string | number>) => string;

// Club uniform check: the club's supervisors (and admins) record, for each
// member, whether they came in the right uniform. Same statuses and items as
// the class uniform check, but stored per club so it never overwrites it.
const ClubUniformPage = async ({
  searchParams,
}: {
  searchParams: { clubId?: string; date?: string };
}) => {
  const { userId, sessionClaims } = auth();
  const role = getUserRole(sessionClaims);
  const t = await getTranslations("List.clubUniform");
  const tu = (await getTranslations("Uniform")) as unknown as TFn;

  if (role !== "admin" && role !== "teacher") {
    return (
      <div className="panel-card p-4 md:p-5 flex-1 m-4 mt-0 list-page-shell">
        <p className="text-sm text-gray-500 dark:text-slate-400 p-4">{t("restricted")}</p>
      </div>
    );
  }

  const today = schoolToday();
  const date = isValidDateStr(searchParams.date) && searchParams.date <= today ? searchParams.date : today;

  const supervisedIds = role === "teacher" ? await getSupervisedClubIds(userId) : null;
  const clubs = await prisma.club.findMany({
    where: supervisedIds ? { id: { in: supervisedIds } } : {},
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const requestedId = searchParams.clubId ? parseInt(searchParams.clubId, 10) : NaN;
  const selected = clubs.find((c) => c.id === requestedId) ?? clubs[0];

  const ready = selected ? await ensureClubSupervision() : false;

  const members = selected
    ? await prisma.student.findMany({
        where: { clubEnrollments: { some: { clubId: selected.id, status: "ACTIVE" } } },
        orderBy: [{ name: "asc" }, { surname: "asc" }],
        select: { id: true, name: true, surname: true },
      })
    : [];
  const checks =
    selected && ready
      ? await prisma.clubUniformCheck.findMany({
          where: { clubId: selected.id, date: toDbDate(date) },
        })
      : [];
  const byStudent = new Map(checks.map((c) => [c.studentId, c]));

  const rows: UniformRow[] = members.map((m) => {
    const c = byStudent.get(m.id);
    return {
      id: m.id,
      name: m.name,
      surname: m.surname,
      status: (c?.status as UniformStatusKey) ?? "FULL",
      missingItems: c?.missingItems ?? [],
      note: c?.note ?? "",
    };
  });

  const labels: UniformLabels = {
    status: { FULL: tu("status.FULL"), PARTIAL: tu("status.PARTIAL"), NONE: tu("status.NONE") },
    short: { FULL: tu("short.FULL"), PARTIAL: tu("short.PARTIAL"), NONE: tu("short.NONE") },
    items: UNIFORM_ITEMS.map((i) => ({ key: i.key, label: tu("items." + i.key) })),
    everyoneFull: tu("everyoneFull"),
    notePlaceholder: tu("notePlaceholder"),
    missingPrefix: tu("missingPrefix"),
    save: tu("save"),
    saving: tu("saving"),
    savedTemplate: tu("saved", { count: "__COUNT__" }),
    couldNotSave: tu("couldNotSave"),
    noStudents: t("noMembers"),
  };

  const recorded = checks.length;

  return (
    <div className="panel-card p-4 md:p-5 flex-1 m-4 mt-0 list-page-shell">
      <PageHero
        title={t("title")}
        subtitle={t("subtitle")}
        emoji={t("emoji")}
        stats={[
          { label: t("clubsLabel"), value: clubs.length },
          { label: t("membersLabel"), value: members.length },
          { label: t("recordedLabel"), value: `${recorded}/${members.length}` },
        ]}
      />

      <form
        className="panel-card p-4 rounded-md mb-4 shine-hover flex flex-wrap items-end gap-4"
        method="GET"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 dark:text-slate-400">{t("clubLabel")}</label>
          <select
            name="clubId"
            defaultValue={selected?.id}
            className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2 rounded-md text-sm min-w-[12rem]"
          >
            {clubs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 dark:text-slate-400">{t("dateLabel")}</label>
          <input
            type="date"
            name="date"
            max={today}
            defaultValue={date}
            className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2 rounded-md text-sm"
          />
        </div>
        <button className="bg-blue-500 text-white px-4 py-2 rounded-md text-sm font-semibold">
          {t("loadButton")}
        </button>
        <Link
          href="/dashboard/list/clubs"
          className="bg-white dark:bg-slate-800 ring-1 ring-gray-300 dark:ring-slate-700 px-4 py-2 rounded-md text-sm font-semibold"
        >
          {t("backToClubs")}
        </Link>
        {selected && (
          <Link
            href={`/dashboard/list/clubs/attendance?clubId=${selected.id}&date=${date}`}
            className="bg-emerald-500 text-white px-4 py-2 rounded-md text-sm font-semibold"
          >
            {t("attendanceButton")}
          </Link>
        )}
      </form>

      {!selected ? (
        <p className="text-sm text-gray-500 dark:text-slate-400 p-4">
          {role === "teacher" ? t("noSupervisedClubs") : t("noClubs")}
        </p>
      ) : (
        <UniformChecker
          key={`${selected.id}-${date}`}
          classId={0}
          clubId={selected.id}
          date={date}
          initial={rows}
          canEdit
          labels={labels}
        />
      )}
    </div>
  );
};

export default ClubUniformPage;
