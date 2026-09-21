"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Calendar, View, Views } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { useFormatter, useTranslations } from "next-intl";
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

  return (
    <div className="mt-4">
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

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-md w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                {selected.title}
              </h3>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 text-sm leading-none"
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
