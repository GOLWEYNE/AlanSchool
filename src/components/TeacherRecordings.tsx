"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Eye, EyeOff, Film, Pencil, Play, RefreshCw, Trash2, Users, X } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { formatBytes, formatClock } from "@/lib/mediaRecording";

type Recording = {
  id: number;
  title: string;
  url: string;
  durationSec: number;
  bytes: number;
  sharedWithParents: boolean;
  createdAt: string;
};

type Props = {
  /** Bump to re-fetch after the recorder saves a new clip. */
  refreshKey?: number;
};

/**
 * "My recordings": a teacher's saved clips with watch, rename, share-with-parents
 * and delete, all in place. Rendered inside the camera card on the dashboard.
 */
const TeacherRecordings = ({ refreshKey = 0 }: Props) => {
  const t = useTranslations("Camera.recordings");
  const format = useFormatter();

  const [items, setItems] = useState<Recording[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ kind: "error" | "info"; key: string } | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/teacher-recordings", { cache: "no-store" });
      if (!res.ok) throw new Error("load_failed");
      const json = (await res.json()) as { items: Recording[] };
      setItems(json.items);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
      setItems((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const patch = async (id: number, body: Partial<Pick<Recording, "title" | "sharedWithParents">>) => {
    setBusyId(id);
    setMessage(null);
    try {
      const res = await fetch(`/api/teacher-recordings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("patch_failed");
      const json = (await res.json()) as { item: Recording };
      setItems((prev) => prev?.map((row) => (row.id === id ? { ...row, ...json.item } : row)) ?? prev);
    } catch {
      setMessage({ kind: "error", key: "deleteFailed" });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: number) => {
    setBusyId(id);
    setMessage(null);
    try {
      const res = await fetch(`/api/teacher-recordings/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete_failed");
      const json = (await res.json()) as { fileKept?: boolean };
      setItems((prev) => prev?.filter((row) => row.id !== id) ?? prev);
      if (playingId === id) setPlayingId(null);
      setConfirmId(null);
      if (json.fileKept) setMessage({ kind: "info", key: "fileKept" });
    } catch {
      setMessage({ kind: "error", key: "deleteFailed" });
    } finally {
      setBusyId(null);
    }
  };

  const copyLink = async (row: Recording) => {
    try {
      await navigator.clipboard.writeText(row.url);
      setCopiedId(row.id);
      window.setTimeout(() => setCopiedId((current) => (current === row.id ? null : current)), 2000);
    } catch {
      // Clipboard can be blocked on old/kiosk browsers; the link is still reachable via Watch.
    }
  };

  const iconBtn =
    "inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 transition hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-40";

  return (
    <section className="mt-6 border-t border-gray-100 dark:border-slate-800 pt-4" aria-label={t("title")}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-gray-800 dark:text-blue-100">
          <Film size={16} className="text-blue-600 dark:text-blue-300" />
          {t("title")}
          {items && items.length > 0 && (
            <span className="rounded-full bg-gray-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-gray-500 dark:text-slate-400">
              {items.length}
            </span>
          )}
        </h3>
      </div>

      {message && (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          className={`mb-2 text-xs ${message.kind === "error" ? "text-red-600 dark:text-red-300" : "text-amber-600 dark:text-amber-300"}`}
        >
          {t(message.key)}
        </p>
      )}

      {items === null && (
        <p className="flex items-center gap-2 text-xs text-gray-400 dark:text-slate-500">
          <RefreshCw size={12} className="animate-spin" />
        </p>
      )}
      {loadFailed && <p className="text-xs text-red-600 dark:text-red-300">{t("loadFailed")}</p>}
      {items && items.length === 0 && !loadFailed && (
        <p className="text-xs text-gray-400 dark:text-slate-500">{t("empty")}</p>
      )}

      <ul className="space-y-3">
        {items?.map((row) => {
          const busy = busyId === row.id;
          return (
            <li key={row.id} className="rounded-xl border border-gray-100 dark:border-slate-800 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {editingId === row.id ? (
                    <form
                      className="flex items-center gap-1"
                      onSubmit={async (event) => {
                        event.preventDefault();
                        await patch(row.id, { title: draft });
                        setEditingId(null);
                      }}
                    >
                      <input
                        autoFocus
                        value={draft}
                        maxLength={120}
                        onChange={(event) => setDraft(event.target.value)}
                        className="min-w-0 flex-1 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-sm text-gray-800 dark:text-slate-100"
                        aria-label={t("rename")}
                      />
                      <button type="submit" className={iconBtn} aria-label={t("save")} title={t("save")} disabled={busy}>
                        <Check size={14} />
                      </button>
                      <button
                        type="button"
                        className={iconBtn}
                        aria-label={t("cancel")}
                        title={t("cancel")}
                        onClick={() => setEditingId(null)}
                      >
                        <X size={14} />
                      </button>
                    </form>
                  ) : (
                    <p className="truncate text-sm font-semibold text-gray-800 dark:text-slate-100" title={row.title}>
                      {row.title}
                    </p>
                  )}
                  <p className="mt-0.5 text-[11px] text-gray-400 dark:text-slate-500">
                    {format.dateTime(new Date(row.createdAt), { dateStyle: "medium", timeStyle: "short" })}
                    {row.durationSec > 0 ? ` · ${formatClock(row.durationSec)}` : ""}
                    {row.bytes > 0 ? ` · ${formatBytes(row.bytes)}` : ""}
                  </p>
                </div>

                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    row.sharedWithParents
                      ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400"
                  }`}
                >
                  {row.sharedWithParents ? <Users size={11} /> : <EyeOff size={11} />}
                  {row.sharedWithParents ? t("sharedBadge") : t("privateBadge")}
                </span>
              </div>

              {playingId === row.id && (
                <video
                  src={row.url}
                  controls
                  autoPlay
                  playsInline
                  className="mt-3 aspect-video w-full rounded-lg bg-slate-900"
                />
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className={iconBtn}
                  onClick={() => setPlayingId((current) => (current === row.id ? null : row.id))}
                  aria-label={playingId === row.id ? t("close") : t("play")}
                  title={playingId === row.id ? t("close") : t("play")}
                >
                  {playingId === row.id ? <X size={14} /> : <Play size={14} />}
                </button>
                <button
                  type="button"
                  className={iconBtn}
                  onClick={() => {
                    setDraft(row.title);
                    setEditingId(row.id);
                  }}
                  aria-label={t("rename")}
                  title={t("rename")}
                  disabled={busy}
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  className={iconBtn}
                  onClick={() => void copyLink(row)}
                  aria-label={t("copyLink")}
                  title={copiedId === row.id ? t("copied") : t("copyLink")}
                >
                  {copiedId === row.id ? <Check size={14} /> : <Copy size={14} />}
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-slate-200 transition hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-40"
                  onClick={() => void patch(row.id, { sharedWithParents: !row.sharedWithParents })}
                  disabled={busy}
                >
                  {row.sharedWithParents ? <EyeOff size={13} /> : <Eye size={13} />}
                  {row.sharedWithParents ? t("unshare") : t("share")}
                </button>

                <span className="flex-1" />

                {confirmId === row.id ? (
                  <span className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-red-600 dark:text-red-300">{t("confirmDelete")}</span>
                    <button
                      type="button"
                      className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-500 disabled:opacity-50"
                      onClick={() => void remove(row.id)}
                      disabled={busy}
                    >
                      {busy ? t("deleting") : t("delete")}
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-gray-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-slate-300 transition hover:bg-gray-50 dark:hover:bg-slate-800"
                      onClick={() => setConfirmId(null)}
                      disabled={busy}
                    >
                      {t("cancel")}
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-300 transition hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-40"
                    onClick={() => setConfirmId(row.id)}
                    disabled={busy}
                  >
                    <Trash2 size={13} />
                    {t("delete")}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default TeacherRecordings;
