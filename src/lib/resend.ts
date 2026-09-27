import { Resend } from "resend";

// Single shared Resend client for the whole app. Reuses the RESEND_API_KEY
// that is already configured in the Vercel project's environment variables -
// no new credential needed to send from here.
export const resend = new Resend(process.env.RESEND_API_KEY);

// Sender shown to parents. Override with RESEND_FROM_EMAIL once a custom
// domain is verified in the Resend dashboard; falls back to Resend's shared
// onboarding domain so sending never silently breaks in the meantime.
export const RESEND_FROM =
  process.env.RESEND_FROM_EMAIL || "AlanSchool <onboarding@resend.dev>";
