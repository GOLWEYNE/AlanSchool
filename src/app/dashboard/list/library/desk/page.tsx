import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { routeAccessMap } from "@/lib/settings";
import { canManageLibrary, studentsByIds } from "@/lib/library";
import {
  addPhoto,
  answerRequest,
  deleteBook,
  deletePhoto,
  deletePost,
  deleteReview,
  lendBook,
  moderateReview,
  returnLoan,
  saveBook,
  savePost,
  saveSettings,
  setFeaturedBook,
} from "@/lib/libraryActions";
import { BOOK_CATEGORIES } from "@/lib/libraryShared";
import { ActionButton, ActionForm, FIELD, ImageField, LendFields } from "@/components/library/LibraryClient";
import { Empty, Section, Stars } from "@/components/library/LibraryUi";

type TFn = (key: string, values?: Record<string, string | number>) => string;
const LABEL = "flex flex-col gap-1 text-xs font-medium text-gray-500 dark:text-slate-400";

function BookFields({ t, book }: { t: TFn; book?: { id: number; title: string; author: string; category: string; gradeLevel: string | null; language: string | null; description: string | null; coverUrl: string | null; shelf: string | null; copies: number } }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {book && <input type="hidden" name="id" value={book.id} />}
      <label className={LABEL}>
        {t("desk.fTitle")}
        <input className={FIELD} name="title" required maxLength={200} defaultValue={book?.title} />
      </label>
      <label className={LABEL}>
        {t("desk.fAuthor")}
        <input className={FIELD} name="author" required maxLength={200} defaultValue={book?.author} />
      </label>
      <label className={LABEL}>
        {t("desk.fCategory")}
        <select className={FIELD} name="category" defaultValue={book?.category ?? "FICTION"}>
          {BOOK_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t("collection." + (c === "TEXTBOOK" ? "textbooks" : c === "FICTION" ? "fiction" : "other"))}
            </option>
          ))}
        </select>
      </label>
      <label className={LABEL}>
        {t("desk.fCopies")}
        <input className={FIELD} type="number" name="copies" min={1} max={500} defaultValue={book?.copies ?? 1} />
      </label>
      <label className={LABEL}>
        {t("desk.fGrade")}
        <input className={FIELD} name="gradeLevel" maxLength={40} defaultValue={book?.gradeLevel ?? ""} placeholder="1-2" />
      </label>
      <label className={LABEL}>
        {t("desk.fLanguage")}
        <input className={FIELD} name="language" maxLength={40} defaultValue={book?.language ?? ""} placeholder="EN / RU / KK" />
      </label>
      <label className={LABEL}>
        {t("desk.fShelf")}
        <input className={FIELD} name="shelf" maxLength={60} defaultValue={book?.shelf ?? ""} />
      </label>
      <ImageField name="coverUrl" label={t("desk.fCover")} uploadLabel={t("desk.upload")} initial={book?.coverUrl} />
      <label className={LABEL + " md:col-span-2"}>
        {t("desk.fDescription")}
        <textarea className={FIELD} name="description" rows={2} maxLength={1500} defaultValue={book?.description ?? ""} />
      </label>
    </div>
  );
}

const LibraryDesk = async () => {
  const { userId, role } = requireRole(routeAccessMap["/dashboard/list/library(.*)"]);
  if (!(await canManageLibrary(userId, role))) redirect("/dashboard/list/library");

  const t = (await getTranslations("Library")) as unknown as TFn;
  const format = await getFormatter();
  const now = Date.now();

  const [books, loans, pendingReviews, openRequests, posts, photos, settings, classes, students, teachers, outCounts] =
    await Promise.all([
      prisma.libraryBook.findMany({ orderBy: { title: "asc" }, take: 500 }),
      prisma.libraryLoan.findMany({
        where: { returnedAt: null },
        orderBy: { dueAt: "asc" },
        include: { book: { select: { title: true } } },
      }),
      prisma.libraryReview.findMany({
        where: { status: "PENDING" },
        orderBy: { createdAt: "asc" },
        include: { book: { select: { title: true } } },
      }),
      prisma.libraryRequest.findMany({ where: { status: "OPEN" }, orderBy: { createdAt: "asc" } }),
      prisma.libraryPost.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
      prisma.libraryPhoto.findMany({ orderBy: { createdAt: "desc" }, take: 12 }),
      prisma.librarySettings.findUnique({ where: { id: 1 } }),
      prisma.class.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      prisma.student.findMany({
        orderBy: [{ surname: "asc" }, { name: "asc" }],
        select: { id: true, name: true, surname: true, classId: true },
      }),
      role === "admin"
        ? prisma.teacher.findMany({ orderBy: { surname: "asc" }, select: { id: true, name: true, surname: true } })
        : Promise.resolve([]),
      prisma.libraryLoan.groupBy({ by: ["bookId"], where: { returnedAt: null }, _count: { _all: true } }),
    ]);

  const outMap = new Map(outCounts.map((o) => [o.bookId, o._count._all]));
  const people = await studentsByIds([
    ...loans.map((l) => l.studentId),
    ...pendingReviews.map((r) => r.studentId),
    ...openRequests.map((r) => r.studentId),
  ]);
  const lendBooks = books.map((b) => ({ id: b.id, title: b.title, available: Math.max(b.copies - (outMap.get(b.id) ?? 0), 0) }));
  const overdueCount = loans.filter((l) => l.dueAt.getTime() < now).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2 text-sm">
        <span className="rounded-full bg-blue-100 px-3 py-1 font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
          {t("desk.openLoans", { count: loans.length })}
        </span>
        <span className="rounded-full bg-rose-100 px-3 py-1 font-semibold text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
          {t("desk.overdueCount", { count: overdueCount })}
        </span>
        <span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
          {t("desk.pendingCount", { count: pendingReviews.length + openRequests.length })}
        </span>
      </div>

      <Section title={t("desk.lendTitle")} emoji="🤝">
        {books.length === 0 ? (
          <Empty>{t("desk.addFirst")}</Empty>
        ) : (
          <ActionForm action={lendBook} submitLabel={t("desk.lend")}>
            <LendFields
              classes={classes}
              students={students.map((s) => ({ id: s.id, name: `${s.surname} ${s.name}`, classId: s.classId }))}
              books={lendBooks}
              labels={{
                class: t("desk.fClass"),
                student: t("desk.fStudent"),
                book: t("desk.fBook"),
                days: t("desk.fDays"),
                choose: t("desk.choose"),
                search: t("desk.searchStudent"),
              }}
            />
          </ActionForm>
        )}
      </Section>

      <Section title={t("desk.loansTitle")} emoji="📋">
        {loans.length === 0 ? (
          <Empty>{t("desk.noLoans")}</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-gray-500 dark:text-slate-400">
                <tr>
                  <th className="py-2 pr-3">{t("desk.fBook")}</th>
                  <th className="py-2 pr-3">{t("desk.fStudent")}</th>
                  <th className="py-2 pr-3">{t("desk.due")}</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {loans.map((l) => {
                  const who = people.get(l.studentId);
                  const late = l.dueAt.getTime() < now;
                  return (
                    <tr key={l.id}>
                      <td className="py-2 pr-3 font-medium text-gray-800 dark:text-slate-100">{l.book.title}</td>
                      <td className="py-2 pr-3 text-gray-600 dark:text-slate-300">
                        {who?.name ?? "—"} <span className="text-xs text-gray-400">{who?.className}</span>
                      </td>
                      <td className="py-2 pr-3">
                        <span
                          className={
                            "rounded-full px-2.5 py-1 text-xs font-semibold " +
                            (late
                              ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                              : "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-300")
                          }
                        >
                          {format.dateTime(l.dueAt, { day: "numeric", month: "short", timeZone: "Asia/Almaty" })}
                          {late ? " ⚠️" : ""}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        <ActionButton action={returnLoan.bind(null, l.id)} label={t("desk.return")} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title={t("desk.reviewsTitle")} emoji="💬">
          {pendingReviews.length === 0 ? (
            <Empty>{t("desk.noReviews")}</Empty>
          ) : (
            <ul className="flex flex-col gap-3">
              {pendingReviews.map((r) => (
                <li key={r.id} className="rounded-xl bg-gray-50 p-3 text-sm dark:bg-slate-800/60">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-gray-800 dark:text-slate-100">{r.book.title}</span>
                    <Stars value={r.rating} size="text-sm" />
                  </div>
                  <div className="text-xs text-gray-500 dark:text-slate-400">{people.get(r.studentId)?.name}</div>
                  <p className="mt-1 text-gray-700 dark:text-slate-300">“{r.text}”</p>
                  <div className="mt-2 flex gap-2">
                    <ActionButton action={moderateReview.bind(null, r.id, "APPROVED")} label={t("desk.approve")} />
                    <ActionButton action={moderateReview.bind(null, r.id, "REJECTED")} label={t("desk.reject")} />
                    <ActionButton
                      action={deleteReview.bind(null, r.id)}
                      label={t("desk.delete")}
                      confirmText={t("desk.confirmDelete")}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title={t("desk.requestsTitle")} emoji="🔎">
          {openRequests.length === 0 ? (
            <Empty>{t("desk.noRequests")}</Empty>
          ) : (
            <ul className="flex flex-col gap-3">
              {openRequests.map((r) => (
                <li key={r.id} className="rounded-xl bg-gray-50 p-3 text-sm dark:bg-slate-800/60">
                  <div className="text-xs text-gray-500 dark:text-slate-400">
                    {people.get(r.studentId)?.name} · {people.get(r.studentId)?.className}
                  </div>
                  <p className="mb-2 mt-1 text-gray-700 dark:text-slate-300">“{r.message}”</p>
                  <ActionForm action={answerRequest} submitLabel={t("desk.reply")}>
                    <input type="hidden" name="id" value={r.id} />
                    <textarea className={FIELD} name="reply" rows={2} required maxLength={500} placeholder={t("desk.replyPlaceholder")} />
                    <select className={FIELD} name="bookId" defaultValue="">
                      <option value="">{t("desk.noSuggestion")}</option>
                      {books.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.title}
                        </option>
                      ))}
                    </select>
                  </ActionForm>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title={t("desk.featuredTitle")} emoji="⭐">
          {books.length === 0 ? (
            <Empty>{t("desk.addFirst")}</Empty>
          ) : (
            <ActionForm action={setFeaturedBook} submitLabel={t("desk.save")} resetOnSuccess={false}>
              <select className={FIELD} name="bookId" required defaultValue={settings?.featuredBookId ?? ""}>
                <option value="" disabled>
                  {t("desk.choose")}
                </option>
                {books.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title}
                  </option>
                ))}
              </select>
              <textarea
                className={FIELD}
                name="note"
                rows={2}
                maxLength={400}
                defaultValue={settings?.featuredNote ?? ""}
                placeholder={t("desk.featuredNote")}
              />
            </ActionForm>
          )}
        </Section>

        <Section title={t("desk.postTitle")} emoji="📰">
          <ActionForm action={savePost} submitLabel={t("desk.publish")}>
            <select className={FIELD} name="kind" defaultValue="NEWS">
              <option value="NEWS">{t("news.title")}</option>
              <option value="TODAY">{t("today.title")}</option>
            </select>
            <input className={FIELD} name="title" required maxLength={140} placeholder={t("desk.fTitle")} />
            <textarea className={FIELD} name="body" rows={3} required maxLength={2000} placeholder={t("desk.postBody")} />
            <ImageField name="imageUrl" label={t("desk.fImage")} uploadLabel={t("desk.upload")} />
          </ActionForm>
          {posts.length > 0 && (
            <ul className="mt-4 divide-y divide-gray-100 text-sm dark:divide-slate-800">
              {posts.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                  <span className="min-w-0 truncate">
                    <span className="mr-2 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                      {p.kind === "TODAY" ? t("desk.kindToday") : t("desk.kindNews")}
                    </span>
                    {p.title}
                  </span>
                  <ActionButton action={deletePost.bind(null, p.id)} label={t("desk.delete")} confirmText={t("desk.confirmDelete")} />
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section title={t("desk.photosTitle")} emoji="📸">
        <ActionForm action={addPhoto} submitLabel={t("desk.publish")}>
          <ImageField name="url" label={t("desk.fPhoto")} uploadLabel={t("desk.upload")} />
          <input className={FIELD} name="caption" maxLength={200} placeholder={t("desk.fCaption")} />
        </ActionForm>
        {photos.length > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-3 md:grid-cols-6">
            {photos.map((p) => (
              <div key={p.id} className="flex flex-col gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.caption ?? ""} className="h-20 w-full rounded-lg object-cover" />
                <ActionButton action={deletePhoto.bind(null, p.id)} label={t("desk.delete")} confirmText={t("desk.confirmDelete")} />
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title={t("desk.booksTitle")} emoji="📚">
        <details className="rounded-xl border border-dashed border-blue-300 p-3 dark:border-blue-800" open={books.length === 0}>
          <summary className="cursor-pointer text-sm font-semibold text-blue-700 dark:text-blue-300">
            + {t("desk.addBook")}
          </summary>
          <div className="mt-3">
            <ActionForm action={saveBook} submitLabel={t("desk.addBook")}>
              <BookFields t={t} />
            </ActionForm>
          </div>
        </details>
        {books.length > 0 && (
          <ul className="mt-4 flex flex-col divide-y divide-gray-100 dark:divide-slate-800">
            {books.map((b) => (
              <li key={b.id} className="py-2">
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-medium text-gray-800 dark:text-slate-100">
                      {b.title} <span className="text-gray-400">— {b.author}</span>
                    </span>
                    <span className="text-xs text-gray-500 dark:text-slate-400">
                      {t("desk.copiesLine", { out: outMap.get(b.id) ?? 0, total: b.copies })}
                    </span>
                  </summary>
                  <div className="mt-3 flex flex-col gap-3">
                    <ActionForm action={saveBook} submitLabel={t("desk.save")} resetOnSuccess={false}>
                      <BookFields t={t} book={b} />
                    </ActionForm>
                    <div>
                      <ActionButton
                        action={deleteBook.bind(null, b.id)}
                        label={t("desk.deleteBook")}
                        confirmText={t("desk.confirmDelete")}
                      />
                    </div>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t("desk.settingsTitle")} emoji="⚙️">
        <ActionForm action={saveSettings} submitLabel={t("desk.save")} resetOnSuccess={false}>
          <div className="grid gap-3 md:grid-cols-2">
            <label className={LABEL}>
              {t("desk.fLibrarianName")}
              <input className={FIELD} name="librarianName" maxLength={120} defaultValue={settings?.librarianName ?? ""} />
            </label>
            <ImageField name="librarianImg" label={t("desk.fLibrarianPhoto")} uploadLabel={t("desk.upload")} initial={settings?.librarianImg} />
            <label className={LABEL}>
              {t("desk.fHours")}
              <input className={FIELD} name="hours" maxLength={200} defaultValue={settings?.hours ?? ""} placeholder="Mon–Fri 08:30–16:30" />
            </label>
            {role === "admin" && (
              <label className={LABEL}>
                {t("desk.fLibrarianTeacher")}
                <select className={FIELD} name="librarianTeacherId" defaultValue={settings?.librarianTeacherId ?? ""}>
                  <option value="">—</option>
                  {teachers.map((tc) => (
                    <option key={tc.id} value={tc.id}>
                      {tc.surname} {tc.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className={LABEL + " md:col-span-2"}>
              {t("desk.fIntro")}
              <textarea className={FIELD} name="intro" rows={3} maxLength={1500} defaultValue={settings?.intro ?? ""} />
            </label>
            <label className={LABEL + " md:col-span-2"}>
              {t("desk.fGoals")}
              <textarea className={FIELD} name="goals" rows={3} maxLength={1500} defaultValue={settings?.goals ?? ""} />
            </label>
          </div>
        </ActionForm>
      </Section>
    </div>
  );
};

export default LibraryDesk;
