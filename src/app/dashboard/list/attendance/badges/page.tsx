import Link from "next/link";
import PageHero from "@/components/PageHero";
import Code39Barcode from "@/components/Code39Barcode";
import PrintButton from "@/components/PrintButton";
import { sanitizeForBadge } from "@/lib/barcode39";
import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { getUserRole } from "@/lib/auth";
import { getTranslations } from "next-intl/server";

// Printable ID badges - one Code 39 barcode per student, encoding
// sanitizeForBadge(student.id) (see src/lib/barcode39.ts for why: it's the
// one identifier every student already has that needs no new database
// field/migration and is guaranteed to be encodable). Cut out and laminate
// these, and Scan Check-In (the other new page next to this one) can read
// them back with any plain USB/Bluetooth barcode scanner - those act as a
// keyboard, "typing" the code and an Enter, so nothing beyond a normal text
// input is needed on the receiving end.
const BadgesPage = async ({
  searchParams,
}: {
  searchParams: { classId?: string };
}) => {
  const { userId, sessionClaims } = auth();
  const role = getUserRole(sessionClaims);
  const t = await getTranslations("List.badges");

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

  const students = selectedClassId
    ? await prisma.student.findMany({
        where: { classId: selectedClassId },
        select: { id: true, name: true, surname: true },
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <div className="panel-card p-4 md:p-5 rounded-md flex-1 m-4 mt-0 list-page-shell">
      <div className="print:hidden">
        <PageHero
          title={t("title")}
          subtitle={t("subtitle")}
          emoji={t("emoji")}
          stats={[{ label: t("studentsLabel"), value: students.length }]}
        />

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
          <button className="bg-blue-500 text-white px-4 py-2 rounded-md text-sm font-semibold">
            {t("loadButton")}
          </button>
          {selectedClassId && (
            <>
              <PrintButton label={t("printButton")} />
              <Link
                href={`/dashboard/list/attendance/checkin?classId=${selectedClassId}`}
                className="bg-emerald-500 text-white px-4 py-2 rounded-md text-sm font-semibold"
              >
                {t("goToCheckInButton")}
              </Link>
            </>
          )}
        </form>

        {classes.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-slate-400 p-4">{t("noClasses")}</p>
        )}
        {selectedClassId && students.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-slate-400 p-4">{t("noStudents")}</p>
        )}
        {selectedClassId && students.length > 0 && (
          <p className="text-sm text-gray-500 dark:text-slate-400 px-1 mb-2">{t("printHint")}</p>
        )}
      </div>

      {selectedClassId && students.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-4 print:gap-2">
          {students.map((s) => (
            <div
              key={s.id}
              className="panel-card p-4 rounded-md flex flex-col items-center gap-2 text-center border border-gray-200 dark:border-slate-800 print:border-black print:break-inside-avoid"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                {selectedClass?.name}
              </span>
              <span className="text-base font-semibold">
                {s.name} {s.surname}
              </span>
              <Code39Barcode value={s.id} moduleWidth={2} height={50} />
              <span className="text-[10px] font-mono text-gray-400 dark:text-slate-500">
                {sanitizeForBadge(s.id)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BadgesPage;
