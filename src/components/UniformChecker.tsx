"use client";

import { useState, useTransition } from "react";
import { saveUniformChecks } from "@/lib/uniformActions";
import { UNIFORM_ITEMS, STATUS_LABEL, type UniformStatusKey } from "@/lib/uniform";

export type UniformRow = {
  id: string;
  name: string;
  surname: string;
  status: UniformStatusKey;
  missingItems: string[];
  note: string;
};

const STATUS_STYLE: Record<UniformStatusKey, { on: string; icon: string }> = {
  FULL: { on: "bg-emerald-500 text-white border-emerald-500", icon: "✓" },
  PARTIAL: { on: "bg-amber-500 text-white border-amber-500", icon: "!" },
  NONE: { on: "bg-rose-500 text-white border-rose-500", icon: "✕" },
};

const OFF =
  "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800";

export default function UniformChecker({
  classId,
  date,
  initial,
  canEdit,
}: {
  classId: number;
  date: string;
  initial: UniformRow[];
  canEdit: boolean;
}) {
  const [rows, setRows] = useState<UniformRow[]>(initial);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const update = (id: string, patch: Partial<UniformRow>) => {
    setMessage(null);
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const setStatus = (id: string, status: UniformStatusKey) =>
    update(id, { status, missingItems: status === "FULL" ? [] : rows.find((r) => r.id === id)?.missingItems ?? [] });

  const toggleItem = (id: string, key: string) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const has = row.missingItems.includes(key);
    update(id, { missingItems: has ? row.missingItems.filter((k) => k !== key) : [...row.missingItems, key] });
  };

  const markAllFull = () => {
    setMessage(null);
    setRows((prev) => prev.map((r) => ({ ...r, status: "FULL", missingItems: [], note: "" })));
  };

  const counts = {
    FULL: rows.filter((r) => r.status === "FULL").length,
    PARTIAL: rows.filter((r) => r.status === "PARTIAL").length,
    NONE: rows.filter((r) => r.status === "NONE").length,
  };

  const save = () => {
    startTransition(async () => {
      const res = await saveUniformChecks(
        classId,
        date,
        rows.map((r) => ({ studentId: r.id, status: r.status, missingItems: r.missingItems, note: r.note }))
      );
      setMessage(
        res.ok
          ? { ok: true, text: "Saved uniform check for " + res.saved + " students." }
          : { ok: false, text: res.error ?? "Could not save." }
      );
    });
  };

  if (rows.length === 0) {
    return <p className="p-4 text-sm text-gray-500">This class has no students yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
          Full: {counts.FULL}
        </span>
        <span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
          Partial: {counts.PARTIAL}
        </span>
        <span className="rounded-full bg-rose-100 px-3 py-1 font-semibold text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
          None: {counts.NONE}
        </span>
        {canEdit && (
          <button
            type="button"
            onClick={markAllFull}
            className="ml-auto rounded-lg border border-emerald-300 px-3 py-1.5 font-medium text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
          >
            Everyone in full uniform
          </button>
        )}
      </div>

      <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
        {rows.map((r, idx) => (
          <li key={r.id} className="flex flex-col gap-2 p-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="w-6 text-xs text-gray-400">{idx + 1}</span>
              <span className="min-w-[10rem] flex-1 font-medium text-gray-800 dark:text-slate-100">
                {r.name} {r.surname}
              </span>
              <div className="flex gap-1.5">
                {(["FULL", "PARTIAL", "NONE"] as UniformStatusKey[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => setStatus(r.id, s)}
                    className={"rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed " + (r.status === s ? STATUS_STYLE[s].on : OFF)}
                  >
                    {STATUS_STYLE[s].icon} {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
            </div>
            {r.status !== "FULL" && (
              <div className="ml-9 flex flex-col gap-2">
                <div className="flex flex-wrap gap-1.5">
                  {UNIFORM_ITEMS.map((it) => (
                    <button
                      key={it.key}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => toggleItem(r.id, it.key)}
                      className={"rounded-full border px-2.5 py-1 text-xs transition disabled:cursor-not-allowed " + (r.missingItems.includes(it.key) ? "border-rose-400 bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300" : OFF)}
                    >
                      {r.missingItems.includes(it.key) ? "Missing: " : ""}
                      {it.label}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  maxLength={200}
                  disabled={!canEdit}
                  value={r.note}
                  onChange={(e) => update(r.id, { note: e.target.value })}
                  placeholder="Note (optional), e.g. reason given"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
            )}
          </li>
        ))}
      </ul>

      {canEdit && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {pending ? "Saving..." : "Save uniform check"}
          </button>
          {message && (
            <span className={"text-sm " + (message.ok ? "text-emerald-600" : "text-rose-600")}>{message.text}</span>
          )}
        </div>
      )}
    </div>
  );
}
