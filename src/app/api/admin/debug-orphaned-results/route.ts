import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { getUserRole } from "@/lib/auth";

// TEMPORARY diagnostic route - safe to delete once the orphaned
// result rows (results with no linked exam or assignment) have
// been reviewed and fixed. Admin-only, read-only.
export async function GET() {
  const { sessionClaims } = auth();
  const role = getUserRole(sessionClaims);

  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const results = await prisma.result.findMany({
    include: {
      student: { select: { id: true, name: true, surname: true } },
      exam: { select: { id: true, title: true, startTime: true } },
      assignment: { select: { id: true, title: true, startDate: true } },
    },
    orderBy: { id: "asc" },
  });

  return NextResponse.json(
    results.map((r) => ({
      id: r.id,
      score: r.score,
      examId: r.examId,
      exam: r.exam,
      assignmentId: r.assignmentId,
      assignment: r.assignment,
      student: r.student,
    }))
  );
}
