import { fromWallClock, schoolWeekMonday, toWallClock, type SchoolDate } from "./schoolTime";

const addDays = (d: SchoolDate, n: number): SchoolDate => {
  const x = new Date(Date.UTC(d.year, d.month - 1, d.day + n));
  return { year: x.getUTCFullYear(), month: x.getUTCMonth() + 1, day: x.getUTCDate() };
};

/**
 * Where the weekly lessons start and stop repeating. The school year runs
 * September to May: outside it (June-August) the series starts on the first
 * Monday of September, and it always ends on 31 May.
 */
export const lessonSeriesWindow = (now: Date = new Date()) => {
  const today = toWallClock(now);
  const inSummer = today.month >= 6 && today.month <= 8;

  let firstMonday: SchoolDate = schoolWeekMonday(now);
  if (inSummer) {
    const sept1: SchoolDate = { year: today.year, month: 9, day: 1 };
    const weekday = new Date(Date.UTC(sept1.year, 8, 1)).getUTCDay(); // 0 = Sunday
    const untilMonday = weekday === 1 ? 0 : (8 - weekday) % 7;
    firstMonday = addDays(sept1, untilMonday);
  }

  const endYear = today.month >= 6 ? today.year + 1 : today.year;
  const until = fromWallClock({ year: endYear, month: 5, day: 31, hour: 23, minute: 59, second: 59 });
  return { firstMonday, until };
};
