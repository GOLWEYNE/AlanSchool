"use client";

import { useEffect, useRef } from "react";

// Polling that lets the database sleep.
//
// The app is on Neon (serverless Postgres), billed per hour the database is
// awake. Plain setInterval polling from every open tab — including hidden tabs
// and classroom boards left signed in all day — kept it awake 24/7. This hook
// only polls while someone could actually see the result:
//   - the tab is visible, and
//   - the user touched the page (mouse, keys, touch, scroll) within `idleMs`.
// When the user comes back (tab shown again, or first input after being idle)
// it refreshes right away and resumes the normal rhythm.

const ACTIVITY_EVENTS = ["pointerdown", "pointermove", "keydown", "touchstart", "wheel", "scroll"] as const;

type Options = {
  /** Time between polls while the page is in use. */
  intervalMs: number;
  /** Stop polling after this long without user input. Default 10 minutes. */
  idleMs?: number;
  /** Return true to keep polling even when idle (e.g. while watching a live stream). */
  keepAlive?: () => boolean;
  /** Skip the immediate first call (when the page already has fresh data). */
  skipInitial?: boolean;
};

export function useSmartPolling(fn: () => void | Promise<void>, options: Options) {
  const { intervalMs, idleMs = 10 * 60_000, skipInitial = false } = options;
  const fnRef = useRef(fn);
  const keepAliveRef = useRef(options.keepAlive);
  fnRef.current = fn;
  keepAliveRef.current = options.keepAlive;

  useEffect(() => {
    let lastActivity = Date.now();
    let lastRun = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const visible = () => typeof document === "undefined" || document.visibilityState !== "hidden";
    const active = () => Date.now() - lastActivity < idleMs || Boolean(keepAliveRef.current?.());
    const canPoll = () => visible() && active();

    const run = () => {
      lastRun = Date.now();
      try {
        void Promise.resolve(fnRef.current()).catch(() => undefined);
      } catch {
        // A failed poll is not worth surfacing; the next one reconciles.
      }
    };

    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      if (stopped || !canPoll()) return; // paused: resumes on visibility/activity
      const wait = Math.max(0, lastRun + intervalMs - Date.now());
      timer = setTimeout(() => {
        timer = null;
        if (stopped) return;
        if (canPoll()) run();
        schedule();
      }, wait);
    };

    // Coming back after a pause: refresh now if the data is stale, then resume.
    const resume = () => {
      if (stopped || !canPoll()) return;
      if (timer === null && Date.now() - lastRun >= intervalMs) run();
      schedule();
    };

    const onActivity = () => {
      const wasIdle = !active();
      lastActivity = Date.now();
      if (wasIdle || timer === null) resume();
    };

    const onVisibility = () => {
      if (visible()) {
        lastActivity = Date.now();
        resume();
      } else if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    if (skipInitial) lastRun = Date.now();
    else run();
    schedule();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onVisibility);
    for (const evt of ACTIVITY_EVENTS) window.addEventListener(evt, onActivity, { passive: true });

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onVisibility);
      for (const evt of ACTIVITY_EVENTS) window.removeEventListener(evt, onActivity);
    };
  }, [intervalMs, idleMs, skipInitial]);
}
