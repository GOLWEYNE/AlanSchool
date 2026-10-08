import Link from "next/link";
import { getTranslations } from "next-intl/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { routeAccessMap } from "@/lib/settings";
import { BOOK_CATEGORIES, CATEGORY_EMOJI, type BookCategory } from "@/lib/libraryShared";
import { BookCover, CARD, Empty, Stars } from "@/components/library/LibraryUi";
import { FIELD, BTN } from "@/components/library/LibraryClient";

type TFn = (key: string, values?: Record<string, string | number>) => string;
type SP = { [key: string]: string | undefined };
const BASE = "/dashboard/list/library";

const LibraryBooks = async ({ searchParams }: { searchParams: Promise<SP> | SP }) => {
  requireRole(routeAccessMap["/dashboard/list/library(.*)"]);
  const t = (await getTranslations("Library")) as unknown as TFn;
  const sp = await Promise.resolve(searchParams);
  const q = (sp.q ?? "").trim().slice(0, 100);
  const cat = (BOOK_CATEGORIES as readonly string[]).includes(sp.cat ?? "") ? (sp.cat as BookCategory) : null;
  const onlyAvailable = sp.available === "1";

  const books = await prisma.libraryBook.findMany({
    where: {
      ...(cat ? { category: cat } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" as const } },
              { author: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: [{ title: "asc" }],
    take: 120,
  });

  const ids = books.map((b) => b.id);
  const [out, ratings, counts] = await Promise.all([
    prisma.libraryLoan.groupBy({ by: ["bookId"], where: { bookId: { in: ids }, returnedAt: null }, _count: { _all: true } }),
    prisma.libraryReview.groupBy({
      by: ["bookId"],
      where: { bookId: { in: ids }, status: "APPROVED" },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    prisma.libraryBook.groupBy({ by: ["category"], _count: { _all: true } }),
  ]);
  const outMap = new Map(out.map((o) => [o.bookId, o._count._all]));
  const ratingMap = new Map(ratings.map((r) => [r.bookId, r]));
  const countMap = new Map(counts.map((c) => [c.category, c._count._all]));
  const total = counts.reduce((sum, c) => sum + c._count._all, 0);

  const rows = books
    .map((b) => ({ ...b, available: Math.max(b.copies - (outMap.get(b.id) ?? 0), 0) }))
    .filter((b) => !onlyAvailable || b.available > 0);

  const chip = (value: BookCategory | null, label: string, n: number) => {
    const params = new URLSearchParams();
    if (value) params.set("cat", value);
    if (q) params.set("q", q);
    if (onlyAvailable) params.set("available", "1");
    const active = cat === value;
    return (
      <Link
        key={value ?? "all"}
        href={`${BASE}/books${params.toString() ? "?" + params.toString() : ""}`}
        className={
          "rounded-full px-4 py-2 text-sm font-semibold transition " +
          (active
            ? "bg-amber-400 text-blue-950 shadow"
            : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700")
        }
      >
        {label} <span className="opacity-60">({n})</span>
      </Link>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {chip(null, t("collection.all"), total)}
        {chip("TEXTBOOK", "📘 " + t("collection.textbooks"), countMap.get("TEXTBOOK") ?? 0)}
        {chip("FICTION", "📖 " + t("collection.fiction"), countMap.get("FICTION") ?? 0)}
        {chip("OTHER", "📚 " + t("collection.other"), countMap.get("OTHER") ?? 0)}
      </div>

      <form className={CARD + " flex flex-wrap items-end gap-3"} action={`${BASE}/books`}>
        {cat && <input type="hidden" name="cat" value={cat} />}
        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs font-medium text-gray-500 dark:text-slate-400">
          {t("collection.searchLabel")}
          <input className={FIELD} name="q" defaultValue={q} placeholder={t("collection.search")} />
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm text-gray-700 dark:text-slate-200">
          <input type="checkbox" name="available" value="1" defaultChecked={onlyAvailable} />
          {t("collection.onlyAvailable")}
        </label>
        <button className={BTN} type="submit">
          {t("collection.go")}
        </button>
      </form>

      {rows.length === 0 ? (
        <Empty>{total === 0 ? t("collection.emptyAll") : t("collection.empty")}</Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((b) => {
            const r = ratingMap.get(b.id);
            const emoji = CATEGORY_EMOJI[(b.category as BookCategory) ?? "FICTION"] ?? "📖";
            return (
              <article key={b.id} className={CARD + " flex gap-4"}>
                <BookCover src={b.coverUrl} title={b.title} emoji={emoji} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <h3 className="font-bold leading-snug text-gray-800 dark:text-slate-100">{b.title}</h3>
                  <p className="text-sm text-gray-500 dark:text-slate-400">{b.author}</p>
                  <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                      {emoji} {t("collection." + (b.category === "TEXTBOOK" ? "textbooks" : b.category === "FICTION" ? "fiction" : "other"))}
                    </span>
                    {b.gradeLevel && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600 dark:bg-slate-800 dark:text-slate-300">
                        {t("collection.grade", { grade: b.gradeLevel })}
                      </span>
                    )}
                    {b.language && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600 dark:bg-slate-800 dark:text-slate-300">
                        {b.language}
                      </span>
                    )}
                  </div>
                  {r?._avg.rating ? (
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Stars value={r._avg.rating} size="text-sm" /> ({r._count._all})
                    </div>
                  ) : null}
                  {b.description && (
                    <p className="line-clamp-2 text-xs text-gray-500 dark:text-slate-400">{b.description}</p>
                  )}
                  <div className="mt-auto flex items-center justify-between pt-1 text-xs">
                    <span
                      className={
                        "rounded-full px-2.5 py-1 font-semibold " +
                        (b.available > 0
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                          : "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300")
                      }
                    >
                      {b.available > 0 ? t("collection.available", { n: b.available, total: b.copies }) : t("collection.unavailable")}
                    </span>
                    {b.shelf && <span className="text-gray-400">📍 {b.shelf}</span>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LibraryBooks;
