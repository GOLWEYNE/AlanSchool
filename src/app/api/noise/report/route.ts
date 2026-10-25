import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth";
import { getNoiseSettings, recordNoise, REPORT_EVERY_SECONDS } from "@/lib/noise";
import { teacherCanAccessClass } from "@/lib/teacherScope";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

const num = (v: unknown, min: number, max: number): number | null => {
  const n = typeof v === "number" ? v : NaN;
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

// Called by the classroom board every few seconds with a handful of numbers
// (average / peak loudness and how many seconds were over the limit). The browser
// measures the sound itself; no audio is ever uploaded. Teachers can only report
// for their own classes, admins for any class.
export async function POST(req: Request) {
  const access = await requireApiRole(["admin", "teacher"]);
  if (access instanceof NextResponse) return access;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const classId = num(body.classId, 1, 2_000_000_000);
  const seconds = num(body.seconds, 1, REPORT_EVERY_SECONDS * 3);
  const avgDb = num(body.avgDb, 0, 140);
  const maxDb = num(body.maxDb, 0, 140);
  const overSeconds = num(body.overSeconds, 0, 1000);
  const yellowSeconds = num(body.yellowSeconds, 0, 1000);
  if (
    classId === null || seconds === null || avgDb === null || maxDb === null ||
    overSeconds === null || yellowSeconds === null ||
    !Number.isInteger(classId) || !Number.isInteger(seconds) ||
    !Number.isInteger(overSeconds) || !Number.isInteger(yellowSeconds) ||
    overSeconds + yellowSeconds > seconds
  ) {
    return NextResponse.json({ ok: false, error: "bad_values" }, { status: 400 });
  }

  if (access.role === "teacher") {
    if (!(await teacherCanAccessClass(access.userId, classId))) {
      return NextResponse.json({ ok: false, error: "not_your_class" }, { status: 403 });
    }
  } else {
    const exists = await prisma.class.findUnique({ where: { id: classId }, select: { id: true } });
    if (!exists) return NextResponse.json({ ok: false, error: "no_class" }, { status: 404 });
  }

  const saved = await recordNoise({ classId, seconds, avgDb, maxDb, overSeconds, yellowSeconds });
  if (!saved) return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });

  // Send the current school-wide limit back so a change takes effect without a reload.
  const settings = await getNoiseSettings();
  return NextResponse.json({ ok: true, settings }, { headers: { "Cache-Control": "no-store" } });
}
