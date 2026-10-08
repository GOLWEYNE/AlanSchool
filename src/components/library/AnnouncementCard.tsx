import { getEmbeddableVideoUrl, isDirectVideoFile } from "@/lib/videoEmbed";
import { typeMeta } from "@/lib/libraryShared";
import type { AnnouncementView } from "@/lib/libraryAnnouncements";
import { Avatar, BookCover } from "@/components/library/LibraryUi";

type TFn = (key: string, values?: Record<string, string | number>) => string;

// Video (embedded or native) - shared by announcements and the home "Watch & listen" card.
export function VideoPlayer({ url, title }: { url: string; title?: string | null }) {
  return (
    <div className="overflow-hidden rounded-xl bg-black">
      {isDirectVideoFile(url) ? (
        <video src={url} controls preload="metadata" className="aspect-video w-full" />
      ) : (
        <iframe
          src={getEmbeddableVideoUrl(url)}
          title={title || "Video"}
          className="aspect-video w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          loading="lazy"
        />
      )}
    </div>
  );
}

export function AudioPlayer({ url, title }: { url: string; title?: string | null }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-gradient-to-r from-blue-50 to-amber-50 p-3 dark:from-blue-950/40 dark:to-amber-950/20">
      <div className="text-sm font-semibold text-gray-800 dark:text-slate-100">🔊 {title || "Audio"}</div>
      <audio src={url} controls preload="none" className="w-full" />
    </div>
  );
}

const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Almaty", ...opts }).format(d);

export default function AnnouncementCard({ item, t, compact = false }: { item: AnnouncementView; t: TFn; compact?: boolean }) {
  const meta = typeMeta(item.type);
  const audienceText =
    item.audience === "GRADES"
      ? t("announce.forGrades", { grades: [...item.gradeLevels].sort((a, b) => a - b).join(", ") })
      : item.audience === "CLASSES"
        ? t("announce.forClasses", { classes: item.classNames.join(", ") })
        : t("announce.forEveryone");

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
          {meta.emoji} {t("studio.types." + meta.key + ".name")}
        </span>
        {item.pinned && (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
            📌 {t("announce.pinned")}
          </span>
        )}
        <span className="ml-auto text-xs text-gray-400">{fmt(item.createdAt, { day: "numeric", month: "short", year: "numeric" })}</span>
      </header>

      <h3 className="text-lg font-bold leading-snug text-gray-900 dark:text-slate-100">{item.title}</h3>

      {item.month && (
        <div className="text-xs font-semibold uppercase tracking-wider text-amber-600">
          {t("announce.forMonth", { month: item.month })}
        </div>
      )}
      {item.eventAt && (
        <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
          🗓️ {fmt(item.eventAt, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
        </div>
      )}

      {item.people.length > 0 && (
        <ul className="flex flex-wrap gap-3">
          {item.people.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-50 to-yellow-50 py-1 pl-1 pr-4 ring-1 ring-amber-200 dark:from-amber-900/20 dark:to-yellow-900/10 dark:ring-amber-800"
            >
              <Avatar src={p.img} name={p.name} size={compact ? 32 : 44} />
              <span className="text-sm">
                <span className="block font-bold text-gray-800 dark:text-slate-100">{p.name}</span>
                <span className="block text-xs text-gray-500 dark:text-slate-400">{p.className}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {item.type === "CLASS_CHAMPION" && item.classNames.length > 0 && (
        <div className="text-base font-bold text-blue-700 dark:text-blue-300">🏫 {item.classNames.join(", ")}</div>
      )}

      <p className="whitespace-pre-line text-sm text-gray-700 dark:text-slate-300">{item.body}</p>

      {item.books.length > 0 && (
        <ul className="flex flex-wrap gap-3">
          {item.books.map((b) => (
            <li key={b.id} className="flex w-56 items-center gap-3 rounded-xl bg-gray-50 p-2 dark:bg-slate-800/60">
              <BookCover src={b.coverUrl} title={b.title} emoji="📖" className="h-16 w-12" />
              <span className="min-w-0 text-sm">
                <span className="block truncate font-semibold text-gray-800 dark:text-slate-100">{b.title}</span>
                <span className="block truncate text-xs text-gray-500 dark:text-slate-400">{b.author}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {item.photoUrls.length > 0 && (
        <div className={"grid gap-2 " + (item.photoUrls.length === 1 ? "grid-cols-1" : "grid-cols-2 md:grid-cols-3")}>
          {item.photoUrls.map((u) => (
            <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl bg-gray-100 dark:bg-slate-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" loading="lazy" className={(item.photoUrls.length === 1 ? "max-h-96" : "h-40") + " w-full object-cover"} />
            </a>
          ))}
        </div>
      )}

      {item.videoUrl && <VideoPlayer url={item.videoUrl} title={item.title} />}
      {item.audioUrl && <AudioPlayer url={item.audioUrl} title={item.audioTitle} />}

      <footer className="text-xs text-gray-400">👥 {audienceText}</footer>
    </article>
  );
}
