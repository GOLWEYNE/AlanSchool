import { timingSafeEqual } from "crypto";
import { runDutyReminders } from "@/lib/duty";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Called every 5 minutes by an external scheduler (see
// .github/workflows/duty-reminders.yml) - Vercel Hobby cron only runs daily.
// Auth: `Authorization: Bearer <CRON_SECRET>`. Unlike the older weekly cron
// route there is deliberately NO user-agent fallback: with no secret configured
// the endpoint refuses everything instead of trusting a spoofable header.
// (middleware.ts lets /api/cron through Clerk because this route checks the
// secret itself.)
function isAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(req: Request) {
  if (!isAuthorized(req)) return new Response("Unauthorized", { status: 401 });
  try {
    const summary = await runDutyReminders(new Date());
    return Response.json({ ok: true, ...summary });
  } catch (err) {
    console.error("[duty-reminders] failed", err);
    return Response.json({ ok: false, error: "internal" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
