import prisma from "@/lib/prisma";

const ACCENTS = [
  "from-sky-400 to-blue-500",
  "from-violet-400 to-purple-500",
  "from-amber-400 to-orange-500",
  "from-emerald-400 to-teal-500",
];

const EventList = async ({ dateParam }: { dateParam: string | undefined }) => {
  const date = dateParam ? new Date(dateParam) : new Date();

  const data = await prisma.event.findMany({
    where: {
      startTime: {
        gte: new Date(date.setHours(0, 0, 0, 0)),
        lte: new Date(date.setHours(23, 59, 59, 999)),
      },
    },
    orderBy: { startTime: "asc" },
  });

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-blue-100 dark:border-slate-800 p-4 text-center">
        <p className="text-xs text-gray-400 dark:text-slate-500">No events scheduled for this day.</p>
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
              {event.startTime.toLocaleTimeString("en-UK", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })}
            </span>
          </div>
          <p className="mt-1.5 text-gray-400 dark:text-slate-400 text-sm">{event.description}</p>
        </div>
      ))}
    </>
  );
};

export default EventList;
