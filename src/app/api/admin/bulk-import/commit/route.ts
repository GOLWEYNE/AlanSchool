import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserRole } from "@/lib/auth";
import { BULK_IMPORT_ROLES, BulkImportRole } from "@/lib/bulkImportShared";
import { commitRows, CommitRow } from "@/lib/bulkImportServer";

export const maxDuration = 60;

// Creates real accounts (Clerk + database) for the given rows - the client
// is responsible for sending only rows that came back "ready" from
// /api/admin/bulk-import/validate, and for splitting a large sheet into
// batches small enough to finish comfortably within the time limit above.
export async function POST(req: NextRequest) {
  const { sessionClaims } = auth();
  const role = getUserRole(sessionClaims);
  if (role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  let body: { role?: string; rows?: CommitRow[] };
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
    return NextResponse.json({ error: "No rows to commit" }, { status: 400 });
  }
  if (rows.length > 40) {
    return NextResponse.json({ error: "Batch too large (max 40 rows per call)" }, { status: 400 });
  }

  const outcomes = await commitRows(importRole, rows);

  return NextResponse.json({ outcomes });
}
