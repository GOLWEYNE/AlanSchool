import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { routeAccessMap } from "@/lib/settings";
import { getReadingOverview } from "@/lib/library";
import { getPickerData, loadAnnouncements } from "@/lib/libraryAnnouncements";
import { schoolMonthKey } from "@/lib/libraryShared";
import {
  addPhotos,
  deleteAnnouncement,
  deletePhoto,
  publishAnnouncement,
  saveSpotlight,
  togglePinAnnouncement,
} from "@/lib/libraryActions";
import AnnouncementComposer from "@/components/library/AnnouncementComposer";
import { ActionButton, ActionForm, FIELD } from "@/components/library/LibraryClient";
import { MediaUrlField, PhotoMulti } from "@/components/library/LibraryPickers";
import { Empty, Section } from "@/components/library/LibraryUi";

type TFn = (key: string, values?: Record<string, string | number>) => string;

// Library Studio: the admin-only place to write announcements, pick students,
// grades and classes, and manage the library's photo / video / audio spaces.
const LibraryStudio = async () => {
  const { role } = requireRole(routeAccessMap["/dashboard/list/library/studio(.*)"]);
  if (role !== "admin") redirect("/dashboard/list/library");

  const t = (await getTranslations("Library")) as unknown as TFn;

  const [picker, books, overview, settings, photos, recent] = await Promise.all([
    getPickerData(),
    prisma.libraryBook.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true, author: true }, take: 500 }),
    getReadingOverview(),
    prisma.librarySettings.findUnique({ where: { id: 1 } }),
    prisma.libraryPhoto.findMany({ orderBy: { createdAt: "desc" }, take: 24 }),
    loadAnnouncements({ all: true, grades: [], classIds: [] }, { take: 20 }),
  ]);

  const suggestedReaders = overview.thisMonth.slice(0, 5).map((r) => ({
    id: r.student.id,
    name: r.student.name,
    sub: `${r.student.className} · ${t("readerMonth.books", { count: r.count })}`,
  }));
  const suggestedClasses = overview.classRows.slice(0, 3).map((c) => ({
    id: c.classId,
    name: c.name,
    sub: t("classRank.avg", { avg: c.average.toFixed(1) }),
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-gradient-to-r from-blue-700 via-blue-600 to-amber-400 p-5 text-white shadow-sm">
        <h2 className="text-xl font-bold">🎬 {t("studio.title")}</h2>
        <p className="mt-1 max-w-2xl text-sm opacity-95">{t("studio.subtitle")}</p>
      </div>

      <Section title={t("studio.composeTitle")} emoji="✍️">
        <AnnouncementComposer
          action={publishAnnouncement}
          grades={picker.grades}
          classes={picker.classes}
          students={picker.students}
          books={books}
          defaultMonth={schoolMonthKey(new Date())}
          suggestedReaders={suggestedReaders}
          suggestedClasses={suggestedClasses}
        />
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title={t("studio.galleryTitle")} emoji="📸">
          <p className="mb-3 text-sm text-gray-600 dark:text-slate-300">{t("studio.galleryHint")}</p>
          <ActionForm action={addPhotos} submitLabel={t("desk.publish")}>
            <PhotoMulti />
            <input className={FIELD} name="caption" maxLength={200} placeholder={t("desk.fCaption")} />
          </ActionForm>
          {photos.length > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-3 md:grid-cols-4">
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

        <Section title={t("studio.spotlightTitle")} emoji="🎬">
          <p className="mb-3 text-sm text-gray-600 dark:text-slate-300">{t("studio.spotlightHint")}</p>
          <ActionForm action={saveSpotlight} submitLabel={t("desk.save")} resetOnSuccess={false}>
            <MediaUrlField name="videoUrl" kind="video" label={"🎬 " + t("studio.video")} hint={t("studio.videoHint")} initial={settings?.spotlightVideoUrl} />
            <input className={FIELD} name="videoTitle" maxLength={140} defaultValue={settings?.spotlightVideoTitle ?? ""} placeholder={t("studio.videoTitle")} />
            <MediaUrlField name="audioUrl" kind="audio" label={"🔊 " + t("studio.audio")} hint={t("studio.audioHint")} initial={settings?.spotlightAudioUrl} />
            <input className={FIELD} name="audioTitle" maxLength={140} defaultValue={settings?.spotlightAudioTitle ?? ""} placeholder={t("studio.audioTitle")} />
          </ActionForm>
        </Section>
      </div>

      <Section title={t("studio.listTitle")} emoji="🗂️">
        {recent.length === 0 ? (
          <Empty>{t("studio.listEmpty")}</Empty>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-slate-800">
            {recent.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="mr-2 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                    {t("studio.types." + a.type + ".name")}
                  </span>
                  {a.pinned ? "📌 " : ""}
                  <span className="font-medium text-gray-800 dark:text-slate-100">{a.title}</span>
                </span>
                <span className="flex gap-2">
                  <ActionButton
                    action={togglePinAnnouncement.bind(null, a.id, !a.pinned)}
                    label={a.pinned ? t("studio.unpin") : t("studio.pin")}
                  />
                  <ActionButton
                    action={deleteAnnouncement.bind(null, a.id)}
                    label={t("desk.delete")}
                    confirmText={t("desk.confirmDelete")}
                  />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
};

export default LibraryStudio;
