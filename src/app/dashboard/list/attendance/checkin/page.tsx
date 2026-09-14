import Link from "next/link";
import PageHero from "@/components/PageHero";
import CheckInScanner from "@/components/CheckInScanner";
import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { getUserRole } from "@/lib/auth";
import { getTranslations } from "next-intl/server";

const todayISO = () => new Date().toISOString().slice(0, 10);

// The scan/ID-badge check-in capture screen: pick a class (and, if needed,
// a date), then scan. Additive to the existing matrix form, not a
// replacement for it - a teacher can always fall back to marking manually
// for a student who forgot their badge.
const CheckInPage = async ({
  searchParams,
}: {
  searchParams: { classId?: string; date?: string };
}) => {
  const { userId, sessionClaims } = auth();
  const role = getUserRole(sessionClaims);
  const date = searchParams.date || todayISO();
  const t = await getTranslations("List.checkin");

  if (role !== "admin" && role !== "teacher") {
    return (
      <div className="panel-card p-4 md:p-5 rounded-md flex-1 m-4 mt-0 list-page-shell">
        <PageHero title={t("title")} subtitle={t("subtitle")} emoji={t("emoji")} stats={[]} />
        <p className="text-sm text-gray-500 dark:text-slate-400 p-4">{t("restricted")}</p>
      </div>
    );
  }

  const classes =
    role === "teacher" && userId
      ? await prisma.class.findMany({
          where: {
            OR: [{ supervisorId: userId }, { lessons: { some: { teacherId: userId } } }],
          },
          orderBy: { name: "asc" },
        })
      : await prisma.class.findMany({ orderBy: { name: "asc" } });

  const selectedClassId = searchParams.classId
    ? parseInt(searchParams.classId, 10)
    : classes[0]?.id;

  const selectedClass = classes.find((c) => c.id === selectedClassId);

  return (
    <div className="panel-card p-4 md:p-5 rounded-md flex-1 m-4 mt-0 list-page-shell">
      <PageHero title={t("title")} subtitle={t("subtitle")} emoji={t("emoji")} stats={[]} />

      <form className="panel-card p-4 rounded-md mb-4 shine-hover flex flex-wrap items-end gap-4" method="GET">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 dark:text-slate-400">{t("classLabel")}</label>
          <select
            name="classId"
            defaultValue={selectedClassId}
            className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2 rounded-md text-sm min-w-[10rem]"
          >
            {classes.map((c) => (
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
            defaultValue={date}
            className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2 rounded-md text-sm"
          />
        </div>
        <button className="bg-blue-500 text-white px-4 py-2 rounded-md text-sm font-semibold">
          {t("loadButton")}
        </button>
        {selectedClassId && (
          <>
            <Link
              href={`/dashboard/list/attendance/badges?classId=${selectedClassId}`}
              className="bg-white dark:bg-slate-800 ring-1 ring-gray-300 dark:ring-slate-700 px-4 py-2 rounded-md text-sm font-semibold"
            >
              {t("printBadgesButton")}
            </Link>
            <Link
              href={`/dashboard/list/attendance?classId=${selectedClassId}&date=${date}`}
              className="bg-white dark:bg-slate-800 ring-1 ring-gray-300 dark:ring-slate-700 px-4 py-2 rounded-md text-sm font-semibold"
            >
              {t("backToMatrixButton")}
            </Link>
          </>
        )}
      </form>

      {classes.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400 p-4">{t("noClasses")}</p>
      ) : selectedClassId && selectedClass ? (
        <CheckInScanner classId={selectedClassId} date={date} className={selectedClass.name} />
      ) : null}
    </div>
  );
};

export default CheckInPage;
