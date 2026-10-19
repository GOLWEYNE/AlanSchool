import { createHash } from "crypto";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { getUserRole } from "@/lib/auth";
import { TEACHER_VIDEO_DDL } from "@/lib/teacherVideoDdl";

// Table bootstrap, same pattern as ensureMockTests(): create the tables if they
// are missing (idempotent) so recordings/live work right after deploy;
// `prisma migrate deploy` stays safe.
let ready = false;
let pending: Promise<boolean> | null = null;

async function prepare(): Promise<boolean> {
  try {
    await prisma.teacherRecording.count();
    await prisma.teacherLive.count();
    return true;
  } catch {
    try {
      for (const statement of TEACHER_VIDEO_DDL) {
        await prisma.$executeRawUnsafe(statement);
      }
      await prisma.teacherRecording.count();
      await prisma.teacherLive.count();
      return true;
    } catch (error) {
      console.error("[teacherVideo] could not prepare tables", error);
      return false;
    }
  }
}

export async function ensureTeacherVideo(): Promise<boolean> {
  if (ready) return true;
  if (!pending) {
    pending = prepare().finally(() => {
      pending = null;
    });
  }
  const ok = await pending;
  if (ok) ready = true;
  return ok;
}

export type VideoActor = { userId: string; role: string };

/** Signed-in user and role, or null when signed out. */
export async function getActor(): Promise<VideoActor | null> {
  const { userId, sessionClaims } = await auth();
  if (!userId) return null;
  return { userId, role: getUserRole(sessionClaims) };
}

/** A teacher is "live" while their heartbeat is newer than this. */
export const LIVE_STALE_MS = 60_000;

export const MAX_TITLE = 120;

export const cleanTitle = (value: unknown, fallback: string): string => {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return (text || fallback).slice(0, MAX_TITLE);
};

const cloudName = () => process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME || "";

/**
 * Only accept video URLs that live on this school's own Cloudinary account, so a
 * saved recording can never point parents at an arbitrary external page.
 */
export function isOwnCloudinaryVideo(url: unknown, publicId: unknown): boolean {
  const cloud = cloudName();
  if (!cloud || typeof url !== "string" || typeof publicId !== "string" || !publicId) return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname === "res.cloudinary.com" &&
      parsed.pathname.startsWith(`/${cloud}/video/upload/`)
    );
  } catch {
    return false;
  }
}

export type CloudDeleteResult = "deleted" | "not_found" | "not_configured" | "failed";

/** Remove the file from Cloudinary. Needs CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET. */
export async function deleteCloudinaryVideo(publicId: string): Promise<CloudDeleteResult> {
  const cloud = cloudName();
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud || !apiKey || !apiSecret) return "not_configured";

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHash("sha1")
    .update(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
    .digest("hex");

  const body = new URLSearchParams({
    public_id: publicId,
    timestamp: String(timestamp),
    api_key: apiKey,
    signature,
  });

  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/video/destroy`, {
      method: "POST",
      body,
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as { result?: string };
    if (res.ok && json.result === "ok") return "deleted";
    if (res.ok && json.result === "not found") return "not_found";
    return "failed";
  } catch {
    return "failed";
  }
}

// ---- Live streaming (LiveKit) -------------------------------------------

export type LiveKitConfig = { url: string; apiKey: string; apiSecret: string };

/** Null until LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET are all set. */
export function getLiveKitConfig(): LiveKitConfig | null {
  const url = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!url || !apiKey || !apiSecret) return null;
  return { url, apiKey, apiSecret };
}

export const liveRoomName = (teacherId: string) => `teacher-${teacherId}`;

/**
 * Can this parent watch this teacher? Only when one of the parent's children is
 * in a class the teacher supervises or teaches (same rule as teacherScope).
 */
export async function parentCanWatchTeacher(parentId: string, teacherId: string): Promise<boolean> {
  const count = await prisma.student.count({
    where: {
      parentId,
      class: { OR: [{ supervisorId: teacherId }, { lessons: { some: { teacherId } } }] },
    },
  });
  return count > 0;
}

/** Ids of every teacher whose class one of this parent's children is in. */
export async function teacherIdsForParent(parentId: string): Promise<string[]> {
  const children = await prisma.student.findMany({
    where: { parentId },
    select: { classId: true },
  });
  const classIds = Array.from(new Set(children.map((c: { classId: number }) => c.classId)));
  if (classIds.length === 0) return [];
  const teachers = await prisma.teacher.findMany({
    where: {
      OR: [{ classes: { some: { id: { in: classIds } } } }, { lessons: { some: { classId: { in: classIds } } } }],
    },
    select: { id: true },
  });
  return teachers.map((t: { id: string }) => t.id);
}
