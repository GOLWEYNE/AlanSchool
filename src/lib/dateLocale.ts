// English keeps the day-first en-GB ordering the app has always used
// ("21 Sept"); Russian and Kazakh use their own locale data.
export const dateLocale = (locale: string) => (locale === "en" ? "en-GB" : locale);
