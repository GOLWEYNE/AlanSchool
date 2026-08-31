import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { getUserRole } from "@/lib/auth";

// One-off, idempotent, admin-only endpoint.
//
// Paula (parent.qa1@alaninternationalschool.com) ended up with 507 of the
// school's 555 students attached to her — almost certainly a seed-data
// artifact, not a real family. This keeps her 2 earliest real students
// (skipping the literal "Test" record) and reassigns every other student
// currently pointing at her to a dedicated placeholder parent
// (parent.overflow.qa1@alaninternationalschool.com / username
// parent_overflow_v2, created via the normal Create Parent flow so it has
// a real Clerk login like any other parent).
//
// Safe to call repeatedly: it only ever touches students whose parentId is
// still Paula's, so once the migration has run once, later calls are a
// no-op (movedCount: 0).
export async function POST() {
  const { sessionClaims } = auth();
  const role = getUserRole(sessionClaims);

  if (role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const PAULA_EMAIL = "parent.qa1@alaninternationalschool.com";
  const PLACEHOLDER_USERNAME = "parent_overflow_v2";

  const paula = await prisma.parent.findFirst({
    where: { email: PAULA_EMAIL },
    include: { students: { orderBy: { createdAt: "asc" } } },
  });

  if (!paula) {
    return NextResponse.json({ error: "Paula not found" }, { status: 404 });
  }

  const placeholder = await prisma.parent.findUnique({
    where: { username: PLACEHOLDER_USERNAME },
  });

  if (!placeholder) {
    return NextResponse.json(
      { error: "Placeholder parent not found - create it first" },
      { status: 404 }
    );
  }

  const realStudents = paula.students.filter((s) => s.name !== "Test");
  const keep = realStudents.slice(0, 2);
  const keepIds = new Set(keep.map((s) => s.id));
  const toMove = paula.students.filter((s) => !keepIds.has(s.id));

  const result = await prisma.student.updateMany({
    where: { id: { in: toMove.map((s) => s.id) } },
    data: { parentId: placeholder.id },
  });

  const remaining = await prisma.student.count({
    where: { parentId: paula.id },
  });

  return NextResponse.json({
    paulaId: paula.id,
    kept: keep.map((s) => ({ id: s.id, name: s.name })),
    movedCount: result.count,
    remainingWithPaula: remaining,
    placeholderParentId: placeholder.id,
  });
}
