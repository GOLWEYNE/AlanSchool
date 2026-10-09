import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth";
import { loadActivePasses } from "@/lib/hallPass";

export const dynamic = "force-dynamic";

// Polled by the live board. Admins get every active pass; teachers only the
// passes of students in their own classes.
export async function GET() {
  const access = await requireApiRole(["admin", "teacher"]);
  if (access instanceof NextResponse) return access;

  const payload = await loadActivePasses({
    role: access.role as "admin" | "teacher",
    userId: access.userId,
  });
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}
