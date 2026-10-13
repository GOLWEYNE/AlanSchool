// Duty roster: pure helpers shared by server code, client components and tests.
// Keep this file free of server-only imports (prisma, clerk, ...).

export const DUTY_FLOORS = [1, 2, 3] as const;
export const DUTY_WEEKDAYS = [1, 2, 3, 4, 5] as const; // 1 = Monday ... 5 = Friday
export const DUTY_BLOCKS = ["1-2", "3-4"] as const;
export type DutyBlock = (typeof DUTY_BLOCKS)[number];

export const DUTY_TIME_SLOTS: ReadonlyArray<readonly [string, string]> = [
  ["08:55", "09:40"],
  ["09:40", "10:25"],
  ["10:25", "11:10"],
  ["11:10", "11:55"],
  ["11:55", "13:00"],
  ["13:00", "14:00"],
  ["14:00", "15:00"],
  ["15:00", "16:00"],
  ["16:00", "17:30"],
];

export const DEFAULT_DUTY_TIME_ZONE = "Asia/Almaty";
export const DEFAULT_LEAD_MINUTES = 10;

// A "start" reminder is still sent if the scheduler is late by up to this many
// minutes (GitHub Actions / cron-job.org can run several minutes behind).
export const START_GRACE_MINUTES = 10;

export type DutyKind = "lead" | "start";

export const WEEKDAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export type DutyMessageInput = {
  floor: number;
  block: string;
  startTime: string;
  endTime: string;
  kind: DutyKind | "test";
  leadMinutes?: number;
  coDuty?: string[];
};

/** "08:55" (or "8:55") -> minutes after midnight, or null when malformed. */
export function toMinutes(time: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Normalises "8:55" -> "08:55". Returns null when malformed. */
export function normalizeTime(time: string): string | null {
  const total = toMinutes(time);
  if (total === null) return null;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** "Duty: Floor 2, Block 3-4, 11:10–11:55" (+ lead/co-duty hints). */
export function buildDutyMessage(input: DutyMessageInput): { title: string; body: string } {
  const base = `Duty: Floor ${input.floor}, Block ${input.block}, ${input.startTime}–${input.endTime}`;
  const extras: string[] = [];
  if (input.kind === "lead") extras.push(`starts in ${input.leadMinutes ?? DEFAULT_LEAD_MINUTES} min`);
  if (input.kind === "start") extras.push("starts now");
  if (input.coDuty && input.coDuty.length) extras.push(`with ${input.coDuty.join(", ")}`);
  const body = extras.length ? `${base} (${extras.join("; ")})` : base;
  const title = input.kind === "test" ? "Test: duty reminder" : input.kind === "lead" ? "Duty soon" : "Duty now";
  return { title, body: input.kind === "test" ? `${body} – this is a test` : body };
}

export type SchoolNow = {
  /** "YYYY-MM-DD" in the school time zone. */
  date: string;
  /** 1 = Monday ... 7 = Sunday */
  weekday: number;
  /** minutes after local midnight */
  minutes: number;
};

/** Reads "now" on the school wall clock for an IANA zone such as "Asia/Almaty". */
export function schoolNow(now: Date, timeZone: string): SchoolNow {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekdayMap: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    weekday: weekdayMap[get("weekday")] ?? 0,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Which reminder (if any) is due for a duty starting at `startTime` right now.
 *  - "lead":  from (start - lead) until the start itself
 *  - "start": from the start until START_GRACE_MINUTES later
 * Windows are wide on purpose so a late scheduler run still delivers; the
 * unique log row guarantees each kind is sent at most once per day.
 */
export function dueKinds(
  nowMinutes: number,
  startTime: string,
  opts: { leadMinutes: number; notifyAtStart: boolean }
): DutyKind[] {
  const start = toMinutes(startTime);
  if (start === null) return [];
  const kinds: DutyKind[] = [];
  if (opts.leadMinutes > 0 && nowMinutes >= start - opts.leadMinutes && nowMinutes < start) {
    kinds.push("lead");
  }
  if (opts.notifyAtStart && nowMinutes >= start && nowMinutes < start + START_GRACE_MINUTES) {
    kinds.push("start");
  }
  return kinds;
}

// ---------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------

/** Rough identity key for spotting the same person spelled two ways: "Shakhanova L.I." / "Shakhanova L." */
export function dutyNameKey(name: string): string {
  const cleaned = name.trim().toLowerCase().replace(/\s+/g, " ");
  const [surname = "", first = ""] = cleaned.split(" ");
  return `${surname.slice(0, 6)}|${first.charAt(0)}`;
}

/** Splits "Isakhova U." into surname + first initial for matching against real accounts. */
export function splitDutyName(name: string): { surname: string; initial: string } {
  const cleaned = name.trim().replace(/\s+/g, " ");
  const [surname = "", first = ""] = cleaned.split(" ");
  return { surname: surname.toLowerCase(), initial: first.charAt(0).toLowerCase() };
}

// ---------------------------------------------------------------------------
// Import (CSV / JSON)
// ---------------------------------------------------------------------------

export type ImportRow = {
  floor: number;
  weekday: number;
  block: string;
  start: string;
  end: string;
  teachers: string[];
};

const DAY_ALIASES: Record<string, number> = {
  "1": 1, mon: 1, monday: 1,
  "2": 2, tue: 2, tues: 2, tuesday: 2,
  "3": 3, wed: 3, wednesday: 3,
  "4": 4, thu: 4, thur: 4, thurs: 4, thursday: 4,
  "5": 5, fri: 5, friday: 5,
};

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function validateRow(raw: {
  floor: unknown; weekday: unknown; block: unknown; start: unknown; end: unknown; teachers: unknown;
}, label: string, errors: string[]): ImportRow | null {
  const floor = Number(raw.floor);
  const weekday = DAY_ALIASES[String(raw.weekday).trim().toLowerCase()];
  const block = String(raw.block ?? "").trim();
  const start = normalizeTime(String(raw.start ?? ""));
  const end = normalizeTime(String(raw.end ?? ""));
  const teachers = (Array.isArray(raw.teachers) ? raw.teachers.map(String) : String(raw.teachers ?? "").split(/[/;|]/))
    .map((t) => t.trim())
    .filter(Boolean);

  const problems: string[] = [];
  if (!DUTY_FLOORS.includes(floor as 1 | 2 | 3)) problems.push("floor must be 1, 2 or 3");
  if (!weekday) problems.push("weekday must be Mon-Fri (or 1-5)");
  if (!DUTY_BLOCKS.includes(block as DutyBlock)) problems.push('block must be "1-2" or "3-4"');
  if (!start || !end) problems.push("start/end must be HH:mm");
  else if ((toMinutes(start) as number) >= (toMinutes(end) as number)) problems.push("start must be before end");
  if (!teachers.length) problems.push("at least one teacher is required");
  if (teachers.length > 2) problems.push("at most 2 teachers per slot");
  if (problems.length) {
    errors.push(`${label}: ${problems.join("; ")}`);
    return null;
  }
  return { floor, weekday, block, start: start as string, end: end as string, teachers };
}

/**
 * CSV columns: floor,weekday,block,start,end,teachers   (teachers separated by "/" or ";")
 * JSON: [{ "floor":1, "weekday":"Mon", "block":"1-2", "start":"08:55", "end":"09:40", "teachers":["A. B."] }]
 */
export function parseDutyImport(
  text: string,
  format: "csv" | "json"
): { rows: ImportRow[]; errors: string[] } {
  const rows: ImportRow[] = [];
  const errors: string[] = [];

  if (format === "json") {
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return { rows, errors: ["Invalid JSON"] };
    }
    if (!Array.isArray(data)) return { rows, errors: ["JSON must be an array of slot objects"] };
    data.forEach((item, i) => {
      const o = (item ?? {}) as Record<string, unknown>;
      const row = validateRow(
        { floor: o.floor, weekday: o.weekday ?? o.day, block: o.block, start: o.start ?? o.startTime, end: o.end ?? o.endTime, teachers: o.teachers ?? o.teacher },
        `Item ${i + 1}`,
        errors
      );
      if (row) rows.push(row);
    });
  } else {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    lines.forEach((line, i) => {
      const cols = parseCsvLine(line);
      if (i === 0 && /floor/i.test(cols[0] ?? "")) return; // header
      const row = validateRow(
        { floor: cols[0], weekday: cols[1], block: cols[2], start: cols[3], end: cols[4], teachers: cols[5] },
        `Line ${i + 1}`,
        errors
      );
      if (row) rows.push(row);
    });
  }

  // Same slot twice in the file is almost certainly a mistake.
  const seen = new Set<string>();
  for (const r of rows) {
    const key = `${r.floor}|${r.weekday}|${r.block}|${r.start}`;
    if (seen.has(key)) errors.push(`Duplicate slot in file: floor ${r.floor}, day ${r.weekday}, block ${r.block}, ${r.start}`);
    seen.add(key);
  }
  return { rows, errors };
}
