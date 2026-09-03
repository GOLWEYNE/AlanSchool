"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useFormState } from "react-dom";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import { CldUploadWidget } from "next-cloudinary";
import { UploadCloud, Link2, CheckCircle2 } from "lucide-react";
import {
  featuredVideoSchema,
  FeaturedVideoSchema,
} from "@/lib/formValidationSchemas";
import { createFeaturedVideo } from "@/lib/actions";
import { isDirectVideoFile } from "@/lib/videoEmbed";

const FeaturedVideoForm = ({
  currentTitle,
  currentVideoUrl,
}: {
  currentTitle?: string;
  currentVideoUrl?: string;
}) => {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FeaturedVideoSchema>({
    resolver: zodResolver(featuredVideoSchema),
    defaultValues: {
      title: currentTitle ?? "",
      videoUrl: currentVideoUrl ?? "",
    },
  });

  const [state, formAction] = useFormState(createFeaturedVideo, {
    success: false,
    error: false,
  });

  // If the currently-published video is already an uploaded file (or a
  // direct link), open the settings page with the Upload tab selected so
  // it's obvious that's how it got there.
  const [source, setSource] = useState<"link" | "upload">(() =>
    currentVideoUrl && isDirectVideoFile(currentVideoUrl) ? "upload" : "link"
  );
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(
    currentVideoUrl && isDirectVideoFile(currentVideoUrl) ? "Current video" : null
  );

  const onSubmit = handleSubmit((values) => {
    formAction(values);
  });

  const router = useRouter();

  useEffect(() => {
    if (state.success) {
      toast("Featured video updated - it's now live on every dashboard.");
      router.refresh();
    }
  }, [state, router]);

  return (
    <form className="flex flex-col gap-5" onSubmit={onSubmit}>
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
          Video Title
        </label>
        <input
          type="text"
          placeholder="e.g. Welcome Back to School 2026!"
          {...register("title")}
          className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2.5 rounded-lg text-sm w-full"
        />
        {errors.title?.message && (
          <p className="text-xs text-red-400">{errors.title.message.toString()}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
          Video Source
        </label>

        <div className="flex gap-1 rounded-lg bg-gray-100 dark:bg-slate-800 p-1 w-fit">
          <button
            type="button"
            onClick={() => setSource("link")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              source === "link"
                ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-sm"
                : "text-gray-500 dark:text-slate-400"
            }`}
          >
            <Link2 size={13} /> Paste a Link
          </button>
          <button
            type="button"
            onClick={() => setSource("upload")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              source === "upload"
                ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-sm"
                : "text-gray-500 dark:text-slate-400"
            }`}
          >
            <UploadCloud size={13} /> Upload a Video
          </button>
        </div>

        {source === "link" ? (
          <>
            <input
              type="text"
              placeholder="YouTube, TikTok, Instagram Reels, or Vimeo link"
              {...register("videoUrl")}
              className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2.5 rounded-lg text-sm w-full"
            />
            <p className="text-xs text-gray-400 dark:text-slate-500">
              Regular share links work fine - they&apos;re converted automatically.
              For TikTok, use the full video link rather than a shortened
              vm.tiktok.com link.
            </p>
          </>
        ) : (
          <div className="flex flex-col gap-2">
            {/* Keeps videoUrl registered with react-hook-form while the
                text input above is unmounted, so the uploaded URL still
                submits with the rest of the form. */}
            <input type="hidden" {...register("videoUrl")} />
            <CldUploadWidget
              uploadPreset="school"
              options={{
                resourceType: "video",
                sources: ["local"],
                clientAllowedFormats: ["mp4", "mov", "webm", "mkv", "avi", "m4v"],
                maxFileSize: 209715200,
              }}
              onSuccess={(result, { widget }) => {
                const info = result?.info as { secure_url?: string; original_filename?: string } | undefined;
                if (info?.secure_url) {
                  setValue("videoUrl", info.secure_url, { shouldValidate: true });
                  setUploadedFileName(info.original_filename || "video");
                }
                widget.close();
              }}
            >
              {({ open }) => (
                <div
                  onClick={() => open()}
                  className="flex items-center gap-3 cursor-pointer rounded-lg border-2 border-dashed border-gray-300 dark:border-slate-700 p-4 hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/10 shrink-0">
                    <UploadCloud size={16} className="text-blue-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-700 dark:text-slate-200">
                      {uploadedFileName ? "Video ready" : "Choose a video from your computer"}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-slate-500 truncate">
                      {uploadedFileName ?? "MP4, MOV, or WebM - up to 200MB"}
                    </p>
                  </div>
                  {uploadedFileName && (
                    <CheckCircle2 size={16} className="text-green-500 ml-auto shrink-0" />
                  )}
                </div>
              )}
            </CldUploadWidget>
          </div>
        )}

        {errors.videoUrl?.message && (
          <p className="text-xs text-red-400">{errors.videoUrl.message.toString()}</p>
        )}
      </div>

      {state.error && (
        <span className="text-sm text-red-500">
          Something went wrong. Please try again.
        </span>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 transition-colors text-white px-4 py-2.5 rounded-lg text-sm font-semibold shine-hover"
        >
          Publish Broadcast
        </button>
        <button
          type="button"
          onClick={() => {
            reset({ title: "", videoUrl: "" });
            setUploadedFileName(null);
            setSource("link");
          }}
          className="px-4 py-2.5 rounded-lg text-sm font-semibold text-gray-600 dark:text-slate-300 border border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800"
        >
          Reset
        </button>
      </div>
    </form>
  );
};

export default FeaturedVideoForm;
