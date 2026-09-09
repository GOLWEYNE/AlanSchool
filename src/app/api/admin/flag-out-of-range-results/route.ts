import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { getUserRole } from "@/lib/auth";

// TEMPORARY diagnostic route - safe to delete once the out-of-range
// Result rows it finds (score > the linked exam/assignment's totalMarks)
// have been reviewed. Admin-only, read-only.
export async function GET() {
  const { sessionClaims } = auth();
  const role = getUserRole(sessionClaims);

  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const results = await prisma.result.findMany({
    include: {
      student: { select: { id: true, name: true, surname: true } },
      exam: { select: { id: true, title: true, totalMarks: true } },
      assignment: { select: { id: true, title: true, totalMarks: true } },
    },
    orderBy: { id: "asc" },
  });

  const outOfRange = results
    .filter((r) => {
      const cap = r.exam?.totalMarks ?? r.assignment?.totalMarks ?? null;
      return cap != null && r.score > cap;
    })
    .map((r) => ({
      id: r.id,
      score: r.score,
      student: r.student,
      exam: r.exam,
      assignment: r.assignment,
      cap: r.exam?.totalMarks ?? r.assignment?.totalMarks ?? null,
    }));

  return NextResponse.json({
    totalResults: results.length,
    outOfRangeCount: outOfRange.length,
    outOfRange,
  });
}
