import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { ensureTeacherVideo, getActor } from "@/lib/teacherVideo";

export const dynamic = "force-dynamic";

// Teacher ends the broadcast (also sent with sendBeacon when the tab closes).
export async function POST() {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (actor.role !== "teacher") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!(await ensureTeacherVideo())) return NextResponse.json({ error: "unavailable" }, { status: 503 });

  await prisma.teacherLive.deleteMany({ where: { teacherId: actor.userId } });
  return NextResponse.json({ ok: true });
}
