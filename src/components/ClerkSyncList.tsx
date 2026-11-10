"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { removeOrphanRecords } from "@/lib/clerkSyncActions";

export type OrphanRow = {
  key: string; // "student:<id>" | "teacher:<id>"
  type: "student" | "teacher";
  name: string;
  username: string;
};

const ClerkSyncList = ({ rows }: { rows: OrphanRow[] }) => {
  const t = useTranslations("ClerkSync");
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [understood, setUnderstood] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const allSelected = rows.length > 0 && selected.size === rows.length;

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.key)));

  const submit = () => {
    setMessage(null);
    startTransition(async () => {
      const res = await removeOrphanRecords(Array.from(selected));
      if (res.error) {
        setMessage(t("failedCheck"));
      } else {
        setMessage(t("done", { removed: res.removed, failed: res.failed }));
        setSelected(new Set());
        setUnderstood(false);
        router.refresh();
      }
    });
  };

  return (
    <div>
      <ul className="mt-4 overflow-hidden rounded-3xl border border-blue-100 bg-white/80 shadow-sm dark:border-slate-700 dark:bg-slate-900/70 md:hidden">
        <li className="flex min-h-14 items-center gap-3 border-b border-blue-50 px-4 dark:border-slate-800">
          <input
            type="checkbox"
            className="h-6 w-6 shrink-0"
            checked={allSelected}
            onChange={toggleAll}
            aria-label={t("selectAll")}
          />
          <span className="text-sm font-semibold text-blue-800 dark:text-blue-200">{t("selectAll")}</span>
        </li>
        {rows.map((r) => (
          <li key={r.key} className="border-b border-blue-50 last:border-b-0 dark:border-slate-800">
            <label className="flex min-h-16 items-center gap-3 px-4 py-2">
              <input
                type="checkbox"
                className="h-6 w-6 shrink-0"
                checked={selected.has(r.key)}
                onChange={() => toggle(r.key)}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-semibold text-gray-800 dark:text-slate-100">{r.name}</span>
                <span className="block truncate text-sm text-gray-500 dark:text-slate-400">{r.username}</span>
              </span>
              <span className="shrink-0 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-500/15 dark:text-blue-200">
                {t(`types.${r.type}`)}
              </span>
            </label>
          </li>
        ))}
      </ul>

      <div className="data-table-shell mt-4 hidden overflow-x-auto md:block">
        <table className="w-full">
          <thead className="bg-gradient-to-r from-blue-50 via-sky-50 to-yellow-50 dark:from-blue-950/40 dark:via-slate-900/60 dark:to-yellow-950/20 border-b border-blue-100 dark:border-slate-800">
            <tr className="text-left text-blue-700 dark:text-blue-300 text-sm">
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label={t("selectAll")}
                />
              </th>
              <th className="px-4 py-3 font-semibold uppercase tracking-wide text-[11px]">
                {t("columns.name")}
              </th>
              <th className="px-4 py-3 font-semibold uppercase tracking-wide text-[11px]">
                {t("columns.username")}
              </th>
              <th className="px-4 py-3 font-semibold uppercase tracking-wide text-[11px]">
                {t("columns.type")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.key}
                className="border-b border-gray-200 dark:border-slate-800 even:bg-slate-50 dark:even:bg-slate-900/40 text-sm"
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(r.key)}
                    onChange={() => toggle(r.key)}
                  />
                </td>
                <td className="px-4 py-3 font-semibold">{r.name}</td>
                <td className="px-4 py-3">{r.username}</td>
                <td className="px-4 py-3">{t(`types.${r.type}`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-slate-300">
          <input
            type="checkbox"
            className="mt-1 max-md:h-6 max-md:w-6 max-md:shrink-0"
            checked={understood}
            onChange={(e) => setUnderstood(e.target.checked)}
          />
          <span>{t("confirm")}</span>
        </label>
        <div className="flex items-center gap-4 max-md:flex-col max-md:items-stretch">
          <button
            type="button"
            onClick={submit}
            disabled={pending || selected.size === 0 || !understood}
            className="rounded-md bg-red-600 text-white px-4 py-2 text-sm font-semibold disabled:opacity-40 max-md:min-h-12 max-md:rounded-2xl max-md:text-base"
          >
            {pending ? t("working") : t("remove", { count: selected.size })}
          </button>
          {message && (
            <p className="text-sm text-blue-900 dark:text-blue-200">{message}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClerkSyncList;
