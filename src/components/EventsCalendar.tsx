"use client";

import { useState, type ReactNode } from "react";
import { Calendar, momentLocalizer, View, Views } from "react-big-calendar";
import moment from "moment";
import "react-big-calendar/lib/css/react-big-calendar.css";

const localizer = momentLocalizer(moment);

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
  start: Date;
  end: Date;
  classId: number | null;
  className: string | null;
};

const colorForClass = (classId: number | null) => {
  if (classId === null) return GENERAL_COLOR;
  return CLASS_PALETTE[classId % CLASS_PALETTE.length];
};

const formatRange = (start: Date, end: Date) => {
  const sameDay = start.toDateString() === end.toDateString();
  const dateFmt: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  const timeFmt: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
  if (sameDay) {
    return `${start.toLocaleDateString(undefined, dateFmt)} · ${start.toLocaleTimeString(
      undefined,
      timeFmt
    )} – ${end.toLocaleTimeString(undefined, timeFmt)}`;
  }
  return `${start.toLocaleDateString(undefined, dateFmt)} ${start.toLocaleTimeString(
    undefined,
    timeFmt
  )} – ${end.toLocaleDateString(undefined, dateFmt)} ${end.toLocaleTimeString(undefined, timeFmt)}`;
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
  events: CalendarEventItem[];
  actionsByEventId?: Record<number, ReactNode>;
}) => {
  const [view, setView] = useState<View>(Views.MONTH);
  const [date, setDate] = useState<Date>(new Date());
  const [selected, setSelected] = useState<CalendarEventItem | null>(null);

  const hasClassSpecific = events.some((e) => e.classId !== null);

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-4 mb-3 text-xs text-gray-500 dark:text-slate-400">
        <span className="font-semibold text-gray-600 dark:text-slate-300">Legend:</span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-full inline-block"
            style={{ backgroundColor: GENERAL_COLOR }}
          />
          General (all classes)
        </span>
        {hasClassSpecific && (
          <span className="inline-flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block"
              style={{ backgroundColor: CLASS_PALETTE[0] }}
            />
            Targeted at a specific class (color varies by class)
          </span>
        )}
      </div>

      <div className="panel-card p-3 rounded-md" style={{ height: "70vh" }}>
        <Calendar<CalendarEventItem>
          localizer={localizer}
          events={events}
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
              >
                ✕
              </button>
            </div>
            <span
              className="inline-block rounded-full px-2.5 py-1 text-xs font-semibold text-white mb-3"
              style={{ backgroundColor: colorForClass(selected.classId) }}
            >
              {selected.className ? selected.className : "General (all classes)"}
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
