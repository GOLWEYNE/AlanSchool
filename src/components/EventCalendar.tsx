"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";

type ValuePiece = Date | null;

type Value = ValuePiece | [ValuePiece, ValuePiece];

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const EventCalendar = ({ eventDates = [] }: { eventDates?: string[] }) => {
  const [value, onChange] = useState<Value>(new Date());

  const router = useRouter();

  useEffect(() => {
    if (value instanceof Date) {
      router.push(`?date=${value}`);
    }
  }, [value, router]);

  const parsedEventDates = eventDates.map((d) => new Date(d));
  const today = new Date();

  return (
    <div className="event-calendar-shell">
      <Calendar
        onChange={onChange}
        value={value}
        tileContent={({ date, view }) => {
          if (view !== "month") return null;
          const hasEvent = parsedEventDates.some((d) => sameDay(d, date));
          const isToday = sameDay(date, today);
          return (
            <div className="flex items-center justify-center gap-0.5 mt-0.5 h-1.5">
              {hasEvent && (
                <span className="w-1.5 h-1.5 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shadow-sm" />
              )}
              {isToday && !hasEvent && <span className="w-1.5 h-1.5 rounded-full bg-blue-500/70" />}
            </div>
          );
        }}
        tileClassName={({ date, view }) => {
          if (view !== "month") return "";
          return sameDay(date, today) ? "event-calendar-today" : "";
        }}
      />
      {eventDates.length > 0 && (
        <div className="flex items-center gap-1.5 mt-3 px-1">
          <span className="w-2 h-2 rounded-full bg-gradient-to-br from-amber-400 to-orange-500" />
          <span className="text-[11px] text-gray-400 dark:text-slate-500">Days with scheduled events</span>
        </div>
      )}
    </div>
  );
};

export default EventCalendar;
