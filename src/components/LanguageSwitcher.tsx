"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

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

  const selectLocale = (code: string) => {
    document.cookie = `NEXT_LOCALE=${code}; path=/; max-age=31536000`;
    setOpen(false);
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="circle-icon-btn cursor-pointer flex items-center justify-center"
        aria-label={t("label")}
        title={t("label")}
        disabled={isPending}
      >
        <span className="text-xs font-semibold text-blue-800">
          {locale.toUpperCase()}
        </span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-36 bg-white border border-blue-200 rounded-md shadow-lg py-1 z-50">
          {LOCALES.map(({ code, label }) => (
            <button
              key={code}
              type="button"
              onClick={() => selectLocale(code)}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 ${
                locale === code ? "font-semibold text-blue-700" : "text-blue-900"
              }`}
            >
              {label} · {t(code)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;
