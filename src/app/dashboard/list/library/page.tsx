import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { routeAccessMap } from "@/lib/settings";
import { getReadingOverview, getStudentReading } from "@/lib/library";
import { BADGE_TIERS, CATEGORY_EMOJI, type BookCategory, earnedBadges, nextBadge, weekStreak } from "@/lib/libraryShared";
import { Avatar, BookCover, CARD, Empty, Section, StatTile, Stars } from "@/components/library/LibraryUi";

type TFn = (key: string, values?: Record<string, string | number>) => string;
const BASE = "/dashboard/list/library";

// "My reading" panel for one student (used for students themselves and for parents' children).
async function ReadingCard({
  studentId,
  title,
  t,
  format,
}: {
  studentId: string;
  title: string;
  t: TFn;
  format: Awaited<ReturnType<typeof getFormatter>>;
}) {
  const reading = await getStudentReading(studentId);
  const badges = earnedBadges(reading.booksRead);
  const next = nextBadge(reading.booksRead);
  const streak = weekStreak(reading.finishedDates);
  const now = Date.now();

  return (
    <Section title={title} emoji="🎒">
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl bg-blue-50 p-3 dark:bg-blue-950/40">
          <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{reading.booksRead}</div>
          <div className="text-xs text-gray-500 dark:text-slate-400">{t("me.read")}</div>
        </div>
        <div className="rounded-xl bg-amber-50 p-3 dark:bg-amber-950/30">
          <div className="text-2xl font-bold text-amber-600">{reading.active.length}</div>
          <div className="text-xs text-gray-500 dark:text-slate-400">{t("me.reading")}</div>
        </div>
        <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/30">
          <div className="text-2xl font-bold text-emerald-600">🔥 {streak}</div>
          <div className="text-xs text-gray-500 dark:text-slate-400">{t("me.streak")}</div>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 text-sm font-semibold text-gray-700 dark:text-slate-200">{t("me.badges")}</div>
        {badges.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-400">{t("me.noBadges")}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {badges.map((b) => (
              <span
                key={b.key}
                className="rounded-full bg-gradient-to-r from-amber-100 to-yellow-50 px-3 py-1 text-sm font-semibold text-amber-800 ring-1 ring-amber-200 dark:from-amber-900/40 dark:to-yellow-900/20 dark:text-amber-200 dark:ring-amber-800"
              >
                {b.emoji} {t("badges." + b.key)}
              </span>
            ))}
          </div>
        )}
        {next && (
          <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">
            {t("me.nextBadge", { name: t("badges." + next.key), count: next.min })}
          </p>
        )}
      </div>

      {reading.active.length > 0 && (
        <ul className="mt-4 divide-y divide-gray-100 dark:divide-slate-800">
          {reading.active.map((loan) => {
            const late = loan.dueAt.getTime() < now;
            return (
              <li key={loan.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="font-medium text-gray-800 dark:text-slate-100">{loan.book.title}</span>
                <span
                  className={
                    "rounded-full px-2.5 py-1 text-xs font-semibold " +
                    (late
                      ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                      : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300")
                  }
                >
                  {late ? t("me.overdue") : t("me.due", { date: format.dateTime(loan.dueAt, { day: "numeric", month: "short", timeZone: "Asia/Almaty" }) })}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

const LibraryHome = async () => {
  const { userId, role } = requireRole(routeAccessMap["/dashboard/list/library(.*)"]);
  const t = (await getTranslations("Library")) as unknown as TFn;
  const format = await getFormatter();
  const now = Date.now();

  const [settings, today, news, photos, bookCount, copies, onLoan, overdue, overview, popularReviews] =
    await Promise.all([
      prisma.librarySettings.findUnique({
        where: { id: 1 },
        include: { featuredBook: true },
      }),
      prisma.libraryPost.findFirst({ where: { kind: "TODAY" }, orderBy: { createdAt: "desc" } }),
      prisma.libraryPost.findMany({ where: { kind: "NEWS" }, orderBy: { createdAt: "desc" }, take: 4 }),
      prisma.libraryPhoto.findMany({ orderBy: { createdAt: "desc" }, take: 6 }),
      prisma.libraryBook.count(),
      prisma.libraryBook.aggregate({ _sum: { copies: true } }),
      prisma.libraryLoan.count({ where: { returnedAt: null } }),
      prisma.libraryLoan.count({ where: { returnedAt: null, dueAt: { lt: new Date() } } }),
      getReadingOverview(),
      prisma.libraryReview.groupBy({
        by: ["bookId"],
        where: { status: "APPROVED" },
        _avg: { rating: true },
        _count: { _all: true },
      }),
    ]);

  const featured = settings?.featuredBook ?? null;
  const featuredRating = featured ? popularReviews.find((r) => r.bookId === featured.id) : undefined;
  const readerOfMonth = overview.thisMonth[0] ?? null;
  const topClasses = overview.classRows.slice(0, 3);
  const topReaders = overview.allTime.slice(0, 5);
  const todayIsFresh = today ? now - today.createdAt.getTime() < 36 * 3600 * 1000 : false;

  let myStudentId: string | null = null;
  let children: { id: string; name: string }[] = [];
  if (role === "student") myStudentId = userId;
  if (role === "parent") {
    const kids = await prisma.student.findMany({
      where: { parentId: userId },
      select: { id: true, name: true, surname: true },
    });
    children = kids.map((k) => ({ id: k.id, name: `${k.name} ${k.surname}` }));
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Today in the library */}
      <div className="rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 p-5 text-white shadow-sm">
        <div className="text-sm font-semibold uppercase tracking-wider opacity-90">☀️ {t("today.title")}</div>
        {today ? (
          <div className="mt-2">
            <div className="text-xl font-bold">{today.title}</div>
            <p className="mt-1 whitespace-pre-line text-sm opacity-95">{today.body}</p>
            <div className="mt-2 text-xs opacity-80">
              {todayIsFresh
                ? t("today.fresh")
                : format.dateTime(today.createdAt, { day: "numeric", month: "long", timeZone: "Asia/Almaty" })}
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm opacity-95">{t("today.empty")}</p>
        )}
      </div>

      {/* Counters */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile emoji="📚" label={t("stats.titles")} value={bookCount} />
        <StatTile emoji="🧺" label={t("stats.copies")} value={copies._sum.copies ?? 0} />
        <StatTile emoji="📖" label={t("stats.booksRead")} value={overview.totalRead} />
        <StatTile emoji="🧑‍🎓" label={t("stats.readers")} value={overview.readers} />
      </div>
      {overdue > 0 && (role === "admin" || role === "teacher") ? (
        <p className="text-xs text-gray-500 dark:text-slate-400">
          {t("stats.onLoanLine", { onLoan, overdue })}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Book of the week */}
        <Section title={t("featured.title")} emoji="⭐">
          {featured ? (
            <div className="flex gap-4">
              <BookCover
                src={featured.coverUrl}
                title={featured.title}
                emoji={CATEGORY_EMOJI[(featured.category as BookCategory) ?? "FICTION"] ?? "📖"}
                className="h-40 w-28"
              />
              <div className="flex min-w-0 flex-col gap-1">
                <h3 className="text-lg font-bold text-gray-800 dark:text-slate-100">{featured.title}</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400">{t("featured.by", { author: featured.author })}</p>
                {featuredRating?._avg.rating ? (
                  <div className="flex items-center gap-2 text-sm">
                    <Stars value={featuredRating._avg.rating} />
                    <span className="text-gray-500">({featuredRating._count._all})</span>
                  </div>
                ) : null}
                {settings?.featuredNote ? (
                  <p className="mt-1 rounded-lg bg-amber-50 p-2 text-sm italic text-amber-900 dark:bg-amber-900/20 dark:text-amber-100">
                    “{settings.featuredNote}”
                  </p>
                ) : featured.description ? (
                  <p className="line-clamp-4 text-sm text-gray-600 dark:text-slate-300">{featured.description}</p>
                ) : null}
                <Link
                  href={`${BASE}/books?q=${encodeURIComponent(featured.title)}`}
                  className="mt-1 text-sm font-semibold text-blue-600 hover:underline dark:text-blue-300"
                >
                  {t("featured.view")} →
                </Link>
              </div>
            </div>
          ) : (
            <Empty>{t("featured.empty")}</Empty>
          )}
        </Section>

        {/* Reader of the month */}
        <Section title={t("readerMonth.title")} emoji="🏆">
          {readerOfMonth ? (
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="relative">
                <Avatar src={readerOfMonth.student.img} name={readerOfMonth.student.name} size={88} />
                <span className="absolute -right-2 -top-2 text-3xl">👑</span>
              </div>
              <div className="text-xl font-bold text-gray-800 dark:text-slate-100">{readerOfMonth.student.name}</div>
              <div className="text-sm text-gray-500 dark:text-slate-400">
                {t("readerMonth.class", { name: readerOfMonth.student.className })}
              </div>
              <div className="rounded-full bg-amber-100 px-4 py-1 text-sm font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                {t("readerMonth.books", { count: readerOfMonth.count })}
              </div>
              {overview.thisMonth.length > 1 && (
                <ol className="mt-2 w-full max-w-xs divide-y divide-gray-100 text-left text-sm dark:divide-slate-800">
                  {overview.thisMonth.slice(1, 4).map((row, i) => (
                    <li key={row.student.id} className="flex items-center justify-between py-1.5">
                      <span>
                        {["🥈", "🥉", "🏅"][i]} {row.student.name}
                      </span>
                      <span className="font-semibold text-blue-700 dark:text-blue-300">{row.count}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ) : (
            <Empty>{t("readerMonth.empty")}</Empty>
          )}
        </Section>
      </div>

      {/* Personal reading */}
      {myStudentId && <ReadingCard studentId={myStudentId} title={t("me.title")} t={t} format={format} />}
      {children.map((c) => (
        <ReadingCard key={c.id} studentId={c.id} title={t("me.childTitle", { name: c.name })} t={t} format={format} />
      ))}

      <div className="grid gap-4 lg:grid-cols-2">
        <Section
          title={t("classRank.title")}
          emoji="🏫"
          action={
            <Link href={`${BASE}/stats`} className="text-sm font-semibold text-blue-600 hover:underline dark:text-blue-300">
              {t("seeAll")} →
            </Link>
          }
        >
          {topClasses.length === 0 ? (
            <Empty>{t("classRank.empty")}</Empty>
          ) : (
            <ol className="flex flex-col gap-2">
              {topClasses.map((c, i) => (
                <li key={c.classId} className="flex items-center gap-3 rounded-xl bg-gray-50 p-3 dark:bg-slate-800/60">
                  <span className="text-2xl">{["🥇", "🥈", "🥉"][i]}</span>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-800 dark:text-slate-100">{c.name}</div>
                    <div className="text-xs text-gray-500 dark:text-slate-400">
                      {t("classRank.total", { total: c.total })}
                    </div>
                  </div>
                  <div className="text-right text-sm font-bold text-blue-700 dark:text-blue-300">
                    {t("classRank.avg", { avg: c.average.toFixed(1) })}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Section>

        <Section
          title={t("topReaders.title")}
          emoji="📈"
          action={
            <Link href={`${BASE}/stats`} className="text-sm font-semibold text-blue-600 hover:underline dark:text-blue-300">
              {t("seeAll")} →
            </Link>
          }
        >
          {topReaders.length === 0 ? (
            <Empty>{t("topReaders.empty")}</Empty>
          ) : (
            <ol className="flex flex-col gap-2">
              {topReaders.map((row, i) => (
                <li key={row.student.id} className="flex items-center gap-3 text-sm">
                  <span className="w-5 text-center font-bold text-gray-400">{i + 1}</span>
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
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title={t("news.title")} emoji="📰">
          {news.length === 0 ? (
            <Empty>{t("news.empty")}</Empty>
          ) : (
            <ul className="flex flex-col gap-3">
              {news.map((n) => (
                <li key={n.id} className="flex gap-3 rounded-xl bg-gray-50 p-3 dark:bg-slate-800/60">
                  {n.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={n.imageUrl} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                  )}
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-800 dark:text-slate-100">{n.title}</div>
                    <p className="line-clamp-3 whitespace-pre-line text-sm text-gray-600 dark:text-slate-300">{n.body}</p>
                    <div className="mt-1 text-xs text-gray-400">
                      {format.dateTime(n.createdAt, { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Almaty" })}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title={t("about.title")} emoji="🏛️">
          <div className="flex flex-col gap-3 text-sm text-gray-700 dark:text-slate-300">
            <p className="whitespace-pre-line">{settings?.intro || t("about.introDefault")}</p>
            <div>
              <div className="font-semibold text-gray-800 dark:text-slate-100">🎯 {t("about.goals")}</div>
              <p className="mt-1 whitespace-pre-line">{settings?.goals || t("about.goalsDefault")}</p>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-blue-50 p-3 dark:bg-blue-950/40">
              <Avatar src={settings?.librarianImg} name={settings?.librarianName || "L"} size={52} />
              <div>
                <div className="text-xs uppercase tracking-wider text-gray-500 dark:text-slate-400">{t("about.librarian")}</div>
                <div className="font-bold text-gray-800 dark:text-slate-100">
                  {settings?.librarianName || t("about.notSet")}
                </div>
                {settings?.hours && (
                  <div className="text-xs text-gray-500 dark:text-slate-400">🕒 {settings.hours}</div>
                )}
              </div>
            </div>
          </div>
        </Section>
      </div>

      <Section title={t("photos.title")} emoji="📸">
        {photos.length === 0 ? (
          <Empty>{t("photos.empty")}</Empty>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {photos.map((p) => (
              <figure key={p.id} className="overflow-hidden rounded-xl bg-gray-100 dark:bg-slate-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.caption ?? ""} className="h-40 w-full object-cover" loading="lazy" />
                {p.caption && <figcaption className="p-2 text-xs text-gray-600 dark:text-slate-300">{p.caption}</figcaption>}
              </figure>
            ))}
          </div>
        )}
      </Section>

      <p className={CARD + " text-xs text-gray-500 dark:text-slate-400"}>
        {t("rules", { count: BADGE_TIERS[BADGE_TIERS.length - 1].min })}
      </p>
    </div>
  );
};

export default LibraryHome;
