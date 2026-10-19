import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { cleanTitle, deleteCloudinaryVideo, ensureTeacherVideo, getActor } from "@/lib/teacherVideo";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

async function loadOwned(ctx: Ctx) {
  const actor = await getActor();
  if (!actor) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (actor.role !== "teacher") return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  if (!(await ensureTeacherVideo())) return { error: NextResponse.json({ error: "unavailable" }, { status: 503 }) };

  const id = Number.parseInt(ctx.params.id, 10);
  if (!Number.isFinite(id)) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };

  const item = await prisma.teacherRecording.findUnique({ where: { id } });
  // Another teacher's clip looks exactly like a missing one.
  if (!item || item.teacherId !== actor.userId) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  return { item };
}

// Rename a clip and/or toggle whether parents can watch it.
export async function PATCH(req: Request, ctx: Ctx) {
  const found = await loadOwned(ctx);
  if (found.error) return found.error;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const data: { title?: string; sharedWithParents?: boolean } = {};
  if (typeof body.title === "string") data.title = cleanTitle(body.title, found.item.title);
  if (typeof body.sharedWithParents === "boolean") data.sharedWithParents = body.sharedWithParents;
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const item = await prisma.teacherRecording.update({ where: { id: found.item.id }, data });
  return NextResponse.json({ item });
}

// Delete a clip: the file in Cloudinary first, then the saved record.
export async function DELETE(_req: Request, ctx: Ctx) {
  const found = await loadOwned(ctx);
  if (found.error) return found.error;

  const cloud = await deleteCloudinaryVideo(found.item.publicId);
  if (cloud === "failed") {
    // Keep the record so the teacher can try again; never leave a file orphaned silently.
    return NextResponse.json({ error: "cloud_delete_failed" }, { status: 502 });
  }

  await prisma.teacherRecording.delete({ where: { id: found.item.id } });
  return NextResponse.json({ ok: true, fileKept: cloud === "not_configured" });
}
