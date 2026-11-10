"use client";

import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";
import { useTranslations } from "next-intl";

// Grouped rows like the iPhone Settings app: each group is one rounded card.
const SettingsPage = () => {
  const tm = useTranslations("Menu");
  const t = useTranslations("Profiles.account");
  return (
    <div className="mx-auto w-full max-w-2xl p-4">
      <h1 className="px-1 text-3xl font-bold text-blue-950 dark:text-blue-50">{tm("settings")}</h1>
      <p className="mb-5 mt-1 px-1 text-sm text-gray-600 dark:text-slate-400">{t("settingsSubtitle")}</p>

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-blue-50 dark:bg-slate-900/60 dark:ring-slate-800">
        <Link
          href="/dashboard/profile"
          className="flex min-h-14 items-center gap-3 px-4 py-3 active:bg-gray-50 dark:active:bg-slate-800"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-lg text-white" aria-hidden="true">
            ☺
          </span>
          <span className="flex-1">
            <span className="block font-medium text-gray-900 dark:text-slate-100">{tm("profile")}</span>
            <span className="block text-xs text-gray-500 dark:text-slate-400">{t("profileTitle")}</span>
          </span>
          <span aria-hidden="true" className="text-xl text-gray-300">
            ›
          </span>
        </Link>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-blue-50 dark:bg-slate-900/60 dark:ring-slate-800">
        <SignOutButton>
          <button className="flex min-h-14 w-full flex-col items-center justify-center px-4 py-3 text-center active:bg-red-50 dark:active:bg-red-950/30">
            <span className="font-semibold text-red-600">{tm("logout")}</span>
            <span className="text-xs text-gray-500 dark:text-slate-400">{t("logoutDesc")}</span>
          </button>
        </SignOutButton>
      </div>
    </div>
  );
};

export default SettingsPage;
