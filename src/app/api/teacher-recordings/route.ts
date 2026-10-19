import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { cleanTitle, ensureTeacherVideo, getActor, isOwnCloudinaryVideo } from "@/lib/teacherVideo";

export const dynamic = "force-dynamic";

// A teacher's own saved recordings (newest first).
export async function GET() {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (actor.role !== "teacher") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!(await ensureTeacherVideo())) return NextResponse.json({ error: "unavailable" }, { status: 503 });

  const items = await prisma.teacherRecording.findMany({
    where: { teacherId: actor.userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ items });
}

// Save a clip that the browser has already uploaded to Cloudinary.
export async function POST(req: Request) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (actor.role !== "teacher") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!(await ensureTeacherVideo())) return NextResponse.json({ error: "unavailable" }, { status: 503 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  if (!isOwnCloudinaryVideo(body.url, body.publicId)) {
    return NextResponse.json({ error: "Invalid video" }, { status: 400 });
  }

  const durationSec = Math.max(0, Math.min(24 * 3600, Math.round(Number(body.durationSec) || 0)));
  const bytes = Math.max(0, Math.min(2_000_000_000, Math.round(Number(body.bytes) || 0)));
  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");

  const item = await prisma.teacherRecording.create({
    data: {
      teacherId: actor.userId,
      title: cleanTitle(body.title, `Recording ${stamp}`),
      url: body.url as string,
      publicId: body.publicId as string,
      durationSec,
      bytes,
      sharedWithParents: body.sharedWithParents === true,
    },
  });
  return NextResponse.json({ item }, { status: 201 });
}
