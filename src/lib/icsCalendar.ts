// Minimal iCalendar (RFC 5545) writer for the Study Planner export.
//
// Only what the export needs: timed events (in UTC), all-day events, a weekly
// recurrence rule and display reminders. Kept free of server-only imports so it
// can be unit tested on its own.

export type IcsAlarm = {
  /** iCalendar duration relative to the start, e.g. "-P1D" or "-PT1H". */
  trigger: string;
  description: string;
};

type IcsEventBase = {
  /** Stable id so re-importing the file updates events instead of duplicating them. */
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  categories?: string[];
  /** Full RRULE value without the "RRULE:" prefix, e.g. "FREQ=WEEKLY;UNTIL=20270531T190000Z". */
  rrule?: string;
  alarms?: IcsAlarm[];
};

export type IcsTimedEvent = IcsEventBase & {
  kind: "timed";
  start: Date;
  end: Date;
};

export type IcsAllDayEvent = IcsEventBase & {
  kind: "allDay";
  /** The calendar day, no time or zone. */
  date: { year: number; month: number; day: number };
};

export type IcsEvent = IcsTimedEvent | IcsAllDayEvent;

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

/** 20260924T040000Z */
export const icsUtc = (d: Date): string =>
  `${pad(d.getUTCFullYear(), 4)}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(
    d.getUTCHours()
  )}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

/** 20260924 */
export const icsDate = (p: { year: number; month: number; day: number }): string =>
  `${pad(p.year, 4)}${pad(p.month)}${pad(p.day)}`;

/** Escapes a TEXT value: backslash, semicolon, comma and line breaks. */
export const icsEscape = (value: string): string =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");

const encoder = new TextEncoder();

/**
 * Folds a content line at 75 octets (RFC 5545 3.1), never splitting a
 * multi-byte character - Cyrillic and Kazakh text is two bytes per letter.
 */
export const icsFold = (line: string): string => {
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  // The first line may hold 75 octets; continuation lines start with a space
  // that counts toward their 75.
  let limit = 75;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    if (bytes + size > limit) {
      parts.push(current);
      current = "";
      bytes = 0;
      limit = 74;
    }
    current += ch;
    bytes += size;
  }
  if (current) parts.push(current);
  return parts.join("\r\n ");
};

const textLine = (name: string, value: string) => icsFold(`${name}:${icsEscape(value)}`);

const eventLines = (event: IcsEvent, stamp: Date): string[] => {
  const lines: string[] = ["BEGIN:VEVENT", `UID:${event.uid}`, `DTSTAMP:${icsUtc(stamp)}`];

  if (event.kind === "timed") {
    lines.push(`DTSTART:${icsUtc(event.start)}`, `DTEND:${icsUtc(event.end)}`);
  } else {
    const next = new Date(Date.UTC(event.date.year, event.date.month - 1, event.date.day + 1));
    lines.push(
      `DTSTART;VALUE=DATE:${icsDate(event.date)}`,
      `DTEND;VALUE=DATE:${icsDate({
        year: next.getUTCFullYear(),
        month: next.getUTCMonth() + 1,
        day: next.getUTCDate(),
      })}`
    );
  }

  if (event.rrule) lines.push(`RRULE:${event.rrule}`);
  lines.push(textLine("SUMMARY", event.summary));
  if (event.description) lines.push(textLine("DESCRIPTION", event.description));
  if (event.location) lines.push(textLine("LOCATION", event.location));
  if (event.categories?.length) {
    lines.push(icsFold(`CATEGORIES:${event.categories.map(icsEscape).join(",")}`));
  }

  for (const alarm of event.alarms ?? []) {
    lines.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      textLine("DESCRIPTION", alarm.description),
      `TRIGGER:${alarm.trigger}`,
      "END:VALARM"
    );
  }

  lines.push("END:VEVENT");
  return lines;
};

export type IcsCalendarOptions = {
  name: string;
  /** Shown by some clients as the calendar's own zone, e.g. "Asia/Almaty". */
  timeZone?: string;
  events: IcsEvent[];
  stamp?: Date;
};

/** The full .ics document, CRLF line endings as the RFC requires. */
export const buildIcsCalendar = ({
  name,
  timeZone,
  events,
  stamp = new Date(),
}: IcsCalendarOptions): string => {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Alan International School//Study Planner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    textLine("X-WR-CALNAME", name),
  ];
  if (timeZone) lines.push(`X-WR-TIMEZONE:${timeZone}`);
  for (const event of events) lines.push(...eventLines(event, stamp));
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
};
