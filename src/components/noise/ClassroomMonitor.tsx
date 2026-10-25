"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  levelFor,
  REPORT_EVERY_SECONDS,
  type NoiseClassOption,
  type NoiseLevel,
  type NoiseReportResponse,
  type NoiseSettings,
} from "@/lib/noiseShared";

const OVER_SECONDS_BEFORE_CHIME = 4;
const CHIME_COOLDOWN_MS = 20_000;
const DEFAULT_OFFSET_DB = 100; // dBFS -> rough dB SPL until the board is calibrated
const MAX_PENDING_SECONDS = REPORT_EVERY_SECONDS * 3;

const KEY_CLASS = "noise.classId";
const KEY_OFFSET = "noise.offsetDb";
const KEY_SOUND = "noise.sound";
const KEY_DEVICE = "noise.deviceId";

// A random id that stays the same on this browser, so the server can tell devices apart.
const makeId = () => {
  const c = typeof crypto !== "undefined" ? crypto : undefined;
  if (c?.randomUUID) return c.randomUUID().replace(/-/g, "");
  return Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 10)).join("");
};

const readStore = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};
const writeStore = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode: just don't remember */
  }
};

type WakeLockSentinelLike = { release: () => Promise<void> };
type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
};

type Batch = { seconds: number; sumDb: number; maxDb: number; over: number; yellow: number };
const emptyBatch = (): Batch => ({ seconds: 0, sumDb: 0, maxDb: 0, over: 0, yellow: 0 });

const SCREEN: Record<NoiseLevel, { bg: string; text: string; emoji: string }> = {
  green: { bg: "bg-emerald-600", text: "text-white", emoji: "\u{1F60A}" },
  yellow: { bg: "bg-amber-400", text: "text-gray-900", emoji: "\u{1F92B}" },
  red: { bg: "bg-red-600", text: "text-white", emoji: "\u{1F620}" },
};

// The classroom board. Listens through the microphone with the Web Audio API, turns
// the sound into a loudness number once per second, and shows a full-screen face:
// green PERFECT, yellow TSHSHSHSH, red TOO LOUD. Every few seconds it sends only the
// numbers (average / peak / seconds over the limit) to the school. No audio is
// recorded, stored or uploaded.
export default function ClassroomMonitor({
  classes,
  initialSettings,
}: {
  classes: NoiseClassOption[];
  initialSettings: NoiseSettings;
}) {
  const t = useTranslations("Noise");

  const [classId, setClassId] = useState<number | null>(classes[0]?.id ?? null);
  const [offset, setOffset] = useState(DEFAULT_OFFSET_DB);
  const [soundOn, setSoundOn] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [db, setDb] = useState(0);
  const [settings, setSettings] = useState<NoiseSettings>(initialSettings);
  const [online, setOnline] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [awake, setAwake] = useState(false);
  const [busy, setBusy] = useState(false); // another device already listens for this class

  // Everything the audio loop needs lives in refs so the interval never goes stale.
  const settingsRef = useRef(settings);
  const offsetRef = useRef(offset);
  const soundRef = useRef(soundOn);
  const classRef = useRef(classId);
  settingsRef.current = settings;
  offsetRef.current = offset;
  soundRef.current = soundOn;
  classRef.current = classId;

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wakeRef = useRef<WakeLockSentinelLike | null>(null);
  const batchRef = useRef<Batch>(emptyBatch());
  const sendingRef = useRef(false);
  const overRunRef = useRef(0);
  const lastChimeRef = useRef(0);
  const smoothRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const deviceIdRef = useRef<string>("");
  const stopRef = useRef<((reason?: "taken") => Promise<void>) | null>(null);

  // Restore what this board remembered last time.
  useEffect(() => {
    const savedClass = Number(readStore(KEY_CLASS));
    if (classes.some((c) => c.id === savedClass)) setClassId(savedClass);
    const savedOffset = Number(readStore(KEY_OFFSET));
    if (readStore(KEY_OFFSET) !== null && Number.isFinite(savedOffset)) setOffset(savedOffset);
    const savedSound = readStore(KEY_SOUND);
    if (savedSound !== null) setSoundOn(savedSound === "1");
  }, [classes]);

  const chime = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const tone = (freq: number, start: number, length: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + length);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + length + 0.05);
    };
    tone(660, 0, 0.3);
    tone(880, 0.35, 0.4);
  }, []);

  const flush = useCallback(async () => {
    const b = batchRef.current;
    const id = classRef.current;
    if (b.seconds === 0 || id === null || sendingRef.current) return;
    sendingRef.current = true;
    const payload = {
      classId: id,
      seconds: b.seconds,
      deviceId: deviceIdRef.current,
      avgDb: Math.round((b.sumDb / b.seconds) * 10) / 10,
      maxDb: Math.round(b.maxDb * 10) / 10,
      overSeconds: b.over,
      yellowSeconds: b.yellow,
    };
    try {
      const res = await fetch("/api/noise/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.status === 409) {
        // Another device took this class over: stop quietly instead of double counting.
        if (runningRef.current) void stopRef.current?.("taken");
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as NoiseReportResponse;
      // Only what was sent is cleared; seconds measured while the request ran stay queued.
      const cur = batchRef.current;
      batchRef.current = {
        seconds: cur.seconds - b.seconds,
        sumDb: cur.sumDb - b.sumDb,
        maxDb: cur.seconds - b.seconds > 0 ? cur.maxDb : 0,
        over: cur.over - b.over,
        yellow: cur.yellow - b.yellow,
      };
      if (body.settings) setSettings(body.settings);
      setOnline(true);
    } catch {
      setOnline(false);
      // Keep the numbers for the next try, but never let the queue grow without bound.
      if (batchRef.current.seconds > MAX_PENDING_SECONDS) batchRef.current = emptyBatch();
    } finally {
      sendingRef.current = false;
    }
  }, []);

  const releaseWake = useCallback(() => {
    const lock = wakeRef.current;
    wakeRef.current = null;
    setAwake(false);
    if (lock) void lock.release().catch(() => undefined);
  }, []);

  const requestWake = useCallback(async () => {
    try {
      const nav = navigator as WakeLockNavigator;
      if (!nav.wakeLock || wakeRef.current) return;
      wakeRef.current = await nav.wakeLock.request("screen");
      setAwake(true);
    } catch {
      /* not supported or refused: the board still works */
    }
  }, []);

  const stop = useCallback(async (reason?: "taken") => {
    runningRef.current = false;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    const ctx = ctxRef.current;
    ctxRef.current = null;
    if (ctx) void ctx.close().catch(() => undefined);
    releaseWake();
    setRunning(false);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    if (reason === "taken") {
      setError(t("board.takenOver"));
    } else {
      await flush();
      const id = classRef.current;
      if (id !== null) {
        // Let go of the class so another device can use it straight away.
        void fetch("/api/noise/claim", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ classId: id, deviceId: deviceIdRef.current }),
        }).catch(() => undefined);
      }
    }
    batchRef.current = emptyBatch();
    smoothRef.current = null;
    overRunRef.current = 0;
  }, [flush, releaseWake, t]);
  stopRef.current = stop;

  const start = useCallback(async (takeover = false) => {
    setError(null);
    setBusy(false);
    if (classRef.current === null) return;
    if (!deviceIdRef.current) {
      let id = readStore(KEY_DEVICE);
      if (!id || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
        id = makeId();
        writeStore(KEY_DEVICE, id);
      }
      deviceIdRef.current = id;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(t("board.micUnsupported"));
      return;
    }

    let stream: MediaStream;
    try {
      // Turn off the browser's own "voice call" processing - it would flatten the
      // very loudness differences we are trying to measure.
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch (e) {
      const name = (e as { name?: string } | null)?.name;
      setError(name === "NotFoundError" ? t("board.micMissing") : t("board.micDenied"));
      return;
    }

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) {
      stream.getTracks().forEach((track) => track.stop());
      setError(t("board.micUnsupported"));
      return;
    }

    // Only one device may listen for a class at a time (otherwise the same room is counted twice).
    try {
      const res = await fetch("/api/noise/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId: classRef.current, deviceId: deviceIdRef.current, takeover }),
      });
      if (res.status === 409) {
        stream.getTracks().forEach((track) => track.stop());
        setBusy(true);
        setError(t("board.inUse"));
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      setError(t("board.sendFailed"));
      return;
    }

    const ctx = new AudioCtx();
    await ctx.resume().catch(() => undefined);
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 4096;
    source.connect(analyser);
    const samples = new Float32Array(analyser.fftSize);

    streamRef.current = stream;
    ctxRef.current = ctx;
    batchRef.current = emptyBatch();
    overRunRef.current = 0;
    lastChimeRef.current = 0;
    smoothRef.current = null;

    // One loudness figure per second: the mean power of all the windows read in it.
    let powerSum = 0;
    let powerCount = 0;
    let tick = 0;

    timerRef.current = setInterval(() => {
      analyser.getFloatTimeDomainData(samples);
      let sq = 0;
      for (let i = 0; i < samples.length; i++) sq += samples[i] * samples[i];
      powerSum += sq / samples.length;
      powerCount += 1;
      tick += 1;
      if (tick < 10) return;
      tick = 0;

      const meanPower = Math.max(powerSum / Math.max(1, powerCount), 1e-12);
      powerSum = 0;
      powerCount = 0;
      const level = Math.min(140, Math.max(0, 10 * Math.log10(meanPower) + offsetRef.current));

      // Smooth the display a little so the screen does not flicker at the edges.
      const prev = smoothRef.current;
      const shown = prev === null ? level : prev * 0.4 + level * 0.6;
      smoothRef.current = shown;
      setDb(shown);

      const state = levelFor(level, settingsRef.current);
      const b = batchRef.current;
      b.seconds += 1;
      b.sumDb += level;
      b.maxDb = Math.max(b.maxDb, level);
      if (state === "red") b.over += 1;
      else if (state === "yellow") b.yellow += 1;

      overRunRef.current = state === "red" ? overRunRef.current + 1 : 0;
      if (
        soundRef.current &&
        overRunRef.current >= OVER_SECONDS_BEFORE_CHIME &&
        Date.now() - lastChimeRef.current >= CHIME_COOLDOWN_MS
      ) {
        lastChimeRef.current = Date.now();
        chime();
      }

      if (b.seconds >= REPORT_EVERY_SECONDS) void flush();
    }, 100);

    runningRef.current = true;
    setRunning(true);
    void requestWake();
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      /* the overlay already covers the page; fullscreen is a bonus */
    }
  }, [chime, flush, requestWake, t]);

  // Stop listening if the page is closed or navigated away from.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      const ctx = ctxRef.current;
      if (ctx) void ctx.close().catch(() => undefined);
      const lock = wakeRef.current;
      if (lock) void lock.release().catch(() => undefined);
    };
  }, []);

  // The screen wake lock is dropped when the tab is hidden; take it again on return.
  useEffect(() => {
    if (!running) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") void requestWake();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [running, requestWake]);

  const changeClass = (id: number) => {
    setClassId(id);
    writeStore(KEY_CLASS, String(id));
  };
  const changeOffset = (value: number) => {
    if (!Number.isFinite(value)) return;
    const clamped = Math.min(150, Math.max(0, Math.round(value)));
    setOffset(clamped);
    writeStore(KEY_OFFSET, String(clamped));
  };
  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    writeStore(KEY_SOUND, next ? "1" : "0");
    if (next) chime();
  };

  const className = classes.find((c) => c.id === classId)?.name ?? "";

  if (classes.length === 0) {
    return (
      <p className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        {t("board.noClasses")}
      </p>
    );
  }

  const level = levelFor(db, settings);
  const look = SCREEN[level];
  const words = {
    green: { main: t("board.perfect"), sub: t("board.perfectSub") },
    yellow: { main: t("board.shush"), sub: t("board.shushSub") },
    red: { main: t("board.loud"), sub: t("board.loudSub") },
  }[level];

  return (
    <>
      <div className="flex max-w-xl flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700 dark:text-slate-200">
          {t("board.chooseClass")}
          <select
            value={classId ?? ""}
            onChange={(e) => changeClass(Number(e.target.value))}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-base dark:border-slate-700 dark:bg-slate-900"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => void start(false)}
          disabled={running || classId === null}
          className="rounded-xl bg-emerald-600 px-6 py-4 text-lg font-bold text-white shadow hover:bg-emerald-700 disabled:opacity-60"
        >
          {t("board.start")}
        </button>

        {error && (
          <p role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-300">
            {error}
          </p>
        )}
        {busy && (
          <button
            type="button"
            onClick={() => void start(true)}
            className="rounded-xl border border-amber-400 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 hover:bg-amber-100"
          >
            {t("board.takeOver")}
          </button>
        )}
        <p className="text-xs text-gray-500 dark:text-slate-400">{t("board.startHint")}</p>
      </div>

      {running && (
        <div
          className={"fixed inset-0 z-[200] flex select-none flex-col items-center justify-center " + look.bg + " " + look.text}
          aria-live="polite"
        >
          <div className="absolute left-0 right-0 top-0 flex items-center gap-3 p-4 text-sm font-semibold opacity-90">
            <span className="rounded-full bg-black/20 px-3 py-1">{className}</span>
            <span className="flex items-center gap-1.5">
              <span className={"inline-block h-2.5 w-2.5 rounded-full " + (online ? "bg-white" : "bg-black/60")} />
              {online ? t("board.sending") : t("board.sendFailed")}
            </span>
            {awake && <span className="hidden sm:inline">{t("board.keepAwake")}</span>}
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={() => setShowSettings((v) => !v)}
                className="rounded-lg bg-black/20 px-3 py-1.5 hover:bg-black/30"
              >
                {t("board.settings")}
              </button>
              <button
                type="button"
                onClick={() => void stop()}
                className="rounded-lg bg-black/30 px-3 py-1.5 hover:bg-black/40"
              >
                {t("board.stop")}
              </button>
            </div>
          </div>

          <div className="text-[min(34vh,34vw)] leading-none" role="img" aria-label={words.main}>
            {look.emoji}
          </div>
          <h2 className="mt-4 px-4 text-center text-[min(14vh,12vw)] font-black leading-none tracking-tight">{words.main}</h2>
          <p className="mt-3 px-4 text-center text-[min(8vh,7vw)] font-extrabold leading-none">{words.sub}</p>

          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-6 bg-black/15 p-3 text-lg font-bold">
            <span>
              {Math.round(db)} {t("board.db")}
            </span>
            <span className="opacity-80">
              {t("board.limit")} {settings.limitDb} {t("board.db")}
            </span>
          </div>

          {showSettings && (
            <div className="absolute right-4 top-16 w-80 max-w-[90vw] rounded-2xl bg-white p-4 text-gray-900 shadow-2xl">
              <h3 className="font-bold">{t("board.calibration")}</h3>
              <p className="mt-1 text-xs text-gray-600">{t("board.calibrationHint")}</p>
              <label className="mt-3 flex items-center justify-between gap-2 text-sm">
                {t("board.offset")}
                <span className="flex items-center gap-1">
                  <button type="button" className="h-8 w-8 rounded-lg bg-gray-200 font-bold" onClick={() => changeOffset(offset - 1)}>
                    -
                  </button>
                  <input
                    type="number"
                    value={offset}
                    onChange={(e) => changeOffset(Number(e.target.value))}
                    className="w-16 rounded-lg border border-gray-300 px-2 py-1 text-center"
                  />
                  <button type="button" className="h-8 w-8 rounded-lg bg-gray-200 font-bold" onClick={() => changeOffset(offset + 1)}>
                    +
                  </button>
                </span>
              </label>
              <button
                type="button"
                onClick={toggleSound}
                className="mt-3 flex w-full items-center justify-between rounded-lg bg-gray-100 px-3 py-2 text-sm"
              >
                {t("board.sound")}
                <span className="font-bold">{soundOn ? t("board.soundOn") : t("board.soundOff")}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="mt-3 w-full rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white"
              >
                {t("board.exit")}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
