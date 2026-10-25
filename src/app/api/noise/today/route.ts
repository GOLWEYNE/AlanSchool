import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth";
import { isValidYmd, loadNoiseDay } from "@/lib/noise";

export const dynamic = "force-dynamic";

// Polled by the admin "noisy today" board.
export async function GET(req: Request) {
  const access = await requireApiRole(["admin"]);
  if (access instanceof NextResponse) return access;

  const date = new URL(req.url).searchParams.get("date") ?? undefined;
  const payload = await loadNoiseDay(isValidYmd(date) ? date : undefined);
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}
