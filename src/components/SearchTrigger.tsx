"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";

const open = () => window.dispatchEvent(new Event("open-command-palette"));

// Desktop trigger: styled like the old (non-functional) search bar, but
// now actually opens the ⌘K command palette instead of doing nothing.
export const SearchTrigger = () => {
  const t = useTranslations("Navbar");

  return (
    <button
      type="button"
      onClick={open}
      className="hidden md:flex items-center gap-2 text-xs rounded-full border border-blue-200 bg-gradient-to-r from-white to-blue-50 px-3 hover:border-blue-300 transition-colors dark:border-slate-700 dark:from-slate-900 dark:to-slate-800 dark:hover:border-slate-600"
    >
      <Image src="/search.png" alt="" width={14} height={14} className="dark:invert dark:opacity-70" />
      <span className="w-[220px] p-2 text-left text-blue-400 dark:text-blue-500">{t("searchPlaceholder")}</span>
      <kbd className="text-[10px] font-semibold text-blue-400 border border-blue-200 rounded px-1.5 py-0.5 mr-1 dark:text-blue-500 dark:border-slate-700">
        ⌘K
      </kbd>
    </button>
  );
};

// Mobile trigger: a plain icon button next to settings/logout.
export const MobileSearchTrigger = () => {
  const t = useTranslations("Navbar");

  return (
    <button
      type="button"
      onClick={open}
      className="md:hidden circle-icon-btn"
      aria-label={t("searchPlaceholder")}
      title={t("searchPlaceholder")}
    >
      <Image src="/search.png" alt="" width={16} height={16} className="dark:invert dark:opacity-70" />
    </button>
  );
};
