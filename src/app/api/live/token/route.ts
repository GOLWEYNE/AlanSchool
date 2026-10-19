import { NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import prisma from "@/lib/prisma";
import {
  LIVE_STALE_MS,
  ensureTeacherVideo,
  getActor,
  getLiveKitConfig,
  liveRoomName,
  parentCanWatchTeacher,
} from "@/lib/teacherVideo";

export const dynamic = "force-dynamic";

// A parent asks to watch a teacher's live class. Subscribe-only token, and only
// for a teacher who is live right now and teaches one of the parent's children.
export async function POST(req: Request) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (actor.role !== "parent") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const config = getLiveKitConfig();
  if (!config) return NextResponse.json({ error: "live_not_configured" }, { status: 503 });
  if (!(await ensureTeacherVideo())) return NextResponse.json({ error: "unavailable" }, { status: 503 });

  const body = (await req.json().catch(() => null)) as { teacherId?: unknown } | null;
  const teacherId = typeof body?.teacherId === "string" ? body.teacherId : "";
  if (!teacherId) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  if (!(await parentCanWatchTeacher(actor.userId, teacherId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const live = await prisma.teacherLive.findUnique({ where: { teacherId } });
  if (!live || Date.now() - live.lastSeenAt.getTime() > LIVE_STALE_MS) {
    return NextResponse.json({ error: "not_live" }, { status: 409 });
  }

  const token = new AccessToken(config.apiKey, config.apiSecret, {
    identity: `parent-${actor.userId}-${Math.random().toString(36).slice(2, 8)}`,
    ttl: "2h",
  });
  token.addGrant({
    room: liveRoomName(teacherId),
    roomJoin: true,
    canPublish: false,
    canPublishData: false,
    canSubscribe: true,
  });

  return NextResponse.json({ token: await token.toJwt(), url: config.url });
}
