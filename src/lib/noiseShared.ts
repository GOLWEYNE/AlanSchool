// Client-safe types and helpers for the classroom noise monitor (no server imports).

export const DEFAULT_LIMIT_DB = 65;
export const DEFAULT_YELLOW_MARGIN = 10;
export const MIN_LIMIT_DB = 40;
export const MAX_LIMIT_DB = 110;
export const MIN_YELLOW_MARGIN = 3;
export const MAX_YELLOW_MARGIN = 25;

// A board reports every REPORT_EVERY_SECONDS seconds.
export const REPORT_EVERY_SECONDS = 10;
// A device that has not reported for this long loses its claim on the class.
export const DEVICE_TIMEOUT_MS = 40_000;
// A class counts as "live" while its newest minute is at most this old.
export const LIVE_WINDOW_MS = 3 * 60_000;
// The day strip is drawn between these school hours in cells of CELL_MINUTES.
export const STRIP_START_HOUR = 7;
export const STRIP_END_HOUR = 17;
export const CELL_MINUTES = 30;

export type NoiseLevel = "green" | "yellow" | "red";

export type NoiseSettings = { limitDb: number; yellowMargin: number };

export const levelFor = (db: number, s: NoiseSettings): NoiseLevel =>
  db > s.limitDb ? "red" : db > s.limitDb - s.yellowMargin ? "yellow" : "green";

export type NoiseClassOption = { id: number; name: string };

// One cell of the day strip: share of measured seconds that were over the limit
// (null = nothing measured in that half hour).
export type StripCell = { startMin: number; overShare: number | null };

export type NoiseClassRow = {
  classId: number;
  className: string;
  measuredSeconds: number;
  overSeconds: number;
  yellowSeconds: number;
  avgDb: number | null;
  maxDb: number | null;
  // Average loudness of the newest minute (what the room sounds like right now).
  lastAvgDb: number | null;
  lastMinuteIso: string | null;
  live: boolean;
  strip: StripCell[];
};

export type NoiseTodayPayload = {
  date: string; // YYYY-MM-DD on the school calendar
  settings: NoiseSettings;
  rows: NoiseClassRow[];
  serverNow: string;
};

export type NoiseReport = {
  classId: number;
  seconds: number;
  avgDb: number;
  maxDb: number;
  overSeconds: number;
  yellowSeconds: number;
};

export type NoiseReportResponse = { ok: boolean; error?: string; settings?: NoiseSettings };

export const isValidDeviceId = (v: unknown): v is string =>
  typeof v === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(v);

export const isValidYmd = (v: string | undefined | null): v is string =>
  !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + "T00:00:00Z"));

export const formatDuration = (seconds: number): string => {
  const m = Math.round(seconds / 60);
  if (m < 1) return `${Math.round(seconds)}s`;
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
};
