import prisma from "@/lib/prisma";
import { getLocale, getTranslations } from "next-intl/server";
import { dateLocale } from "@/lib/dateLocale";
import { SCHOOL_TIME_ZONE, schoolDayRange } from "@/lib/schoolTime";

const ACCENTS = [
  "from-sky-400 to-blue-500",
  "from-violet-400 to-purple-500",
  "from-amber-400 to-orange-500",
  "from-emerald-400 to-teal-500",
];

const EventList = async ({ dateParam }: { dateParam: string | undefined }) => {
  const t = await getTranslations("Widgets.events");
  const locale = await getLocale();
  // dateParam is the "YYYY-MM-DD" the sidebar calendar picked; the day runs
  // from school midnight to the next, not from the server's (UTC) midnight.
  const [dayStart, dayEnd] = schoolDayRange(dateParam);

  const data = await prisma.event.findMany({
    where: {
      startTime: {
        gte: dayStart,
        lt: dayEnd,
      },
    },
    orderBy: { startTime: "asc" },
  });

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-blue-100 dark:border-slate-800 p-4 text-center">
        <p className="text-xs text-gray-400 dark:text-slate-500">{t("none")}</p>
      </div>
    );
  }

  return (
    <>
      {data.map((event: (typeof data)[number], i: number) => (
        <div
          key={event.id}
          className="group relative overflow-hidden rounded-xl bg-white dark:bg-slate-900/60 border border-blue-50 dark:border-slate-800 p-4 pl-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
        >
          <span className={`absolute left-0 top-0 h-full w-1.5 bg-gradient-to-b ${ACCENTS[i % ACCENTS.length]}`} />
          <div className="flex items-center justify-between">
            <h1 className="font-semibold text-gray-700 dark:text-blue-100">{event.title}</h1>
            <span className="shrink-0 text-[11px] font-medium text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 rounded-full px-2 py-0.5">
              {new Intl.DateTimeFormat(dateLocale(locale), {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
                timeZone: SCHOOL_TIME_ZONE,
              }).format(event.startTime)}
            </span>
          </div>
          <p className="mt-1.5 text-gray-400 dark:text-slate-400 text-sm">{event.description}</p>
        </div>
      ))}
    </>
  );
};

export default EventList;
