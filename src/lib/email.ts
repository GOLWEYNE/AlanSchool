import { Resend } from "resend";
import { clerkClient } from "@clerk/nextjs/server";

// Email fallback for anyone push doesn't reach (no subscription yet, all
// devices offline, notifications denied in the browser). Every Clerk user
// has a primary email on file regardless of role - so we go straight to
// Clerk instead of the (optional, role-table) `email` columns, which are
// frequently empty for students.
const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

// Resend's shared sandbox sender - works with zero setup but only
// delivers to the Resend account owner's own verified address. Once a
// sending domain is verified (see README), set EMAIL_FROM to something
// like "Alan International School <notifications@alaninternationialschool.com>".
const FROM = process.env.EMAIL_FROM || "Alan School <onboarding@resend.dev>";

export type EmailPayload = {
  title: string;
  body: string;
  url?: string;
};

const getUserEmail = async (userId: string): Promise<string | null> => {
  try {
    const user = await clerkClient().users.getUser(userId);
    return user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null;
  } catch (err) {
    console.log("could not resolve email for", userId, err);
    return null;
  }
};

export const sendEmailToUser = async (userId: string, payload: EmailPayload) => {
  if (!resend) return; // RESEND_API_KEY not configured - skip silently

  const to = await getUserEmail(userId);
  if (!to) return;

  const actionHtml = payload.url
    ? `<p><a href="${payload.url}" style="color:#2563eb">Open in Alan School dashboard</a></p>`
    : "";

  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: payload.title,
      html: `<div style="font-family:sans-serif;font-size:14px;color:#1e293b">
        <p>${payload.body}</p>
        ${actionHtml}
      </div>`,
    });
  } catch (err) {
    console.log("email send failed", err);
  }
};
