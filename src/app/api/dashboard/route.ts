import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const type = url.searchParams.get("type"); // "teacher", "student", "parent"

    if (type === "teacher") {
      const teacher = await prisma.teacher.findUnique({
        where: { id: userId },
        include: {
          classes: true,
          subjects: true,
          lessons: { include: { class: true, subject: true } },
        },
      });
      return NextResponse.json(teacher);
    } else if (type === "student") {
      const student = await prisma.student.findUnique({
        where: { id: userId },
        include: {
          class: { include: { lessons: { include: { teacher: true, subject: true } } } },
          grade: true,
          results: { include: { exam: true, assignment: true } },
        },
      });
      return NextResponse.json(student);
    } else if (type === "parent") {
      const parent = await prisma.parent.findUnique({
        where: { id: userId },
        include: {
          students: {
            include: {
              class: { include: { lessons: { include: { teacher: true, subject: true } } } },
              grade: true,
              results: { include: { exam: true, assignment: true } },
            },
          },
        },
      });
      return NextResponse.json(parent);
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
