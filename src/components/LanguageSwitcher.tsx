"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import DropdownPortal from "./DropdownPortal";

const LOCALES = [
  { code: "en", label: "EN" },
  { code: "ru", label: "RU" },
  { code: "kk", label: "KZ" },
];

const LanguageSwitcher = () => {
  const t = useTranslations("LanguageSwitcher");
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selectLocale = (code: string) => {
    document.cookie = `NEXT_LOCALE=${code}; path=/; max-age=31536000`;
    setOpen(false);
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <div>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="circle-icon-btn cursor-pointer flex items-center justify-center"
        aria-label={t("label")}
        title={t("label")}
        disabled={isPending}
      >
        <span className="text-xs font-semibold text-blue-800 dark:text-blue-200">
          {locale.toUpperCase()}
        </span>
      </button>
      <DropdownPortal
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={triggerRef}
        align="right"
        className="w-36 bg-white border border-blue-200 rounded-md shadow-lg py-1 dark:bg-slate-900 dark:border-slate-700"
      >
        {LOCALES.map(({ code, label }) => (
          <button
            key={code}
            type="button"
            onClick={() => selectLocale(code)}
            className={`w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 dark:hover:bg-blue-950/60 ${
              locale === code ? "font-semibold text-blue-700 dark:text-blue-300" : "text-blue-900 dark:text-blue-100"
            }`}
          >
            {label} · {t(code)}
          </button>
        ))}
      </DropdownPortal>
    </div>
  );
};

export default LanguageSwitcher;
