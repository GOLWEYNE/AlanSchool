import { auth } from "@clerk/nextjs/server";
import { ShieldAlert, History } from "lucide-react";
import { getUserRole } from "@/lib/auth";
import prisma from "@/lib/prisma";
import FeaturedVideoForm from "@/components/forms/FeaturedVideoForm";
import FeaturedVideoPlayer from "@/components/FeaturedVideoPlayer";

// Admin control panel for the dashboard-wide Featured Video broadcast.
// Publishing a new title/URL here immediately replaces what every Admin,
// Teacher, Parent, and Student sees on their own dashboard.
const FeaturedVideoSettingsPage = async () => {
  const { sessionClaims } = auth();
  const role = getUserRole(sessionClaims);

  if (role !== "admin") {
    return (
      <div className="flex-1 p-4">
        <div className="panel-card p-8 rounded-2xl flex flex-col items-center text-center gap-3 max-w-md mx-auto mt-12">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20">
            <ShieldAlert size={26} className="text-rose-500 dark:text-rose-300" />
          </div>
          <h1 className="text-lg font-bold text-gray-800 dark:text-blue-100">
            Access Restricted
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Only Admins can manage the featured video broadcast.
          </p>
        </div>
      </div>
    );
  }

  const [activeVideo, history] = await Promise.all([
    prisma.announcementVideo.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.announcementVideo.findMany({
      where: { isActive: false },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
  ]);

  return (
    <div className="p-4 flex flex-col gap-6 max-w-5xl">
      <div className="page-top-banner p-6 shine-hover">
        <h1 className="text-2xl font-bold">Featured Video Broadcast</h1>
        <p className="text-blue-50 text-sm mt-1">
          Publish the video every Admin, Teacher, Parent, and Student sees on
          their dashboard the moment they log in.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="panel-card p-5 md:p-6 rounded-2xl shine-hover">
          <h2 className="text-base font-bold text-gray-800 dark:text-blue-100 mb-4">
            Publish a New Broadcast
          </h2>
          <FeaturedVideoForm
            currentTitle={activeVideo?.title}
            currentVideoUrl={activeVideo?.videoUrl}
          />
        </div>

        <div className="flex flex-col gap-4">
          <FeaturedVideoPlayer />

          {history.length > 0 && (
            <div className="panel-card p-5 rounded-2xl">
              <div className="flex items-center gap-2 mb-3">
                <History size={16} className="text-blue-600 dark:text-blue-300" />
                <h3 className="text-sm font-bold text-gray-800 dark:text-blue-100">
                  Previous Broadcasts
                </h3>
              </div>
              <ul className="flex flex-col gap-2">
                {history.map((item) => (
                  <li
                    key={item.id}
                    className="text-xs text-gray-500 dark:text-slate-400 flex items-center justify-between gap-2 border-b border-gray-100 dark:border-slate-800 pb-2 last:border-0 last:pb-0"
                  >
                    <span className="truncate font-medium text-gray-600 dark:text-slate-300">
                      {item.title}
                    </span>
                    <span className="shrink-0">
                      {item.updatedAt.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FeaturedVideoSettingsPage;
