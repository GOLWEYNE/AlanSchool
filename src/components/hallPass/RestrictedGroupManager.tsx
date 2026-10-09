"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  addGroupMember,
  deleteGroup,
  removeGroupMember,
  saveGroup,
  searchStudentsForGroup,
  setGroupActive,
  type StudentHit,
} from "@/lib/hallPassActions";

export type GroupDTO = {
  id: number;
  name: string;
  note: string | null;
  active: boolean;
  outNow: number;
  members: { id: string; name: string; username: string; className: string; isOut: boolean }[];
};

const INPUT =
  "rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";
const CARD =
  "rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900";

// Admin screen: groups of students who must never be out of class at the same time.
export default function RestrictedGroupManager({ groups }: { groups: GroupDTO[] }) {
  const t = useTranslations("HallPass.settings.groups");
  const router = useRouter();
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const create = () =>
    startTransition(async () => {
      setError(null);
      const res = await saveGroup({ name, note: note || null, active: true });
      if (!res.ok) return setError(res.error ?? "");
      setName("");
      setNote("");
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-600 dark:text-slate-300">{t("hint")}</p>

      <div className={CARD + " flex flex-wrap items-end gap-3"}>
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs text-gray-500 dark:text-slate-400">
          {t("name")}
          <input className={INPUT} maxLength={60} placeholder={t("namePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs text-gray-500 dark:text-slate-400">
          {t("note")}
          <input className={INPUT} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <button type="button" disabled={pending || !name.trim()} onClick={create} className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
          {t("create")}
        </button>
        {error && <p className="w-full text-sm text-rose-600">{error}</p>}
      </div>

      {groups.length === 0 && <p className="text-sm text-gray-500">{t("none")}</p>}
      {groups.map((g) => (
        <GroupCard key={g.id} group={g} />
      ))}
    </div>
  );
}

function GroupCard({ group }: { group: GroupDTO }) {
  const t = useTranslations("HallPass.settings.groups");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) setError(res.error ?? "");
      router.refresh();
    });

  return (
    <div className={CARD + " flex flex-col gap-3 " + (group.active ? "" : "opacity-75")}>
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-base font-semibold dark:text-slate-100">{group.name}</h3>
        <span className="text-xs text-gray-500 dark:text-slate-400">{t("memberCount", { count: group.members.length })}</span>
        {group.outNow > 0 && (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            {t("someoneOut")}
          </span>
        )}
        <label className="ml-auto flex items-center gap-2 text-sm dark:text-slate-200">
          <input type="checkbox" checked={group.active} disabled={pending} onChange={(e) => run(() => setGroupActive(group.id, e.target.checked))} />
          {t("ruleActive")}
        </label>
        <button
          type="button"
          disabled={pending}
          onClick={() => window.confirm(t("confirmDelete", { name: group.name })) && run(() => deleteGroup(group.id))}
          className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60 dark:border-rose-800 dark:hover:bg-rose-900/30"
        >
          {t("delete")}
        </button>
      </div>
      {group.note && <p className="text-sm text-gray-500 dark:text-slate-400">{group.note}</p>}

      {group.members.length === 0 ? (
        <p className="text-sm text-gray-500">{t("noMembers")}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {group.members.map((m) => (
            <li key={m.id} className={"flex items-center gap-2 rounded-full border px-3 py-1 text-sm " + (m.isOut ? "border-amber-400 bg-amber-50 dark:bg-amber-900/20" : "border-gray-200 bg-gray-50 dark:border-slate-700 dark:bg-slate-800")}>
              <span className="dark:text-slate-100">
                {m.name} <span className="text-xs text-gray-500 dark:text-slate-400">{m.className}</span>
              </span>
              <button type="button" aria-label={t("remove")} disabled={pending} onClick={() => run(() => removeGroupMember(group.id, m.id))} className="text-gray-400 hover:text-rose-600">
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <MemberSearch onPick={(student) => run(() => addGroupMember(group.id, student.id))} disabled={pending} />
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}

function MemberSearch({ onPick, disabled }: { onPick: (s: StudentHit) => void; disabled: boolean }) {
  const t = useTranslations("HallPass.settings.groups");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<StudentHit[]>([]);

  // Debounced search so typing doesn't fire a query per keystroke.
  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    let cancelled = false;
    const id = setTimeout(async () => {
      const found = await searchStudentsForGroup(q);
      if (!cancelled) setHits(found);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [q]);

  return (
    <div className="relative max-w-sm">
      <input className={INPUT + " w-full"} placeholder={t("searchPlaceholder")} value={q} onChange={(e) => setQ(e.target.value)} />
      {hits.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {hits.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  onPick(h);
                  setQ("");
                  setHits([]);
                }}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-blue-50 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                <span>{h.name}</span>
                <span className="text-xs text-gray-500 dark:text-slate-400">
                  {h.className} - {h.username}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
