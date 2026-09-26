import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { kkKZ, ruRU } from "@clerk/localizations";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { ThemeProvider } from "@/context/ThemeContext";
const inter = Inter({ subsets: ["latin"] });

type ClerkLocalization = React.ComponentProps<typeof ClerkProvider>["localization"];

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");
  return {
    // The school's name is a proper noun, so it is not translated.
    title: "Alan International School",
    description: t("description"),
    icons: { icon: "/Alan.png", apple: "/Alan.png" },
  };
}

// Runs before React hydrates so the correct theme class is on <html> for the
// very first paint - otherwise a dark-mode visitor would see a flash of the
// light theme (or vice versa) while the ThemeProvider effect catches up.
// Kept as a plain string (not a helper import) since it must be inlined.
const themeBootstrapScript = `
(function () {
  try {
    var stored = window.localStorage.getItem("ais-theme");
    var theme = stored === "light" || stored === "dark"
      ? stored
      : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    var root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    root.style.colorScheme = theme;
  } catch (e) {}
})();
`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    // Clerk's own sign-in form / account menu follow the selected language too.
    // (Cast: @clerk/localizations is newer than the @clerk/nextjs typings.)
    <ClerkProvider
      localization={
        (locale === "ru" ? ruRU : locale === "kk" ? kkKZ : undefined) as ClerkLocalization
      }
    >
      <html lang={locale}>
        <head>
          <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
        </head>
        <body className={inter.className}>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <ThemeProvider>
              {children} <ToastContainer position="bottom-right" theme="dark" />
            </ThemeProvider>
          </NextIntlClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
