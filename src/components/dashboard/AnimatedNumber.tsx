"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Counts up to `value` once the number scrolls into view.
 *
 * Server markup renders the final number inside the aria-label (screen readers
 * and no-JS get the real value) while the visible text starts at 0, so there is
 * no "final number -> 0 -> final number" flicker on hydration.
 * Honors prefers-reduced-motion by showing the final value immediately.
 */
export default function AnimatedNumber({
  value,
  duration = 1100,
  className,
}: {
  value: number;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || value === 0) {
      setDisplay(value);
      return;
    }

    let raf = 0;
    let started = false;

    const run = () => {
      if (started) return;
      started = true;
      const t0 = performance.now();
      const tick = (now: number) => {
        const p = Math.min((now - t0) / duration, 1);
        // easeOutExpo: fast start, long soft landing
        const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
        setDisplay(Math.round(value * eased));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    if (typeof IntersectionObserver === "undefined") {
      run();
      return () => cancelAnimationFrame(raf);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          run();
          io.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, duration]);

  return (
    <span
      ref={ref}
      className={className}
      aria-label={value.toLocaleString("en-US")}
      style={{ fontVariantNumeric: "tabular-nums" }}
    >
      {display.toLocaleString("en-US")}
    </span>
  );
}
