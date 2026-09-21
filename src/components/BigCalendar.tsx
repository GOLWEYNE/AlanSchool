"use client";

import { Calendar, View, Views } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { useState } from "react";
import { useCalendarI18n } from "@/lib/calendarI18n";

const BigCalendar = ({
  data,
  defaultView,
}: {
  data: { title: string; start: Date; end: Date }[];
  defaultView?: View;
}) => {
  const { localizer, culture, messages } = useCalendarI18n();
  const [view, setView] = useState<View>(defaultView ?? Views.WORK_WEEK);

  const handleOnChangeView = (selectedView: View) => {
    setView(selectedView);
  };

  const today = new Date();
  const min = new Date(today);
  const max = new Date(today);
  min.setHours(8, 0, 0, 0);
  max.setHours(17, 0, 0, 0);

  return (
    <Calendar
      localizer={localizer}
      culture={culture}
      messages={messages}
      events={data}
      startAccessor="start"
      endAccessor="end"
      views={["work_week", "day"]}
      view={view}
      style={{ height: "98%" }}
      onView={handleOnChangeView}
      min={min}
      max={max}
    />
  );
};

export default BigCalendar;