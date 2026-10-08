import { getFormatter, getTranslations } from "next-intl/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { routeAccessMap } from "@/lib/settings";
import { studentsByIds } from "@/lib/library";
import { askForBook, submitReview } from "@/lib/libraryActions";
import { ActionForm, FIELD } from "@/components/library/LibraryClient";
import { Avatar, Empty, Section, Stars } from "@/components/library/LibraryUi";

type TFn = (key: string, values?: Record<string, string | number>) => string;

const LibraryCommunity = async () => {
  const { userId, role } = requireRole(routeAccessMap["/dashboard/list/library(.*)"]);
  const t = (await getTranslations("Library")) as unknown as TFn;
  const format = await getFormatter();
  const isStudent = role === "student";

  const reviews = await prisma.libraryReview.findMany({
    where: { status: "APPROVED" },
    orderBy: { createdAt: "desc" },
    take: 24,
    include: { book: { select: { title: true, author: true } } },
  });
  const people = await studentsByIds(reviews.map((r) => r.studentId));

  // Books this student has borrowed and not yet reviewed, and their own requests.
  let reviewable: { id: number; title: string }[] = [];
  let myRequests: Awaited<ReturnType<typeof prisma.libraryRequest.findMany<{ include: { suggestedBook: { select: { title: true } } } }>>> = [];
  if (isStudent) {
    const [loans, mine, requests] = await Promise.all([
      prisma.libraryLoan.findMany({
        where: { studentId: userId },
        select: { book: { select: { id: true, title: true } } },
        orderBy: { borrowedAt: "desc" },
      }),
      prisma.libraryReview.findMany({ where: { studentId: userId }, select: { bookId: true } }),
      prisma.libraryRequest.findMany({
        where: { studentId: userId },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { suggestedBook: { select: { title: true } } },
      }),
    ]);
    const reviewed = new Set(mine.map((m) => m.bookId));
    const seen = new Set<number>();
    reviewable = loans
      .map((l) => l.book)
      .filter((b) => !reviewed.has(b.id) && !seen.has(b.id) && (seen.add(b.id), true));
    myRequests = requests;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Let's find a book together */}
        <Section title={t("community.findTitle")} emoji="🔎">
          <p className="mb-3 text-sm text-gray-600 dark:text-slate-300">{t("community.findIntro")}</p>
          {isStudent ? (
            <>
              <ActionForm action={askForBook} submitLabel={t("community.findSend")}>
                <textarea
                  name="message"
                  required
                  minLength={5}
                  maxLength={400}
                  rows={3}
                  className={FIELD}
                  placeholder={t("community.findPlaceholder")}
                />
              </ActionForm>
              {myRequests.length > 0 && (
                <ul className="mt-4 flex flex-col gap-3">
                  {myRequests.map((r) => (
                    <li key={r.id} className="rounded-xl bg-gray-50 p-3 text-sm dark:bg-slate-800/60">
                      <div className="text-gray-700 dark:text-slate-200">“{r.message}”</div>
                      {r.status === "ANSWERED" ? (
                        <div className="mt-2 rounded-lg bg-emerald-50 p-2 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
                          📚 {t("community.librarianSays")}: {r.reply}
                          {r.suggestedBook && (
                            <div className="mt-1 font-semibold">→ {r.suggestedBook.title}</div>
                          )}
                        </div>
                      ) : (
                        <div className="mt-1 text-xs text-gray-400">⏳ {t("community.waiting")}</div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <Empty>{t("community.studentsOnly")}</Empty>
          )}
        </Section>

        {/* Write a review */}
        <Section title={t("community.writeTitle")} emoji="✍️">
          {isStudent ? (
            reviewable.length === 0 ? (
              <Empty>{t("community.nothingToReview")}</Empty>
            ) : (
              <ActionForm action={submitReview} submitLabel={t("community.send")}>
                <label className="flex flex-col gap-1 text-xs font-medium text-gray-500 dark:text-slate-400">
                  {t("community.pickBook")}
                  <select name="bookId" required defaultValue="" className={FIELD}>
                    <option value="" disabled>
                      —
                    </option>
                    {reviewable.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-gray-500 dark:text-slate-400">
                  {t("community.rating")}
                  <select name="rating" required defaultValue="5" className={FIELD}>
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={n}>
                        {"★".repeat(n)}
                      </option>
                    ))}
                  </select>
                </label>
                <textarea
                  name="text"
                  required
                  minLength={5}
                  maxLength={600}
                  rows={3}
                  className={FIELD}
                  placeholder={t("community.reviewPlaceholder")}
                />
              </ActionForm>
            )
          ) : (
            <Empty>{t("community.studentsOnly")}</Empty>
          )}
        </Section>
      </div>

      <Section title={t("community.reviewsTitle")} emoji="💬">
        {reviews.length === 0 ? (
          <Empty>{t("community.reviewsEmpty")}</Empty>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {reviews.map((r) => {
              const who = people.get(r.studentId);
              return (
                <article key={r.id} className="flex flex-col gap-2 rounded-xl bg-gray-50 p-4 dark:bg-slate-800/60">
                  <div className="flex items-center gap-2">
                    <Avatar src={who?.img} name={who?.name ?? "?"} size={32} />
                    <div className="min-w-0 text-sm">
                      <div className="truncate font-semibold text-gray-800 dark:text-slate-100">{who?.name ?? "—"}</div>
                      <div className="text-xs text-gray-500 dark:text-slate-400">{who?.className}</div>
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-blue-700 dark:text-blue-300">{r.book.title}</div>
                  <Stars value={r.rating} />
                  <p className="text-sm text-gray-700 dark:text-slate-300">“{r.text}”</p>
                  <div className="text-xs text-gray-400">
                    {format.dateTime(r.createdAt, { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Almaty" })}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
};

export default LibraryCommunity;
