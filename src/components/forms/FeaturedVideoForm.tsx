"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useFormState } from "react-dom";
import { useEffect } from "react";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import {
  featuredVideoSchema,
  FeaturedVideoSchema,
} from "@/lib/formValidationSchemas";
import { createFeaturedVideo } from "@/lib/actions";

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
          Video URL
        </label>
        <input
          type="text"
          placeholder="Paste a YouTube, Vimeo, or embeddable video link"
          {...register("videoUrl")}
          className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2.5 rounded-lg text-sm w-full"
        />
        {errors.videoUrl?.message && (
          <p className="text-xs text-red-400">{errors.videoUrl.message.toString()}</p>
        )}
        <p className="text-xs text-gray-400 dark:text-slate-500">
          Regular YouTube/Vimeo share links work fine - they&apos;re converted automatically.
        </p>
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
          onClick={() => reset()}
          className="px-4 py-2.5 rounded-lg text-sm font-semibold text-gray-600 dark:text-slate-300 border border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800"
        >
          Reset
        </button>
      </div>
    </form>
  );
};

export default FeaturedVideoForm;
