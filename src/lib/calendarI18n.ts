import { momentLocalizer } from "react-big-calendar";
import moment from "moment";
import "moment/locale/ru";
import "moment/locale/kk";
import { useLocale, useTranslations } from "next-intl";

// Importing a moment locale file switches moment's *global* locale as a side
// effect - put it back so anything else using moment keeps its old default.
// The calendars pick their language per render through the `culture` prop.
moment.locale("en");

export const calendarLocalizer = momentLocalizer(moment);

// Culture + translated toolbar/agenda strings for react-big-calendar, so
// month/week names, weekday headers and "Today / Back / Next" follow the
// language chosen in the switcher.
export function useCalendarI18n() {
  const culture = useLocale();
  const t = useTranslations("Calendar");
  return {
    localizer: calendarLocalizer,
    culture,
    messages: {
      allDay: t("allDay"),
      previous: t("previous"),
      next: t("next"),
      today: t("today"),
      month: t("month"),
      week: t("week"),
      work_week: t("work_week"),
      day: t("day"),
      agenda: t("agenda"),
      date: t("date"),
      time: t("time"),
      event: t("event"),
      noEventsInRange: t("noEventsInRange"),
      showMore: (total: number) => t("showMore", { count: total }),
    },
  };
}
