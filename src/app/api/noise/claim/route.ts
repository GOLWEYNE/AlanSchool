import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth";
import { canUseClass, claimClass, isValidDeviceId, releaseClass } from "@/lib/noise";

export const dynamic = "force-dynamic";

async function parse(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const classId = typeof body.classId === "number" && Number.isInteger(body.classId) && body.classId > 0 ? body.classId : null;
    if (classId === null || !isValidDeviceId(body.deviceId)) return null;
    return { classId, deviceId: body.deviceId, takeover: body.takeover === true };
  } catch {
    return null;
  }
}

// A board asks to be the one device listening for a class. Refused (409) while another
// device holds it, unless the caller says takeover.
export async function POST(req: Request) {
  const access = await requireApiRole(["admin", "teacher"]);
  if (access instanceof NextResponse) return access;

  const input = await parse(req);
  if (!input) return NextResponse.json({ ok: false, error: "bad_values" }, { status: 400 });

  const allowed = await canUseClass(access.role, access.userId, input.classId);
  if (allowed === "forbidden") return NextResponse.json({ ok: false, error: "not_your_class" }, { status: 403 });
  if (allowed === "missing") return NextResponse.json({ ok: false, error: "no_class" }, { status: 404 });

  if (!(await claimClass(input.classId, input.deviceId, input.takeover))) {
    return NextResponse.json({ ok: false, error: "in_use" }, { status: 409 });
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}

// The board lets go of the class when it stops listening.
export async function DELETE(req: Request) {
  const access = await requireApiRole(["admin", "teacher"]);
  if (access instanceof NextResponse) return access;

  const input = await parse(req);
  if (!input) return NextResponse.json({ ok: false, error: "bad_values" }, { status: 400 });

  await releaseClass(input.classId, input.deviceId);
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
