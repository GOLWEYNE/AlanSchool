import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { removePushSubscription } from "@/lib/push";

// Called when the user explicitly turns notifications off in this browser
// (see hooks/usePushNotifications.ts). Ownership isn't re-checked against
// userId - an endpoint is unguessable and unsubscribing a subscription
// that isn't yours is harmless (it can only ever be your own device's).
export async function POST(req: NextRequest) {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const endpoint = body?.endpoint as string | undefined;
  if (!endpoint) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  await removePushSubscription(endpoint);
  return NextResponse.json({ ok: true });
}
