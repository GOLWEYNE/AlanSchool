import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserRole } from "@/lib/auth";
import prisma from "@/lib/prisma";

// Command-palette search: students, tickets, and messages in one query.
// Scoped to admin/teacher for now, since those are the only roles with
// browsable detail pages for tickets today (and full student browsing).
export async function GET(req: NextRequest) {
  const { userId, sessionClaims } = auth();
  const role = getUserRole(sessionClaims);

  if (!userId || (role !== "admin" && role !== "teacher")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json({ students: [], tickets: [], messages: [] });
  }

  const isTeacher = role === "teacher";

  const [students, tickets, messages] = await prisma.$transaction([
    prisma.student.findMany({
      where: {
        AND: [
          isTeacher ? { class: { lessons: { some: { teacherId: userId } } } } : {},
          {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { surname: { contains: q, mode: "insensitive" } },
              { username: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          },
        ],
      },
      select: { id: true, name: true, surname: true, username: true, class: { select: { name: true } } },
      take: 5,
    }),
    prisma.ticket.findMany({
      where: {
        AND: [
          isTeacher ? { OR: [{ createdById: userId }, { assignedToId: userId }] } : {},
          {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
            ],
          },
        ],
      },
      select: { id: true, title: true, status: true, priority: true, category: true },
      take: 5,
      orderBy: { createdAt: "desc" },
    }),
    prisma.message.findMany({
      where: {
        AND: [
          isTeacher ? { OR: [{ senderId: userId }, { receiverId: userId }] } : {},
          { content: { contains: q, mode: "insensitive" } },
          { studentId: { not: null } },
        ],
      },
      select: {
        id: true,
        content: true,
        studentId: true,
        createdAt: true,
      },
      take: 5,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Message has no Prisma relation to Student (studentId is a plain scalar),
  // so the display name for each message's student is resolved separately.
  const studentIds = [...new Set(messages.map((m) => m.studentId).filter((id): id is string => id !== null))];
  const messageStudents = studentIds.length
    ? await prisma.student.findMany({
        where: { id: { in: studentIds } },
        select: { id: true, name: true, surname: true },
      })
    : [];
  const studentById = new Map(messageStudents.map((s) => [s.id, s]));
  const messagesWithStudent = messages.map((m) => ({
    ...m,
    student: m.studentId ? studentById.get(m.studentId) ?? null : null,
  }));

  return NextResponse.json({ students, tickets, messages: messagesWithStudent });
}
