import { Clapperboard, PlayCircle } from "lucide-react";
import prisma from "@/lib/prisma";
import { getEmbeddableVideoUrl, isDirectVideoFile } from "@/lib/videoEmbed";

// Re-exported so anything already importing this from FeaturedVideoPlayer
// keeps working; the actual logic now lives in a client-safe shared module
// so FeaturedVideoForm can use it too.
export { getEmbeddableVideoUrl };

const FeaturedVideoPlayer = async () => {
  const video = await prisma.announcementVideo.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: "desc" },
  });

  const isFile = video ? isDirectVideoFile(video.videoUrl) : false;

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
            {isFile ? (
              <video
                src={video.videoUrl}
                controls
                playsInline
                preload="metadata"
                className="absolute inset-0 h-full w-full object-contain"
              />
            ) : (
              <iframe
                src={getEmbeddableVideoUrl(video.videoUrl)}
                title={video.title}
                className="absolute inset-0 h-full w-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            )}
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
