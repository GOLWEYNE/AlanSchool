import { NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import prisma from "@/lib/prisma";
import {
  cleanTitle,
  ensureTeacherVideo,
  getActor,
  getLiveKitConfig,
  liveRoomName,
} from "@/lib/teacherVideo";

export const dynamic = "force-dynamic";

// Teacher goes live: mark them as broadcasting and hand back a publish token.
export async function POST(req: Request) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (actor.role !== "teacher") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const config = getLiveKitConfig();
  if (!config) return NextResponse.json({ error: "live_not_configured" }, { status: 503 });
  if (!(await ensureTeacherVideo())) return NextResponse.json({ error: "unavailable" }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const title = cleanTitle(body.title, "Live class");
  const now = new Date();

  await prisma.teacherLive.upsert({
    where: { teacherId: actor.userId },
    create: { teacherId: actor.userId, title, startedAt: now, lastSeenAt: now },
    update: { title, startedAt: now, lastSeenAt: now },
  });

  const token = new AccessToken(config.apiKey, config.apiSecret, {
    identity: `teacher-${actor.userId}`,
    ttl: "4h",
  });
  token.addGrant({
    room: liveRoomName(actor.userId),
    roomJoin: true,
    canPublish: true,
    canSubscribe: false,
    canPublishData: false,
  });

  return NextResponse.json({ token: await token.toJwt(), url: config.url });
}

// Heartbeat: keeps the teacher showing as live while the tab stays open.
export async function PATCH() {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (actor.role !== "teacher") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!(await ensureTeacherVideo())) return NextResponse.json({ error: "unavailable" }, { status: 503 });

  const { count } = await prisma.teacherLive.updateMany({
    where: { teacherId: actor.userId },
    data: { lastSeenAt: new Date() },
  });
  return NextResponse.json({ ok: count > 0 });
}
