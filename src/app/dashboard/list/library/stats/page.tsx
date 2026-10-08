import { getTranslations } from "next-intl/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { routeAccessMap } from "@/lib/settings";
import { getReadingOverview } from "@/lib/library";
import { schoolMonthStart } from "@/lib/libraryShared";
import LibraryChart from "@/components/library/LibraryChart";
import { Avatar, Empty, Section, StatTile } from "@/components/library/LibraryUi";

type TFn = (key: string, values?: Record<string, string | number>) => string;

const LibraryStats = async () => {
  requireRole(routeAccessMap["/dashboard/list/library(.*)"]);
  const t = (await getTranslations("Library")) as unknown as TFn;
  const overview = await getReadingOverview();

  const since = schoolMonthStart(new Date(), 2);
  const popular = await prisma.libraryLoan.groupBy({
    by: ["bookId"],
    where: { borrowedAt: { gte: since }, book: { category: { not: "TEXTBOOK" } } },
    _count: { _all: true },
    orderBy: { _count: { bookId: "desc" } },
    take: 5,
  });
  const popularBooks = popular.length
    ? await prisma.libraryBook.findMany({
        where: { id: { in: popular.map((p) => p.bookId) } },
        select: { id: true, title: true, author: true },
      })
    : [];
  const bookMap = new Map(popularBooks.map((b) => [b.id, b]));

  const chartData = overview.months.map((m) => {
    const [y, mm] = m.key.split("-");
    const names = t("monthsShort").split(",");
    return { month: `${names[Number(mm) - 1] ?? mm} ${y.slice(2)}`, count: m.count };
  });
  const maxClass = Math.max(...overview.classRows.map((c) => c.average), 0.0001);
  const monthTotal = overview.thisMonth.reduce((sum, r) => sum + r.count, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatTile emoji="📖" label={t("stats.booksRead")} value={overview.totalRead} />
        <StatTile emoji="🗓️" label={t("stats.thisMonth")} value={monthTotal} />
        <StatTile emoji="🧑‍🎓" label={t("stats.readers")} value={overview.readers} />
      </div>

      <Section title={t("charts.perMonth")} emoji="📊">
        {overview.totalRead === 0 ? <Empty>{t("charts.empty")}</Empty> : <LibraryChart data={chartData} label={t("stats.booksRead")} />}
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title={t("classRank.title")} emoji="🏫">
          {overview.classRows.length === 0 ? (
            <Empty>{t("classRank.empty")}</Empty>
          ) : (
            <ol className="flex flex-col gap-3">
              {overview.classRows.slice(0, 10).map((c, i) => (
                <li key={c.classId} className="text-sm">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-semibold text-gray-800 dark:text-slate-100">
                      {i + 1}. {c.name}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-slate-400">
                      {t("classRank.avg", { avg: c.average.toFixed(1) })} · {t("classRank.total", { total: c.total })}
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-600 to-amber-400"
                      style={{ width: `${Math.max((c.average / maxClass) * 100, 4)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Section>

        <Section title={t("readerMonth.title")} emoji="🏆">
          {overview.thisMonth.length === 0 ? (
            <Empty>{t("readerMonth.empty")}</Empty>
          ) : (
            <ol className="flex flex-col gap-2">
              {overview.thisMonth.slice(0, 10).map((row, i) => (
                <li key={row.student.id} className="flex items-center gap-3 text-sm">
                  <span className="w-6 text-center font-bold text-gray-400">{i === 0 ? "👑" : i + 1}</span>
                  <Avatar src={row.student.img} name={row.student.name} size={32} />
                  <span className="flex-1 truncate font-medium text-gray-800 dark:text-slate-100">{row.student.name}</span>
                  <span className="text-xs text-gray-500 dark:text-slate-400">{row.student.className}</span>
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                    {row.count}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title={t("topReaders.titleAll")} emoji="📈">
          {overview.allTime.length === 0 ? (
            <Empty>{t("topReaders.empty")}</Empty>
          ) : (
            <ol className="flex flex-col gap-2">
              {overview.allTime.slice(0, 15).map((row, i) => (
                <li key={row.student.id} className="flex items-center gap-3 text-sm">
                  <span className="w-6 text-center font-bold text-gray-400">{i + 1}</span>
                  <Avatar src={row.student.img} name={row.student.name} size={32} />
                  <span className="flex-1 truncate font-medium text-gray-800 dark:text-slate-100">{row.student.name}</span>
                  <span className="text-xs text-gray-500 dark:text-slate-400">{row.student.className}</span>
                  <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                    {row.count}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Section>

        <Section title={t("charts.popular")} emoji="🔥">
          {popular.length === 0 ? (
            <Empty>{t("charts.emptyPopular")}</Empty>
          ) : (
            <ol className="flex flex-col gap-3">
              {popular.map((p, i) => {
                const book = bookMap.get(p.bookId);
                if (!book) return null;
                return (
                  <li key={p.bookId} className="flex items-center gap-3 text-sm">
                    <span className="w-6 text-center font-bold text-gray-400">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-gray-800 dark:text-slate-100">{book.title}</div>
                      <div className="truncate text-xs text-gray-500 dark:text-slate-400">{book.author}</div>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                      {t("charts.times", { count: p._count._all })}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </Section>
      </div>
    </div>
  );
};

export default LibraryStats;
