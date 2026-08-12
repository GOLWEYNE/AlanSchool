import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Alan School Management Dashboard",
  description: "Next.js School Management System",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <ClerkProvider>
      <html lang={locale}>
        <body className={inter.className}>
          <NextIntlClientProvider locale={locale} messages={messages}>
            {children} <ToastContainer position="bottom-right" theme="dark" />
          </NextIntlClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
