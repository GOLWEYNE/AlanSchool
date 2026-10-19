import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { ensureTeacherVideo, getActor, teacherIdsForParent } from "@/lib/teacherVideo";

export const dynamic = "force-dynamic";

// Parents: clips their children's teachers chose to share (newest first).
export async function GET() {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (actor.role !== "parent") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!(await ensureTeacherVideo())) return NextResponse.json({ items: [] });

  const teacherIds = await teacherIdsForParent(actor.userId);
  if (teacherIds.length === 0) return NextResponse.json({ items: [] });

  const rows = await prisma.teacherRecording.findMany({
    where: { teacherId: { in: teacherIds }, sharedWithParents: true },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  const teachers = await prisma.teacher.findMany({
    where: { id: { in: Array.from(new Set(rows.map((r: { teacherId: string }) => r.teacherId))) } },
    select: { id: true, name: true, surname: true },
  });
  const nameOf = new Map(teachers.map((t: { id: string; name: string; surname: string }) => [t.id, `${t.name} ${t.surname}`]));

  return NextResponse.json({
    items: rows.map((r: { id: number; teacherId: string; title: string; url: string; durationSec: number; createdAt: Date }) => ({
      id: r.id,
      title: r.title,
      url: r.url,
      durationSec: r.durationSec,
      createdAt: r.createdAt,
      teacherName: nameOf.get(r.teacherId) ?? "",
    })),
  });
}
