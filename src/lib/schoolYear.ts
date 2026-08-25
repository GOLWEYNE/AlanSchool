// Shared helper for defaulting the "school year" text input across the
// report card UI. The academic year is assumed to start in September.
export const currentSchoolYear = () => {
  const now = new Date();
  const year = now.getFullYear();
  const startYear = now.getMonth() >= 8 /* Sep = 8 */ ? year : year - 1;
  return `${startYear}/${startYear + 1}`;
};
