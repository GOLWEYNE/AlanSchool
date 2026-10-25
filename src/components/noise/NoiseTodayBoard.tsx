"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { saveNoiseSettings } from "@/lib/noiseActions";
import {
  formatDuration,
  levelFor,
  MAX_LIMIT_DB,
  MAX_YELLOW_MARGIN,
  MIN_LIMIT_DB,
  MIN_YELLOW_MARGIN,
  type NoiseClassRow,
  type NoiseLevel,
  type NoiseTodayPayload,
  type StripCell,
} from "@/lib/noiseShared";

const POLL_MS = 10_000;

const CARD =
  "rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900";

const LEVEL_DOT: Record<NoiseLevel, string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-400",
  red: "bg-rose-500",
};

const cellColor = (share: number | null) => {
  if (share === null) return "bg-gray-200 dark:bg-slate-700";
  if (share < 0.05) return "bg-emerald-400";
  if (share < 0.25) return "bg-amber-400";
  return "bg-rose-500";
};

const hhmm = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

function Stat({ label, value, tone }: { label: string; value: string | number; tone: "blue" | "rose" | "gray" }) {
  const tones = {
    blue: "text-blue-700 dark:text-blue-300",
    rose: "text-rose-600 dark:text-rose-300",
    gray: "text-gray-900 dark:text-slate-100",
  } as const;
  return (
    <div className={CARD}>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">{label}</p>
      <p className={"mt-1 truncate text-2xl font-bold " + tones[tone]}>{value}</p>
    </div>
  );
}

function Strip({ cells }: { cells: StripCell[] }) {
  return (
    <div className="flex gap-0.5">
      {cells.map((c) => (
        <div
          key={c.startMin}
          title={`${hhmm(c.startMin)} - ${c.overShare === null ? "-" : Math.round(c.overShare * 100) + "%"}`}
          className={"h-5 flex-1 rounded-sm " + cellColor(c.overShare)}
        />
      ))}
    </div>
  );
}

// Admin dashboard: which classes are noisy today. There are no websockets on Vercel,
// so it polls a small JSON endpoint every few seconds while the tab is visible.
export default function NoiseTodayBoard({ initial }: { initial: NoiseTodayPayload }) {
  const t = useTranslations("Noise");
  const [data, setData] = useState<NoiseTodayPayload>(initial);
  const [date, setDate] = useState(initial.date);
  const [online, setOnline] = useState(true);
  const dateRef = useRef(date);
  dateRef.current = date;

  const [limit, setLimit] = useState(String(initial.settings.limitDb));
  const [margin, setMargin] = useState(String(initial.settings.yellowMargin));
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, startSaving] = useTransition();

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/noise/today?date=" + encodeURIComponent(dateRef.current), { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setData((await res.json()) as NoiseTodayPayload);
      setOnline(true);
    } catch {
      setOnline(false);
    }
  }, []);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const loop = async () => {
      if (document.visibilityState === "visible") await refresh();
      if (!stopped) timer = setTimeout(loop, POLL_MS);
    };
    timer = setTimeout(loop, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        if (timer) clearTimeout(timer);
        void loop();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const changeDate = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    setDate(value);
    dateRef.current = value;
    void refresh();
  };

  const save = () => {
    setMessage(null);
    startSaving(async () => {
      const res = await saveNoiseSettings(Number(limit), Number(margin));
      if (res.ok) {
        setMessage({ ok: true, text: t("admin.saved") });
        await refresh();
      } else {
        const key = res.error && ["forbidden", "limit", "margin", "unavailable"].includes(res.error) ? res.error : "generic";
        setMessage({ ok: false, text: t(`admin.errors.${key}`) });
      }
    });
  };

  const monitored = data.rows.filter((r) => r.measuredSeconds > 0);
  const liveRows = data.rows.filter((r) => r.live);
  const overNow = liveRows.filter((r) => r.lastAvgDb !== null && levelFor(r.lastAvgDb, data.settings) === "red");
  const noisiest = monitored[0] && monitored[0].overSeconds > 0 ? monitored[0] : null;
  const maxOver = Math.max(1, ...data.rows.map((r) => r.overSeconds));

  const statusOf = (r: NoiseClassRow) =>
    r.live ? t("admin.statusLive") : r.measuredSeconds > 0 ? t("admin.statusEarlier") : t("admin.statusNone");

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label={t("admin.classesMonitored")} value={`${liveRows.length} / ${data.rows.length}`} tone="blue" />
        <Stat label={t("admin.overNow")} value={overNow.length} tone={overNow.length > 0 ? "rose" : "gray"} />
        <Stat label={t("admin.noisiestClass")} value={noisiest ? noisiest.className : t("admin.none")} tone="gray" />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className={"inline-block h-2 w-2 rounded-full " + (online ? "animate-pulse bg-emerald-500" : "bg-amber-500")} />
        <span className="text-gray-500 dark:text-slate-400">{online ? t("admin.live") : t("admin.offline")}</span>
        <label className="ml-auto flex items-center gap-2 text-sm text-gray-600 dark:text-slate-300">
          {t("admin.date")}
          <input
            type="date"
            value={date}
            onChange={(e) => changeDate(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
      </div>

      {monitored.length === 0 ? (
        <p className={CARD + " text-sm text-gray-600 dark:text-slate-300"}>{t("admin.empty")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {data.rows.map((r, i) => {
            const level = r.live && r.lastAvgDb !== null ? levelFor(r.lastAvgDb, data.settings) : null;
            const overShare = r.measuredSeconds > 0 ? r.overSeconds / r.measuredSeconds : 0;
            return (
              <div key={r.classId} className={CARD + (r.measuredSeconds === 0 ? " opacity-60" : "")}>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="flex min-w-[8rem] items-center gap-3">
                    <span className="w-6 text-sm font-bold text-gray-400">{r.measuredSeconds > 0 ? i + 1 : ""}</span>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-slate-100">{r.className}</p>
                      <p className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400">
                        <span className={"inline-block h-2 w-2 rounded-full " + (level ? LEVEL_DOT[level] : "bg-gray-300")} />
                        {statusOf(r)}
                        {level && r.lastAvgDb !== null ? ` - ${Math.round(r.lastAvgDb)} ${t("board.db")}` : ""}
                      </p>
                    </div>
                  </div>

                  {r.measuredSeconds > 0 && (
                    <>
                      <div className="flex gap-6 text-sm">
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-slate-400">{t("admin.avg")}</p>
                          <p className="font-semibold">{Math.round(r.avgDb ?? 0)} {t("board.db")}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-slate-400">{t("admin.peak")}</p>
                          <p className="font-semibold">{Math.round(r.maxDb ?? 0)} {t("board.db")}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-slate-400">{t("admin.measured")}</p>
                          <p className="font-semibold">{formatDuration(r.measuredSeconds)}</p>
                        </div>
                      </div>

                      <div className="min-w-[10rem] flex-1">
                        <p className="mb-1 flex justify-between text-xs text-gray-500 dark:text-slate-400">
                          <span>{t("admin.timeOver")}</span>
                          <span className="font-semibold text-gray-800 dark:text-slate-200">
                            {formatDuration(r.overSeconds)} ({Math.round(overShare * 100)}%)
                          </span>
                        </p>
                        <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-slate-700">
                          <div
                            className="h-full rounded-full bg-rose-500"
                            style={{ width: `${Math.round((r.overSeconds / maxOver) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {r.measuredSeconds > 0 && (
                  <div className="mt-3">
                    <Strip cells={r.strip} />
                  </div>
                )}
              </div>
            );
          })}
          <p className="text-xs text-gray-500 dark:text-slate-400">{t("admin.timelineHint")}</p>
        </div>
      )}

      <div className={CARD}>
        <h2 className="font-semibold text-gray-900 dark:text-slate-100">{t("admin.limitTitle")}</h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{t("admin.limitHint")}</p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-gray-600 dark:text-slate-300">
            {t("admin.limitLabel")}
            <input
              type="number"
              min={MIN_LIMIT_DB}
              max={MAX_LIMIT_DB}
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              className="w-28 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-600 dark:text-slate-300">
            {t("admin.marginLabel")}
            <input
              type="number"
              min={MIN_YELLOW_MARGIN}
              max={MAX_YELLOW_MARGIN}
              value={margin}
              onChange={(e) => setMargin(e.target.value)}
              className="w-28 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {t("admin.save")}
          </button>
          {message && (
            <span
              role="status"
              className={"text-sm " + (message.ok ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}
            >
              {message.text}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
