import { Resend } from "resend";

// Single shared Resend client for the whole app. Reuses the RESEND_API_KEY
// that is already configured in the Vercel project's environment variables -
// no new credential needed to send from here.
//
// Built lazily (only when actually sending an email) rather than at module
// load time: RESEND_API_KEY is currently only set for the Production
// environment, and constructing the client eagerly would throw as soon as
// this file is imported - which crashes the Next.js build itself while it
// collects page data for any route that imports this module in Preview.
let cachedClient: Resend | null = null;

export function getResend(): Resend {
  if (!cachedClient) {
    cachedClient = new Resend(process.env.RESEND_API_KEY);
  }
  return cachedClient;
}

// Sender shown to parents. Override with RESEND_FROM_EMAIL once a custom
// domain is verified in the Resend dashboard; falls back to Resend's shared
// onboarding domain so sending never silently breaks in the meantime.
export const RESEND_FROM =
  process.env.RESEND_FROM_EMAIL || "AlanSchool <onboarding@resend.dev>";
