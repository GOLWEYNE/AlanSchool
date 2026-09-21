import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { getUserRole } from "@/lib/auth";
import { buildStudentCalendar } from "@/lib/studentCalendar";

// Study Planner export: the student's timetable and deadlines as an .ics file
// that Google Calendar, Apple Calendar and Outlook can import. Built fresh on
// every request from the latest data.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function GET(req: NextRequest) {
  const { userId, sessionClaims } = auth();
  if (!userId) return json("Unauthorized", 401);
  const role = getUserRole(sessionClaims);
  const requested = req.nextUrl.searchParams.get("studentId");

  let studentId: string | null = null;

  if (role === "student") {
    // A student can only export their own calendar.
    if (requested && requested !== userId) return json("Forbidden", 403);
    studentId = userId;
  } else if (role === "parent") {
    // A parent exports one of their own children's calendars.
    const children = await prisma.student.findMany({
      where: { parentId: userId },
      select: { id: true },
    });
    if (requested) {
      if (!children.some((c) => c.id === requested)) return json("Forbidden", 403);
      studentId = requested;
    } else if (children.length === 1) {
      studentId = children[0].id;
    } else {
      return json("Pass ?studentId= to choose a child", 400);
    }
  } else if (role === "admin" || role === "teacher") {
    if (!requested) return json("Pass ?studentId= to choose a student", 400);
    studentId = requested;
  } else {
    return json("Forbidden", 403);
  }

  const calendar = await buildStudentCalendar(studentId);
  if (!calendar) return json("Student not found", 404);

  return new NextResponse(calendar.ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${calendar.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
