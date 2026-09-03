import { Clapperboard, PlayCircle } from "lucide-react";
import prisma from "@/lib/prisma";

// Converts a normal YouTube/Vimeo share link into an embeddable iframe
// src so Admins can paste whatever link they copied from the browser bar
// instead of having to know the /embed/ URL format by heart. Anything we
// don't recognize is passed straight through - it's assumed to already be
// an embeddable URL (Loom, a direct /embed/ link, etc.).
export const getEmbeddableVideoUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = parsed.pathname.slice(1);
      return id ? `https://www.youtube.com/embed/${id}` : url;
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      if (parsed.pathname === "/watch") {
        const id = parsed.searchParams.get("v");
        return id ? `https://www.youtube.com/embed/${id}` : url;
      }
      if (parsed.pathname.startsWith("/shorts/")) {
        const id = parsed.pathname.split("/")[2];
        return id ? `https://www.youtube.com/embed/${id}` : url;
      }
      // Already an /embed/... link.
      return url;
    }

    if (host === "vimeo.com") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id ? `https://player.vimeo.com/video/${id}` : url;
    }

    return url;
  } catch {
    return url;
  }
};

const FeaturedVideoPlayer = async () => {
  const video = await prisma.announcementVideo.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="panel-card rounded-2xl p-5 md:p-6 shine-hover">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20">
          <Clapperboard size={18} className="text-blue-600 dark:text-blue-300" strokeWidth={2} />
        </div>
        <div>
          <h2 className="text-base font-bold text-gray-800 dark:text-blue-100">
            Featured Video
          </h2>
          <p className="text-xs text-gray-400 dark:text-slate-500">
            {video ? "Broadcast from your school" : "No broadcast is live right now"}
          </p>
        </div>
      </div>

      {video ? (
        <div>
          <div className="relative w-full aspect-video overflow-hidden rounded-xl bg-slate-900 shadow-inner">
            <iframe
              src={getEmbeddableVideoUrl(video.videoUrl)}
              title={video.title}
              className="absolute inset-0 h-full w-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
          <p className="mt-3 text-sm font-semibold text-gray-700 dark:text-slate-200 line-clamp-2">
            {video.title}
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center text-center gap-2 py-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20">
            <PlayCircle size={24} className="text-blue-400 dark:text-blue-300" />
          </div>
          <p className="text-sm font-semibold text-gray-600 dark:text-slate-300">
            No featured video yet.
          </p>
          <p className="text-xs text-gray-400 dark:text-slate-500 max-w-xs">
            Check back soon for the next school broadcast.
          </p>
        </div>
      )}
    </div>
  );
};

export default FeaturedVideoPlayer;
