import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { getUserRole } from "@/lib/auth";

// One-off, idempotent, admin-only endpoint to add missing Grade rows
// (the seed script only created levels 1-6). Safe to call repeatedly.
export async function GET() {
  const { sessionClaims } = auth();
  const role = getUserRole(sessionClaims);

  if (role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const levels = [7, 8, 9, 10, 11];
  const created: number[] = [];

  for (const level of levels) {
    const existing = await prisma.grade.findUnique({ where: { level } });
    if (!existing) {
      await prisma.grade.create({ data: { level } });
      created.push(level);
    }
  }

  const allGrades = await prisma.grade.findMany({ orderBy: { level: "asc" } });

  return NextResponse.json({ created, allGrades });
}
