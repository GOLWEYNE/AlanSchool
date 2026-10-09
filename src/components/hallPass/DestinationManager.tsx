"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { deleteDestination, saveDestination } from "@/lib/hallPassActions";
import type { DestinationDTO } from "@/lib/hallPassShared";

const INPUT =
  "rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

type Draft = {
  id?: number;
  name: string;
  maxMinutes: string;
  maxConcurrent: string;
  active: boolean;
  sortOrder: string;
};

const toDraft = (d?: DestinationDTO): Draft => ({
  id: d?.id,
  name: d?.name ?? "",
  maxMinutes: String(d?.maxMinutes ?? 10),
  maxConcurrent: d?.maxConcurrent ? String(d.maxConcurrent) : "",
  active: d?.active ?? true,
  sortOrder: String(d?.sortOrder ?? 0),
});

// Admin screen: allowed duration per destination and an on/off switch for each room.
export default function DestinationManager({ destinations }: { destinations: DestinationDTO[] }) {
  const t = useTranslations("HallPass.settings.destinations");
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-gray-600 dark:text-slate-300">{t("hint")}</p>
      <div className="flex flex-col gap-2">
        {destinations.map((d) => (
          <Row key={d.id + "-" + d.name + d.maxMinutes + d.maxConcurrent + d.active + d.sortOrder} initial={toDraft(d)} />
        ))}
      </div>
      <h3 className="mt-2 text-sm font-semibold dark:text-slate-100">{t("addTitle")}</h3>
      <Row key={"new-" + destinations.length} initial={toDraft()} isNew />
    </div>
  );
}

function Row({ initial, isNew }: { initial: Draft; isNew?: boolean }) {
  const t = useTranslations("HallPass.settings.destinations");
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(initial);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const patch = (p: Partial<Draft>) => {
    setMessage(null);
    setDraft((d) => ({ ...d, ...p }));
  };

  const save = () =>
    startTransition(async () => {
      const res = await saveDestination({
        id: draft.id,
        name: draft.name,
        maxMinutes: parseInt(draft.maxMinutes, 10),
        maxConcurrent: draft.maxConcurrent.trim() === "" ? null : parseInt(draft.maxConcurrent, 10),
        active: draft.active,
        sortOrder: parseInt(draft.sortOrder, 10) || 0,
      });
      setMessage(res.ok ? { ok: true, text: t("saved") } : { ok: false, text: res.error ?? "" });
      if (res.ok) router.refresh();
    });

  const remove = () => {
    if (!draft.id || !window.confirm(t("confirmDelete", { name: draft.name }))) return;
    startTransition(async () => {
      const res = await deleteDestination(draft.id!);
      setMessage(res.ok ? null : { ok: false, text: res.error ?? "" });
      if (res.ok) router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs text-gray-500 dark:text-slate-400">
        {t("name")}
        <input className={INPUT} maxLength={60} value={draft.name} onChange={(e) => patch({ name: e.target.value })} />
      </label>
      <label className="flex w-24 flex-col gap-1 text-xs text-gray-500 dark:text-slate-400">
        {t("minutes")}
        <input className={INPUT} type="number" min={1} max={120} value={draft.maxMinutes} onChange={(e) => patch({ maxMinutes: e.target.value })} />
      </label>
      <label className="flex w-28 flex-col gap-1 text-xs text-gray-500 dark:text-slate-400">
        {t("maxConcurrent")}
        <input className={INPUT} type="number" min={1} placeholder={t("noLimit")} value={draft.maxConcurrent} onChange={(e) => patch({ maxConcurrent: e.target.value })} />
      </label>
      <label className="flex w-20 flex-col gap-1 text-xs text-gray-500 dark:text-slate-400">
        {t("order")}
        <input className={INPUT} type="number" min={0} value={draft.sortOrder} onChange={(e) => patch({ sortOrder: e.target.value })} />
      </label>
      <label className="flex items-center gap-2 pb-2 text-sm dark:text-slate-200">
        <input type="checkbox" checked={draft.active} onChange={(e) => patch({ active: e.target.checked })} />
        {t("active")}
      </label>
      <div className="flex items-center gap-2 pb-0.5">
        <button type="button" disabled={pending || !draft.name.trim()} onClick={save} className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
          {isNew ? t("add") : t("save")}
        </button>
        {!isNew && (
          <button type="button" disabled={pending} onClick={remove} className="rounded-lg border border-rose-300 px-3 py-1.5 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60 dark:border-rose-800 dark:hover:bg-rose-900/30">
            {t("delete")}
          </button>
        )}
      </div>
      {message && <p className={"w-full text-sm " + (message.ok ? "text-emerald-600" : "text-rose-600")}>{message.text}</p>}
    </div>
  );
}
