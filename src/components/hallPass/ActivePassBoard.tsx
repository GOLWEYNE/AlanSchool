"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { endPass } from "@/lib/hallPassActions";
import type { ActivePassDTO, ActivePassesPayload } from "@/lib/hallPassShared";
import { formatSchoolTime } from "@/lib/hallPassShared";
import { formatClock, useServerNow } from "./clock";

const POLL_MS = 8000;

const CARD =
  "rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900";

// Live grid for teachers and admins: who is out, where, and for how long.
// There are no websockets on Vercel, so the board polls a small JSON endpoint every
// few seconds (only while the tab is visible) and ticks the timers locally.
export default function ActivePassBoard({ initial }: { initial: ActivePassesPayload }) {
  const t = useTranslations("HallPass");
  const [data, setData] = useState<ActivePassesPayload>(initial);
  const [online, setOnline] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [endingId, setEndingId] = useState<number | null>(null);
  const [, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const now = useServerNow(data.serverNow);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/hall-pass/active", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setData((await res.json()) as ActivePassesPayload);
      setOnline(true);
    } catch {
      setOnline(false);
    }
  }, []);

  useEffect(() => {
    let stopped = false;
    const loop = async () => {
      if (document.visibilityState === "visible") await refresh();
      if (!stopped) timer.current = setTimeout(loop, POLL_MS);
    };
    timer.current = setTimeout(loop, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        if (timer.current) clearTimeout(timer.current);
        void loop();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const end = (pass: ActivePassDTO) => {
    setError(null);
    setEndingId(pass.id);
    startTransition(async () => {
      const res = await endPass(pass.id);
      if (!res.ok) setError(res.error ?? t("errors.generic"));
      await refresh();
      setEndingId(null);
    });
  };

  const rows = data.passes
    .map((p) => {
      const elapsed = now - Date.parse(p.issuedAt);
      const limit = p.maxMinutes * 60_000;
      return { p, elapsed, limit, overdue: elapsed > limit };
    })
    // Overdue first, then whoever has been out the longest.
    .sort((a, b) => Number(b.overdue) - Number(a.overdue) || b.elapsed - a.elapsed);
  const overdueCount = rows.filter((r) => r.overdue).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label={t("board.outNow")} value={rows.length} tone="blue" />
        <Stat label={t("board.overdue")} value={overdueCount} tone={overdueCount > 0 ? "rose" : "gray"} />
        <Stat label={t("board.todayTotal")} value={data.todayTotal} tone="gray" />
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span className={"inline-block h-2 w-2 rounded-full " + (online ? "animate-pulse bg-emerald-500" : "bg-amber-500")} />
        <span className="text-gray-500 dark:text-slate-400">{online ? t("board.live") : t("board.offline")}</span>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-300">
          {error}
        </div>
      )}

      {rows.length === 0 ? (
        <p className={CARD + " text-sm text-gray-600 dark:text-slate-300"}>{t("board.empty")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ p, elapsed, limit, overdue }) => (
            <div
              key={p.id}
              className={
                CARD + " flex flex-col gap-2 " + (overdue ? "!border-rose-400 !bg-rose-50 dark:!bg-rose-950/30" : "")
              }
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-slate-100">{p.studentName}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {p.className} - {p.username}
                  </p>
                </div>
                {overdue && (
                  <span className="rounded-full bg-rose-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                    {t("board.overLimit")}
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300">{p.destination}</p>
              <p
                suppressHydrationWarning
                className={"text-3xl font-extrabold tabular-nums " + (overdue ? "text-rose-600" : "text-gray-900 dark:text-slate-100")}
              >
                {formatClock(elapsed)}
              </p>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-slate-800">
                <div
                  className={"h-full rounded-full " + (overdue ? "bg-rose-500" : elapsed > limit * 0.75 ? "bg-amber-500" : "bg-emerald-500")}
                  style={{ width: `${Math.min(100, (elapsed / limit) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                {t("board.leftAt", { time: formatSchoolTime(p.issuedAt) })} - {t("board.limit", { minutes: p.maxMinutes })}
              </p>
              <button
                type="button"
                disabled={endingId === p.id}
                onClick={() => end(p)}
                className="mt-1 self-start rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {endingId === p.id ? t("board.ending") : t("board.end")}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "blue" | "rose" | "gray" }) {
  const color =
    tone === "blue" ? "text-blue-600 dark:text-blue-400" : tone === "rose" ? "text-rose-600" : "text-gray-700 dark:text-slate-200";
  return (
    <div className={CARD + " text-center"}>
      <p className={"text-3xl font-extrabold tabular-nums " + color}>{value}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-slate-400">{label}</p>
    </div>
  );
}
