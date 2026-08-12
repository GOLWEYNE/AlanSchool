import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { routing } from "./routing";

type AppLocale = (typeof routing.locales)[number];

function isAppLocale(value: string | undefined): value is AppLocale {
  return !!value && (routing.locales as readonly string[]).includes(value);
}

export default getRequestConfig(async () => {
  const cookieLocale = (await cookies()).get("NEXT_LOCALE")?.value;
  const locale = isAppLocale(cookieLocale) ? cookieLocale : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
