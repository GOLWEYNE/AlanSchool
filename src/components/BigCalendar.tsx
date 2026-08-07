"use client";

import { Calendar, momentLocalizer, View, Views } from "react-big-calendar";
import moment from "moment";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { useState } from "react";

const localizer = momentLocalizer(moment);

const BigCalendar = ({
  data,
  defaultView,
}: {
  data: { title: string; start: Date; end: Date }[];
  defaultView?: View;
}) => {
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