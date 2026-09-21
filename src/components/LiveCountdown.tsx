"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

// Ticks every second on the client so the "starts in / ends in" badge on
// TodaysTimetableStrip stays live without re-fetching from the server.
const LiveCountdown = ({
  target,
  kind,
}: {
  target: string; // ISO timestamp
  kind: "ends" | "starts";
}) => {
  const t = useTranslations("Widgets.countdown");
  const targetTime = new Date(target).getTime();
  const [remaining, setRemaining] = useState(() => targetTime - Date.now());

  useEffect(() => {
    setRemaining(targetTime - Date.now());
    const id = setInterval(() => {
      setRemaining(targetTime - Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, [targetTime]);

  const formatDuration = (ms: number) => {
    if (ms <= 0) return t("duration.zero");
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) return t("duration.hm", { h: hours, m: minutes });
    if (minutes > 0) return t("duration.ms", { m: minutes, s: seconds });
    return t("duration.s", { s: seconds });
  };

  return (
    <span className="text-xs font-semibold whitespace-nowrap">
      {t(kind, { time: formatDuration(remaining) })}
    </span>
  );
};

export default LiveCountdown;
