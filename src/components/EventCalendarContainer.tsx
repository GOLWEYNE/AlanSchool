import Image from "next/image";
import EventCalendar from "./EventCalendar";
import EventList from "./EventList";

const EventCalendarContainer = async ({
  searchParams,
}: {
  searchParams: { [keys: string]: string | undefined };
}) => {
  const { date } = searchParams;
  return (
    <div className="bg-white dark:bg-slate-900 p-4 rounded-md">
      <EventCalendar />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold my-4 dark:text-blue-100">Events</h1>
        <Image src="/moreDark.png" alt="" width={20} height={20} className="dark:invert dark:opacity-70" />
      </div>
      <div className="flex flex-col gap-4">
        <EventList dateParam={date} />
      </div>
    </div>
  );
};

export default EventCalendarContainer;
