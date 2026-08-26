"use client";

import { useEffect, useState } from "react";

const formatDuration = (ms: number) => {
  if (ms <= 0) return "0s";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
};

// Ticks every second on the client so the "starts in / ends in" badge on
// TodaysTimetableStrip stays live without re-fetching from the server.
const LiveCountdown = ({
  target,
  prefix,
}: {
  target: string; // ISO timestamp
  prefix: string;
}) => {
  const targetTime = new Date(target).getTime();
  const [remaining, setRemaining] = useState(() => targetTime - Date.now());

  useEffect(() => {
    setRemaining(targetTime - Date.now());
    const id = setInterval(() => {
      setRemaining(targetTime - Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, [targetTime]);

  return (
    <span className="text-xs font-semibold whitespace-nowrap">
      {prefix} {formatDuration(remaining)}
    </span>
  );
};

export default LiveCountdown;
