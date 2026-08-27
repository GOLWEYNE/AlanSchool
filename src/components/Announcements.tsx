import Image from "next/image";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { getUserRole } from "@/lib/auth";

const ACCENTS = [
  {
    ring: "from-sky-400 to-blue-500",
    chip: "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-300",
    icon: "📘",
  },
  {
    ring: "from-violet-400 to-purple-500",
    chip: "bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-300",
    icon: "🎉",
  },
  {
    ring: "from-amber-400 to-orange-500",
    chip: "bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-300",
    icon: "📌",
  },
];

const relativeDay = (date: Date) => {
  const now = new Date();
  const diffMs = new Date(date.toDateString()).getTime() - new Date(now.toDateString()).getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === -1) return "Yesterday";
  if (diffDays === 1) return "Tomorrow";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(date);
};

const Announcements = async () => {
  const { userId, sessionClaims } = auth();
  const role = getUserRole(sessionClaims);

  const roleConditions = {
    teacher: { lessons: { some: { teacherId: userId! } } },
    student: { students: { some: { id: userId! } } },
    parent: { students: { some: { parentId: userId! } } },
  };

  const whereClause = {
    ...(role !== "admin" && {
      OR: [
        { classId: null },
        { class: roleConditions[role as keyof typeof roleConditions] || {} },
      ],
    }),
  };

  const [data, totalCount] = await Promise.all([
    prisma.announcement.findMany({
      take: 3,
      orderBy: { date: "desc" },
      where: whereClause,
    }),
    prisma.announcement.count({ where: whereClause }),
  ]);

  return (
    <div className="panel-card shine-hover relative overflow-hidden p-5">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <div className="circle-icon-btn !w-11 !h-11 shrink-0">
            <Image src="/announcement.png" alt="" width={20} height={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-blue-900 dark:text-blue-100">Announcements</h1>
            {totalCount > 0 && (
              <p className="text-xs text-blue-500 dark:text-slate-400">
                {totalCount} total announcement{totalCount === 1 ? "" : "s"}
              </p>
            )}
          </div>
        </div>
        <Link
          href="/dashboard/list/announcements"
          className="toolbar-chip px-3 py-1.5 text-xs font-semibold whitespace-nowrap"
        >
          View All
        </Link>
      </div>

      {data.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-blue-100 dark:border-slate-800 p-6 text-center">
          <p className="text-sm text-gray-400 dark:text-slate-500">No announcements yet — check back soon.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 mt-4">
          {data.map((item: (typeof data)[number], i: number) => {
            const accent = ACCENTS[i % ACCENTS.length];
            return (
              <div
                key={item.id}
                className="group relative overflow-hidden rounded-xl border border-blue-50 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 pl-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
              >
                <span className={`absolute left-0 top-0 h-full w-1.5 bg-gradient-to-b ${accent.ring}`} />
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base leading-none shrink-0">{accent.icon}</span>
                    <h2 className="font-semibold text-gray-700 dark:text-blue-100 truncate">{item.title}</h2>
                  </div>
                  <span className={`shrink-0 text-[11px] font-medium rounded-full px-2 py-0.5 ${accent.chip}`}>
                    {relativeDay(item.date)}
                  </span>
                </div>
                <p className="text-sm text-gray-400 dark:text-slate-400 mt-1.5 line-clamp-2">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Announcements;
