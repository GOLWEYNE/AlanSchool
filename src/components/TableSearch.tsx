"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

const TableSearch = () => {
  const router = useRouter();
  const t = useTranslations("TableSearch");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const value = (e.currentTarget[0] as HTMLInputElement).value;

    const params = new URLSearchParams(window.location.search);
    params.set("search", value);
    router.push(`${window.location.pathname}?${params}`);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full md:w-auto flex items-center gap-2 text-xs rounded-full border border-blue-200 dark:border-slate-800 bg-gradient-to-r from-white via-blue-50 to-yellow-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 px-3 shadow-sm"
    >
      <Image src="/search.png" alt="" width={14} height={14} />
      <input
        type="text"
        placeholder={t("placeholder")}
        className="w-[220px] p-2 bg-transparent outline-none text-blue-900 dark:text-blue-100 placeholder:text-blue-400 dark:placeholder:text-blue-500/60"
      />
    </form>
  );
};

export default TableSearch;
