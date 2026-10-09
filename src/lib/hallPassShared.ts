// Pure (no database, no server-only imports) constants, types and helpers for the hall
// pass. Client components import from here; importing "@/lib/hallPass" in the browser
// would drag the Prisma client into the bundle.
import { schoolDayRange, toWallClock } from "@/lib/schoolTime";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
export const MAX_MINUTES_LIMIT = 120;
export const HISTORY_PAGE_SIZE = 25;
export const HISTORY_EXPORT_LIMIT = 5000;

// Advisory-lock namespaces used by requestPass() to serialise concurrent requests.
export const LOCK_NS_GROUP = 7101;
export const LOCK_NS_DESTINATION = 7102;

export type PassStatusKey = "ACTIVE" | "RETURNED" | "AUTO_CLOSED";

// ---------------------------------------------------------------------------
// Types sent to the client
// ---------------------------------------------------------------------------
export type ActivePassDTO = {
  id: number;
  studentId: string;
  studentName: string;
  username: string;
  className: string;
  destination: string;
  issuedAt: string; // ISO
  maxMinutes: number;
};

export type ActivePassesPayload = {
  passes: ActivePassDTO[];
  todayTotal: number;
  serverNow: string; // ISO - lets the browser correct for a wrong device clock
};

export type DestinationDTO = {
  id: number;
  name: string;
  maxMinutes: number;
  maxConcurrent: number | null;
  active: boolean;
  sortOrder: number;
  outNow?: number;
};

export type HistoryRow = {
  id: number;
  studentName: string;
  username: string;
  gradeLevel: number;
  className: string;
  destination: string;
  maxMinutes: number;
  status: PassStatusKey;
  issuedAt: string; // ISO
  returnedAt: string | null; // ISO
};

export type HistoryFilters = {
  q?: string;
  from?: string; // YYYY-MM-DD (school date)
  to?: string; // YYYY-MM-DD (school date)
  destinationId?: number;
  gradeLevel?: number;
  classId?: number;
  status?: PassStatusKey;
};

export type PassViewer = { role: "admin" | "teacher"; userId: string };

// ---------------------------------------------------------------------------
// Time helpers (all school-facing times use the school's UTC+5 wall clock)
// ---------------------------------------------------------------------------
const pad = (n: number) => String(n).padStart(2, "0");

export const formatSchoolDate = (iso: string | Date): string => {
  const w = toWallClock(new Date(iso));
  return `${w.year}-${pad(w.month)}-${pad(w.day)}`;
};

export const formatSchoolTime = (iso: string | Date): string => {
  const w = toWallClock(new Date(iso));
  return `${pad(w.hour)}:${pad(w.minute)}`;
};

// The instant today's school day began (00:00 school time). NB: schoolDayRange() with no
// date argument does NOT return midnight - it keeps the current time of day - so always
// pass the school date explicitly.
export const schoolDayStart = (now: Date = new Date()): Date => schoolDayRange(formatSchoolDate(now), now)[0];

export const isValidYmd = (value: string | undefined | null): value is string =>
  !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + "T00:00:00Z"));

export type StudentPassState = {
  destinations: DestinationDTO[];
  active: { id: number; destination: string; issuedAt: string; maxMinutes: number } | null;
  today: { id: number; destination: string; issuedAt: string; returnedAt: string | null; status: PassStatusKey }[];
  serverNow: string;
};
