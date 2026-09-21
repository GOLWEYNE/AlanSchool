"use client";

import { Calendar, View, Views } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { useMemo, useState } from "react";
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
    const base = wallClockToLocalDate(weekStart);
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
  }, [events, weekStart]);

  return (
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
      defaultDate={wallClockToLocalDate(weekStart)}
      getNow={schoolNowAsLocalDate}
      style={{ height: "98%" }}
      onView={handleOnChangeView}
      min={min}
      max={max}
    />
  );
};

export default BigCalendar;