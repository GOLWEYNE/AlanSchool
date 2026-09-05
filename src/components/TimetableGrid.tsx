"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Calendar, momentLocalizer, Views } from "react-big-calendar";
import withDragAndDrop, {
  type EventInteractionArgs,
} from "react-big-calendar/lib/addons/dragAndDrop";
import moment from "moment";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { rescheduleLesson } from "@/lib/actions";

const localizer = momentLocalizer(moment);

export type TimetableLessonItem = {
  id: number;
  name: string;
  room: string | null;
  subjectId: number;
  subjectName: string;
  classId: number;
  className: string;
  teacherId: string;
  teacherName: string;
  start: Date;
  end: Date;
};

const SUBJECT_PALETTE = [
  "#2563eb",
  "#0d9488",
  "#c2410c",
  "#7c3aed",
  "#be185d",
  "#059669",
  "#b45309",
  "#4f46e5",
  "#0891b2",
  "#65a30d",
];
const CONFLICT_COLOR = "#dc2626";

const colorForSubject = (subjectId: number) => SUBJECT_PALETTE[subjectId % SUBJECT_PALETTE.length];

// Monday 00:00 of "this" week - the recurring weekly grid always shows this
// single week; there is nothing to navigate to since lessons repeat weekly
// with no real calendar date of their own.
const getWeekAnchor = () => {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
};

const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) =>
  aStart < bEnd && bStart < aEnd;

const LessonEventContent = ({ event }: { event: TimetableLessonItem }) => (
  <div className="text-[11px] leading-tight overflow-hidden h-full">
    <div className="font-semibold truncate">{event.subjectName}</div>
    <div className="truncate opacity-90">{event.className}</div>
    <div className="truncate opacity-75">{event.teacherName}</div>
  </div>
);

const DnDCalendar = withDragAndDrop<TimetableLessonItem>(Calendar);

// Replaces the flat "Monday 09:00" table rows with a real Mon-Fri weekly
// grid. Admins and teachers can drag a lesson to a new day/time or drag its
// edge to resize it; every move is re-validated server-side for a
// double-booked teacher or class before it's saved, and any lesson already
// in conflict is outlined in red so the clash is visible without clicking
// anything.
const TimetableGrid = ({
  lessons,
  canEdit,
  actionsByLessonId,
}: {
  lessons: TimetableLessonItem[];
  canEdit: boolean;
  actionsByLessonId?: Record<number, ReactNode>;
}) => {
  const router = useRouter();
  const [items, setItems] = useState<TimetableLessonItem[]>(lessons);
  const [selected, setSelected] = useState<TimetableLessonItem | null>(null);
  const [weekAnchor] = useState<Date>(getWeekAnchor);

  // The server refetches (and re-sends fresh props) after every successful
  // reschedule and on every filter change - keep local state in lockstep
  // with whatever the server last confirmed.
  useEffect(() => {
    setItems(lessons);
  }, [lessons]);

  const conflictIds = useMemo(() => {
    const ids = new Set<number>();
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];
        const sameTeacher = a.teacherId === b.teacherId;
        const sameClass = a.classId === b.classId;
        if (!sameTeacher && !sameClass) continue;
        if (overlaps(a.start, a.end, b.start, b.end)) {
          ids.add(a.id);
          ids.add(b.id);
        }
      }
    }
    return ids;
  }, [items]);

  const { min, max } = useMemo(() => {
    const base = weekAnchor;
    let minMinutes = 7 * 60;
    let maxMinutes = 18 * 60;
    if (lessons.length > 0) {
      minMinutes = Math.min(...lessons.map((l) => l.start.getHours() * 60 + l.start.getMinutes()));
      maxMinutes = Math.max(...lessons.map((l) => l.end.getHours() * 60 + l.end.getMinutes()));
      minMinutes = Math.max(0, minMinutes - 30);
      maxMinutes = Math.min(24 * 60, maxMinutes + 30);
    }
    const minDate = new Date(base);
    minDate.setHours(0, minMinutes, 0, 0);
    const maxDate = new Date(base);
    maxDate.setHours(0, maxMinutes, 0, 0);
    return { min: minDate, max: maxDate };
  }, [lessons, weekAnchor]);

  const applyReschedule = async (args: EventInteractionArgs<TimetableLessonItem>) => {
    const start = new Date(args.start);
    const end = new Date(args.end);
    const previous = items;
    setItems((prev) => prev.map((it) => (it.id === args.event.id ? { ...it, start, end } : it)));

    const result = await rescheduleLesson({ id: args.event.id, start, end });
    if (!result.success) {
      setItems(previous);
      toast.error(result.message || "Couldn't reschedule that lesson.");
      return;
    }
    toast("Lesson rescheduled.");
    router.refresh();
  };

  const eventPropGetter = (event: TimetableLessonItem) => {
    const inConflict = conflictIds.has(event.id);
    return {
      style: {
        backgroundColor: inConflict ? CONFLICT_COLOR : colorForSubject(event.subjectId),
        border: inConflict ? "2px solid #7f1d1d" : "none",
        borderRadius: 6,
        color: "white",
      },
    };
  };

  const sharedProps = {
    localizer,
    events: items,
    startAccessor: "start" as const,
    endAccessor: "end" as const,
    views: [Views.WORK_WEEK],
    view: Views.WORK_WEEK,
    date: weekAnchor,
    toolbar: false,
    min,
    max,
    style: { height: "100%" },
    onSelectEvent: (event: TimetableLessonItem) => setSelected(event),
    eventPropGetter,
    components: { event: LessonEventContent },
  };

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
          This Week&apos;s Timetable (Mon–Fri)
        </h2>
        {conflictIds.size > 0 && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: CONFLICT_COLOR }} />
            {conflictIds.size} lesson{conflictIds.size === 1 ? "" : "s"} in conflict
          </span>
        )}
        {canEdit && (
          <span className="text-xs text-gray-500 dark:text-slate-400">
            Drag a lesson to reschedule it, or drag its edge to resize it.
          </span>
        )}
      </div>

      <div className="panel-card p-3 rounded-md" style={{ height: "70vh" }}>
        {canEdit ? (
          <DnDCalendar
            {...sharedProps}
            resizable
            onEventDrop={applyReschedule}
            onEventResize={applyReschedule}
          />
        ) : (
          <Calendar<TimetableLessonItem> {...sharedProps} />
        )}
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
                {selected.name}
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
              style={{ backgroundColor: colorForSubject(selected.subjectId) }}
            >
              {selected.subjectName}
            </span>
            {conflictIds.has(selected.id) && (
              <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-2">
                This lesson conflicts with another one for the same teacher or class.
              </p>
            )}
            <p className="text-sm text-gray-600 dark:text-slate-300 mb-1">
              Class: {selected.className}
            </p>
            <p className="text-sm text-gray-600 dark:text-slate-300 mb-1">
              Teacher: {selected.teacherName}
            </p>
            {selected.room && (
              <p className="text-sm text-gray-600 dark:text-slate-300 mb-1">Room: {selected.room}</p>
            )}
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-4">
              {selected.start.toLocaleDateString(undefined, { weekday: "long" })}{" "}
              {selected.start.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })} –{" "}
              {selected.end.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
            </p>
            {actionsByLessonId?.[selected.id] && (
              <div className="flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-slate-800">
                {actionsByLessonId[selected.id]}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TimetableGrid;
