import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { getUserRole } from "@/lib/auth";

export const maxDuration = 60;

// One-off, resumable, admin-only endpoint.
//
// Follow-up to /api/admin/reassign-paula-overflow: the school wants each
// parent to have at most 3 students (ideally 1), not one placeholder
// parent holding hundreds. This splits every student currently on the
// "parent_overflow_v2" placeholder into its OWN dedicated parent record,
// continuing the school's existing parentNNNN numbering convention
// (parent1011, parent1012, ... parent1061, ...).
//
// These new parents are database-only records with no Clerk login -
// the same pattern already used by the other seeded QA/placeholder
// records in this database (e.g. the teacher_qaN rows). They don't need
// a login to be listed, viewed, or have students attached to them, and
// skipping Clerk means this migration doesn't bulk-create hundreds of
// authentication accounts.
//
// Each call processes a small batch (BATCH_SIZE students / new parents)
// so it stays well inside the serverless time limit, and reports how
// many are left. Call it repeatedly until remaining === 0. Safe to call
// repeatedly: it only ever touches students still pointing at the
// placeholder parent, and recomputes the next free parent number from
// the database on every call.
const BATCH_SIZE = 50;
const PLACEHOLDER_USERNAME = "parent_overflow_v2";

async function nextParentNumber(): Promise<number> {
  const existing = await prisma.parent.findMany({
    where: { username: { startsWith: "parent" } },
    select: { username: true },
  });
  let max = 1010; // known existing sequence starts at parent1011
  for (const p of existing) {
    const m = /^parent(\d+)$/.exec(p.username);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return max + 1;
}

export async function POST() {
  const { sessionClaims } = auth();
  const role = getUserRole(sessionClaims);

  if (role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const placeholder = await prisma.parent.findUnique({
    where: { username: PLACEHOLDER_USERNAME },
  });

  if (!placeholder) {
    return NextResponse.json(
      { error: "Placeholder parent not found", remaining: 0, done: true },
      { status: 404 }
    );
  }

  const batch = await prisma.student.findMany({
    where: { parentId: placeholder.id },
    orderBy: { createdAt: "asc" },
    take: BATCH_SIZE,
  });

  if (batch.length === 0) {
    const remainingTotal = await prisma.student.count({
      where: { parentId: placeholder.id },
    });
    return NextResponse.json({ done: true, remaining: remainingTotal });
  }

  let nextNumber = await nextParentNumber();
  const created: { username: string; studentId: string; studentName: string }[] = [];
  const errors: { studentId: string; error: string }[] = [];

  for (const student of batch) {
    const number = nextNumber;
    const username = `parent${number}`;
    const phone = `90${String(number).padStart(8, "0")}`;
    const email = `${username}@alaninternationalschool.com`;
    const id = `parent_${number}`;

    try {
      await prisma.parent.create({
        data: {
          id,
          username,
          name: "Parent",
          surname: String(number),
          email,
          phone,
          address: "N/A",
        },
      });

      await prisma.student.update({
        where: { id: student.id },
        data: { parentId: id },
      });

      created.push({ username, studentId: student.id, studentName: student.name });
      nextNumber += 1;
    } catch (err) {
      console.log("split-paula-overflow-into-parents error for student", student.id, err);
      errors.push({ studentId: student.id, error: String(err) });
      // Don't increment nextNumber on failure - retry that slot next time.
    }
  }

  const remaining = await prisma.student.count({
    where: { parentId: placeholder.id },
  });

  return NextResponse.json({
    done: remaining === 0,
    processedThisCall: created.length,
    remaining,
    created,
    errors,
  });
}
