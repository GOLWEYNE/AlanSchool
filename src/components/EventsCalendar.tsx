"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Calendar, View, Views } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useFormatter, useTranslations, type DateTimeFormatOptions } from "next-intl";
import { useCalendarI18n } from "@/lib/calendarI18n";
import {
  localWallClockToUtcDate,
  schoolNowAsLocalDate,
  wallClockToLocalDate,
} from "@/lib/schoolTime";

// A small fixed palette so a given class always renders in the same color
// across the whole calendar (the class id is hashed into the palette - no
// color needs to be stored anywhere). This is what makes "targeted at a
// specific class" visually obvious at a glance instead of just a text
// column that silently read "-" for every event.
const CLASS_PALETTE = [
  "#2563eb",
  "#0d9488",
  "#c2410c",
  "#7c3aed",
  "#be185d",
  "#059669",
  "#b45309",
  "#4f46e5",
];
const GENERAL_COLOR = "#64748b";

export type CalendarEventItem = {
  id: number;
  title: string;
  description: string;
  /** Wall-clock reading on the school clock (see schoolTime.ts), not a real instant. */
  start: Date;
  end: Date;
  classId: number | null;
  className: string | null;
};

// What the server sends: school wall-clock strings ("YYYY-MM-DDTHH:mm:ss")
// instead of Dates, so an event shows the same hour to every viewer whatever
// zone their browser (or the server) is in.
export type CalendarEventInput = Omit<CalendarEventItem, "start" | "end"> & {
  start: string;
  end: string;
};

const colorForClass = (classId: number | null) => {
  if (classId === null) return GENERAL_COLOR;
  return CLASS_PALETTE[classId % CLASS_PALETTE.length];
};

// Replaces the old flat events table with an interactive month/week/agenda
// calendar. Each event is colored by the class it's targeted at (or a
// neutral "general" color for school-wide events), and clicking one opens a
// detail panel with the full description plus, for admins, the existing
// edit/delete controls.
const EventsCalendar = ({
  events,
  actionsByEventId,
}: {
  events: CalendarEventInput[];
  actionsByEventId?: Record<number, ReactNode>;
}) => {
  const t = useTranslations("Calendar");
  const format = useFormatter();
  const { localizer, culture, messages } = useCalendarI18n();
  const items = useMemo<CalendarEventItem[]>(
    () =>
      events.map((e) => ({
        ...e,
        start: wallClockToLocalDate(e.start),
        end: wallClockToLocalDate(e.end),
      })),
    [events]
  );
  const formatRange = (startWall: Date, endWall: Date) => {
    const sameDay = startWall.toDateString() === endWall.toDateString();
    // Print the wall-clock reading as is: the Dates here carry it in their
    // local fields, so re-home it to UTC and format with timeZone "UTC".
    const start = localWallClockToUtcDate(startWall);
    const end = localWallClockToUtcDate(endWall);
    const dateFmt = { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" } as const;
    const timeFmt = { hour: "2-digit", minute: "2-digit", timeZone: "UTC" } as const;
    if (sameDay) {
      return `${format.dateTime(start, dateFmt)} · ${format.dateTime(start, timeFmt)} – ${format.dateTime(end, timeFmt)}`;
    }
    return `${format.dateTime(start, dateFmt)} ${format.dateTime(start, timeFmt)} – ${format.dateTime(end, dateFmt)} ${format.dateTime(end, timeFmt)}`;
  };
  const [view, setView] = useState<View>(Views.MONTH);
  const [date, setDate] = useState<Date>(schoolNowAsLocalDate);
  const [selected, setSelected] = useState<CalendarEventItem | null>(null);

  const hasClassSpecific = events.some((e) => e.classId !== null);

  // ---- Phone month view (like the iPhone Calendar): month grid with dots, then the picked day's events ----
  const [cursor, setCursor] = useState<Date>(() => {
    const n = schoolNowAsLocalDate();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [pickedDay, setPickedDay] = useState<Date>(schoolNowAsLocalDate);
  const todayWall = schoolNowAsLocalDate();
  const sameDate = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const eventsOnDay = (day: Date) => {
    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
    return items
      .filter((ev) => ev.start < dayEnd && (ev.end > dayStart || ev.start >= dayStart))
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  };
  const utcFmt = (d: Date, opts: DateTimeFormatOptions) =>
    format.dateTime(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())), { ...opts, timeZone: "UTC" });
  const timeOf = (d: Date) =>
    format.dateTime(localWallClockToUtcDate(d), { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  const timeRange = (ev: CalendarEventItem) =>
    ev.start.toDateString() === ev.end.toDateString()
      ? `${timeOf(ev.start)} – ${timeOf(ev.end)}`
      : formatRange(ev.start, ev.end);
  const monthYear = cursor.getFullYear();
  const monthIndex = cursor.getMonth();
  const leadingBlanks = (new Date(monthYear, monthIndex, 1).getDay() + 6) % 7; // Monday first
  const daysInMonth = new Date(monthYear, monthIndex + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(monthYear, monthIndex, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weekdayLabels = Array.from({ length: 7 }, (_, i) =>
    format.dateTime(new Date(Date.UTC(2024, 0, 1 + i)), { weekday: "narrow", timeZone: "UTC" })
  );
  const pickedEvents = eventsOnDay(pickedDay);
  const viewingToday = sameDate(pickedDay, todayWall) && monthYear === todayWall.getFullYear() && monthIndex === todayWall.getMonth();
  const goToday = () => {
    const n = schoolNowAsLocalDate();
    setCursor(new Date(n.getFullYear(), n.getMonth(), 1));
    setPickedDay(n);
  };

  return (
    <div className="mt-4">
      {/* PHONE */}
      <div className="flex flex-col gap-3 md:hidden">
        <div className="rounded-3xl border border-blue-100 bg-white/80 p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label={t("previous")}
              onClick={() => setCursor(new Date(monthYear, monthIndex - 1, 1))}
              className="flex h-11 w-11 items-center justify-center rounded-full text-blue-600 active:bg-blue-50 dark:text-blue-300 dark:active:bg-slate-800"
            >
              <ChevronLeft size={22} aria-hidden="true" />
            </button>
            <p className="text-base font-bold capitalize text-blue-950 dark:text-blue-50">
              {utcFmt(cursor, { month: "long", year: "numeric" })}
            </p>
            <button
              type="button"
              aria-label={t("next")}
              onClick={() => setCursor(new Date(monthYear, monthIndex + 1, 1))}
              className="flex h-11 w-11 items-center justify-center rounded-full text-blue-600 active:bg-blue-50 dark:text-blue-300 dark:active:bg-slate-800"
            >
              <ChevronRight size={22} aria-hidden="true" />
            </button>
          </div>
          <div className="grid grid-cols-7 text-center text-[11px] font-semibold uppercase text-gray-400 dark:text-slate-500">
            {weekdayLabels.map((w, i) => (
              <span key={i} className="py-1">
                {w}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-1">
            {cells.map((d, i) => {
              if (!d) return <span key={i} />;
              const evs = eventsOnDay(d);
              const picked = sameDate(d, pickedDay);
              const isToday = sameDate(d, todayWall);
              return (
                <button
                  key={i}
                  type="button"
                  aria-pressed={picked}
                  aria-label={utcFmt(d, { dateStyle: "full" })}
                  onClick={() => setPickedDay(d)}
                  className={`mx-auto flex h-12 w-11 flex-col items-center justify-center rounded-2xl text-base transition-colors ${
                    picked
                      ? "bg-blue-600 font-bold text-white shadow"
                      : isToday
                        ? "font-bold text-blue-600 dark:text-blue-300"
                        : "font-medium text-gray-800 dark:text-slate-100"
                  }`}
                >
                  <span>{d.getDate()}</span>
                  <span className="mt-0.5 flex h-1.5 gap-0.5">
                    {evs.slice(0, 3).map((ev) => (
                      <span
                        key={ev.id}
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: picked ? "#fde047" : colorForClass(ev.classId) }}
                      />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
          {!viewingToday && (
            <div className="mt-2 flex justify-center">
              <button
                type="button"
                onClick={goToday}
                className="min-h-11 rounded-full bg-blue-50 px-5 text-sm font-semibold text-blue-700 dark:bg-blue-500/15 dark:text-blue-200"
              >
                {t("today")}
              </button>
            </div>
          )}
        </div>

        <p className="px-1 text-sm font-bold capitalize text-blue-950 dark:text-blue-50">
          {utcFmt(pickedDay, { weekday: "long", day: "numeric", month: "long" })}
        </p>
        {pickedEvents.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-blue-100 p-5 text-center text-sm text-gray-400 dark:border-slate-700 dark:text-slate-500">
            {t("noEventsInRange")}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pickedEvents.map((ev) => (
              <li key={ev.id}>
                <button
                  type="button"
                  onClick={() => setSelected(ev)}
                  className="flex w-full items-stretch gap-3 rounded-2xl border border-blue-100 bg-white/80 p-3 text-left shadow-sm active:bg-blue-50 dark:border-slate-700 dark:bg-slate-900/70 dark:active:bg-slate-800"
                >
                  <span className="w-1.5 shrink-0 rounded-full" style={{ backgroundColor: colorForClass(ev.classId) }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-semibold text-blue-950 dark:text-blue-50">{ev.title}</span>
                    <span className="block text-xs text-gray-500 dark:text-slate-400">{timeRange(ev)}</span>
                    <span
                      className="mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
                      style={{ backgroundColor: colorForClass(ev.classId) }}
                    >
                      {ev.className ?? t("general")}
                    </span>
                  </span>
                  <ChevronRight size={20} className="shrink-0 self-center text-blue-400" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="hidden md:block">
      <div className="flex flex-wrap items-center gap-4 mb-3 text-xs text-gray-500 dark:text-slate-400">
        <span className="font-semibold text-gray-600 dark:text-slate-300">{t("legend")}</span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-full inline-block"
            style={{ backgroundColor: GENERAL_COLOR }}
          />
          {t("general")}
        </span>
        {hasClassSpecific && (
          <span className="inline-flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block"
              style={{ backgroundColor: CLASS_PALETTE[0] }}
            />
            {t("targeted")}
          </span>
        )}
      </div>

      <div className="panel-card p-3 rounded-md" style={{ height: "70vh" }}>
        <Calendar<CalendarEventItem>
          localizer={localizer}
          culture={culture}
          messages={messages}
          events={items}
          getNow={schoolNowAsLocalDate}
          startAccessor="start"
          endAccessor="end"
          titleAccessor={(event: CalendarEventItem) =>
            event.className ? `${event.title} (${event.className})` : event.title
          }
          views={["month", "week", "agenda"]}
          view={view}
          date={date}
          onView={(nextView: View) => setView(nextView)}
          onNavigate={(nextDate: Date) => setDate(nextDate)}
          popup
          style={{ height: "100%" }}
          onSelectEvent={(event: CalendarEventItem) => setSelected(event)}
          eventPropGetter={(event: CalendarEventItem) => ({
            style: {
              backgroundColor: colorForClass(event.classId),
              borderRadius: 6,
              border: "none",
              color: "white",
            },
          })}
        />
      </div>
      </div>

      {selected && (
        <div
          className="form-overlay fixed inset-0 z-[1000] flex items-end justify-center bg-black/40 md:items-center md:p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="form-sheet w-full max-h-[92%] overflow-y-auto bg-white p-5 shadow-xl dark:bg-slate-900 max-md:rounded-t-3xl md:max-w-md md:rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                {selected.title}
              </h3>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 text-sm leading-none max-md:flex max-md:h-10 max-md:w-10 max-md:shrink-0 max-md:items-center max-md:justify-center max-md:rounded-full max-md:bg-gray-100 dark:max-md:bg-slate-800"
                onClick={() => setSelected(null)}
                aria-label={t("close")}
              >
                ✕
              </button>
            </div>
            <span
              className="inline-block rounded-full px-2.5 py-1 text-xs font-semibold text-white mb-3"
              style={{ backgroundColor: colorForClass(selected.classId) }}
            >
              {selected.className ? selected.className : t("general")}
            </span>
            {selected.description && (
              <p className="text-sm text-gray-600 dark:text-slate-300 mb-3 whitespace-pre-wrap">
                {selected.description}
              </p>
            )}
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-4">
              {formatRange(selected.start, selected.end)}
            </p>
            {actionsByEventId?.[selected.id] && (
              <div className="flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-slate-800">
                {actionsByEventId[selected.id]}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EventsCalendar;
