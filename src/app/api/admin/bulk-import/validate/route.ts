import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserRole } from "@/lib/auth";
import { BULK_IMPORT_ROLES, BulkImportRole, RawImportRow } from "@/lib/bulkImportShared";
import { validateRows } from "@/lib/bulkImportServer";

export const maxDuration = 30;

// Read-only: resolves classes/parents/subjects and checks for duplicate
// username/email/phone, but never touches Clerk or writes to the database.
// The admin can upload and re-upload freely before committing anything.
export async function POST(req: NextRequest) {
  const { sessionClaims } = auth();
  const role = getUserRole(sessionClaims);
  if (role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  let body: { role?: string; rows?: RawImportRow[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const importRole = body.role as BulkImportRole;
  if (!BULK_IMPORT_ROLES.includes(importRole)) {
    return NextResponse.json({ error: "Unknown role" }, { status: 400 });
  }
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length === 0) {
    return NextResponse.json({ error: "No rows to validate" }, { status: 400 });
  }
  if (rows.length > 1000) {
    return NextResponse.json({ error: "Too many rows (max 1000 per file)" }, { status: 400 });
  }

  const { results, commits } = await validateRows(importRole, rows);

  return NextResponse.json({
    results,
    commits,
    summary: {
      total: results.length,
      ready: results.filter((r) => r.status === "ready").length,
      errors: results.filter((r) => r.status === "error").length,
    },
  });
}
