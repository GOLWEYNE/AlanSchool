"use client";

import { Calendar, View, Views } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCalendarI18n } from "@/lib/calendarI18n";
import { schoolNowAsLocalDate, wallClockToLocalDate } from "@/lib/schoolTime";

// `data` holds school wall-clock strings ("YYYY-MM-DDTHH:mm:ss"). They are
// turned into Dates whose local fields read exactly that, because the calendar
// positions events with local getters - this is what keeps a lesson at the same
// hour on the server render, after hydration and in every viewer's time zone.
const BigCalendar = ({
  data,
  weekStart,
  defaultView,
}: {
  data: { title: string; start: string; end: string }[];
  weekStart: string;
  defaultView?: View;
}) => {
  const { localizer, culture, messages } = useCalendarI18n();
  const [view, setView] = useState<View>(defaultView ?? Views.WORK_WEEK);

  // Phones (below md) get one day at a time: a Mon-Fri strip to pick the day
  // and a left/right swipe to move between days, like the iOS Calendar. The
  // week view stays on tablets and desktops. A calendar that is already a
  // single-day view (the parent's "today") keeps behaving as before.
  const weekBase = useMemo(() => wallClockToLocalDate(weekStart), [weekStart]);
  const weekDays = useMemo(
    () =>
      [0, 1, 2, 3, 4].map((i) => {
        const d = new Date(weekBase);
        d.setDate(weekBase.getDate() + i);
        return d;
      }),
    [weekBase]
  );
  const dayCapable = defaultView !== Views.DAY;
  const [date, setDate] = useState<Date>(weekBase);
  const [isPhone, setIsPhone] = useState(false);
  const touch = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsPhone(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const phoneDay = isPhone && dayCapable;

  useEffect(() => {
    if (phoneDay) {
      setView(Views.DAY);
      // open on the school's today when it is a school day of this week, else Monday
      const now = schoolNowAsLocalDate();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const diff = Math.round((midnight.getTime() - weekBase.getTime()) / 86400000);
      setDate(weekDays[diff >= 0 && diff <= 4 ? diff : 0]);
    } else {
      setView(defaultView ?? Views.WORK_WEEK);
      setDate(weekBase);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phoneDay]);

  const dayIndex = Math.max(
    0,
    weekDays.findIndex((d) => d.toDateString() === date.toDateString())
  );
  const nowDay = schoolNowAsLocalDate().toDateString();

  const weekdayShort = (d: Date) => {
    try {
      return new Intl.DateTimeFormat(culture, { weekday: "short" }).format(d);
    } catch {
      return new Intl.DateTimeFormat("en", { weekday: "short" }).format(d);
    }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx) * 0.7) return;
    const next = Math.min(4, Math.max(0, dayIndex + (dx < 0 ? 1 : -1)));
    setDate(weekDays[next]);
  };

  const handleOnChangeView = (selectedView: View) => {
    setView(selectedView);
  };

  const events = useMemo(
    () =>
      data.map((item) => ({
        title: item.title,
        start: wallClockToLocalDate(item.start),
        end: wallClockToLocalDate(item.end),
      })),
    [data]
  );

  // Show the 08:00-17:00 school day, but widen it if a lesson falls outside so
  // no lesson is ever clipped off the grid.
  const { min, max } = useMemo(() => {
    const base = weekBase;
    let minMinutes = 8 * 60;
    let maxMinutes = 17 * 60;
    for (const e of events) {
      minMinutes = Math.min(minMinutes, e.start.getHours() * 60 + e.start.getMinutes());
      maxMinutes = Math.max(maxMinutes, e.end.getHours() * 60 + e.end.getMinutes());
    }
    // Round out to whole hours so the grid lines stay tidy.
    minMinutes = Math.max(0, Math.floor(minMinutes / 60) * 60);
    maxMinutes = Math.min(24 * 60, Math.ceil(maxMinutes / 60) * 60);
    const minDate = new Date(base);
    minDate.setHours(0, minMinutes, 0, 0);
    const maxDate = new Date(base);
    maxDate.setHours(0, maxMinutes, 0, 0);
    return { min: minDate, max: maxDate };
  }, [events, weekBase]);

  const calendar = (
    <Calendar
      localizer={localizer}
      culture={culture}
      messages={messages}
      events={events}
      startAccessor="start"
      endAccessor="end"
      views={["work_week", "day"]}
      view={view}
      // Always open on the week the lessons were projected onto (on a weekend
      // that is the week that just ended), and keep "now" on school time.
      date={date}
      onNavigate={setDate}
      getNow={schoolNowAsLocalDate}
      style={{ height: phoneDay ? 600 : "98%" }}
      onView={handleOnChangeView}
      toolbar={!phoneDay}
      min={min}
      max={max}
    />
  );

  if (!phoneDay) return calendar;

  return (
    <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} style={{ touchAction: "pan-y" }}>
      <div className="mb-3 flex gap-1.5" role="tablist">
        {weekDays.map((d, i) => {
          const active = i === dayIndex;
          return (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setDate(d)}
              className={`flex flex-1 flex-col items-center rounded-2xl px-1 py-2 text-xs font-semibold transition active:scale-95 ${
                active
                  ? "bg-gradient-to-br from-yellow-300/70 to-blue-300/50 text-blue-900 shadow-sm dark:text-yellow-100"
                  : "text-blue-700/80 dark:text-blue-200/80"
              }`}
            >
              <span className="uppercase tracking-wide">{weekdayShort(d)}</span>
              <span className="mt-0.5 text-base">{d.getDate()}</span>
              <span
                className={`mt-0.5 h-1 w-1 rounded-full ${
                  d.toDateString() === nowDay ? "bg-blue-500" : "bg-transparent"
                }`}
              />
            </button>
          );
        })}
      </div>
      {calendar}
    </div>
  );
};

export default BigCalendar;
