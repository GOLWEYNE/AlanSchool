import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { savePushSubscription } from "@/lib/push";

// Called by the browser right after Notification.requestPermission() and
// pushManager.subscribe() succeed (see hooks/usePushNotifications.ts).
// Re-posting the same subscription (e.g. every login) is cheap - it's an
// upsert keyed on the subscription's unique endpoint.
export async function POST(req: NextRequest) {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const endpoint = body?.endpoint as string | undefined;
  const p256dh = body?.keys?.p256dh as string | undefined;
  const auth_ = body?.keys?.auth as string | undefined;

  if (!endpoint || !p256dh || !auth_) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  await savePushSubscription(userId, { endpoint, keys: { p256dh, auth: auth_ } });
  return NextResponse.json({ ok: true });
}
