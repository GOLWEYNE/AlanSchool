"use client";

import { useEffect, useState } from "react";

// A ticking "server now" in epoch ms. The browser clock can be wrong (school
// tablets often are), and a hall pass timer that is off by minutes would flag the
// wrong students as overdue - so every tick is corrected by the offset between the
// server's clock (sent with the data) and this device's clock.
export function useServerNow(serverNowIso: string, tickMs = 1000): number {
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setOffset(Date.parse(serverNowIso) - Date.now());
  }, [serverNowIso]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(id);
  }, [tickMs]);

  return now + offset;
}

// 7:05 or 1:02:09 - minutes:seconds, with hours only when needed.
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}
