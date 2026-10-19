import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  LIVE_STALE_MS,
  ensureTeacherVideo,
  getActor,
  getLiveKitConfig,
  teacherIdsForParent,
} from "@/lib/teacherVideo";

export const dynamic = "force-dynamic";

// Teachers: is live streaming set up? Parents: which of their children's
// teachers are live right now (polled every few seconds by the parent card).
export async function GET() {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const configured = getLiveKitConfig() !== null;

  if (actor.role === "teacher") {
    return NextResponse.json({ configured });
  }
  if (actor.role !== "parent") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!configured || !(await ensureTeacherVideo())) return NextResponse.json({ configured, live: [] });

  const teacherIds = await teacherIdsForParent(actor.userId);
  if (teacherIds.length === 0) return NextResponse.json({ configured, live: [] });

  const rows = await prisma.teacherLive.findMany({
    where: {
      teacherId: { in: teacherIds },
      lastSeenAt: { gt: new Date(Date.now() - LIVE_STALE_MS) },
    },
    orderBy: { startedAt: "asc" },
  });
  if (rows.length === 0) return NextResponse.json({ configured, live: [] });

  const teachers = await prisma.teacher.findMany({
    where: { id: { in: rows.map((r: { teacherId: string }) => r.teacherId) } },
    select: { id: true, name: true, surname: true },
  });
  const nameOf = new Map(teachers.map((t: { id: string; name: string; surname: string }) => [t.id, `${t.name} ${t.surname}`]));

  return NextResponse.json({
    configured,
    live: rows.map((r: { teacherId: string; title: string | null; startedAt: Date }) => ({
      teacherId: r.teacherId,
      teacherName: nameOf.get(r.teacherId) ?? "",
      title: r.title ?? "",
      startedAt: r.startedAt,
    })),
  });
}
