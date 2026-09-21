import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { routing } from "./routing";
import { SCHOOL_TIME_ZONE } from "../lib/schoolTime";

type AppLocale = (typeof routing.locales)[number];

function isAppLocale(value: string | undefined): value is AppLocale {
  return !!value && (routing.locales as readonly string[]).includes(value);
}

export default getRequestConfig(async () => {
  const cookieLocale = (await cookies()).get("NEXT_LOCALE")?.value;
  const locale = isAppLocale(cookieLocale) ? cookieLocale : routing.defaultLocale;

  return {
    locale,
    // Without this, server-rendered dates print in the server's zone (UTC on
    // Vercel) and client-rendered ones in the viewer's - so the same time
    // differed between pages. Everything is shown on school time instead.
    timeZone: SCHOOL_TIME_ZONE,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
