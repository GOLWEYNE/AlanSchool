import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { getUserRole } from "@/lib/auth";
import { STATUS_LABEL, addDays, isValidDateStr, itemLabel, schoolToday, toDbDate } from "@/lib/uniform";
import type { UniformStatusKey } from "@/lib/uniform";

// CSV export of uniform checks (opens directly in Excel).
// Admins get any class; teachers only the classes they supervise.
export async function GET(req: Request) {
  const { userId, sessionClaims } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });
  const role = getUserRole(sessionClaims);
  if (role !== "admin" && role !== "teacher") return new NextResponse("Forbidden", { status: 403 });

  const url = new URL(req.url);
  const today = schoolToday();
  const to = isValidDateStr(url.searchParams.get("to")) ? (url.searchParams.get("to") as string) : today;
  const from = isValidDateStr(url.searchParams.get("from")) ? (url.searchParams.get("from") as string) : addDays(to, -29);
  const classIdParam = parseInt(url.searchParams.get("classId") ?? "", 10);

  const rows = await prisma.uniformCheck.findMany({
    where: {
      date: { gte: toDbDate(from), lte: toDbDate(to) },
      ...(Number.isFinite(classIdParam) ? { classId: classIdParam } : {}),
      ...(role === "teacher" ? { class: { supervisorId: userId } } : {}),
    },
    orderBy: [{ date: "desc" }, { classId: "asc" }],
    take: 50000,
    include: {
      student: { select: { name: true, surname: true } },
      class: { select: { name: true } },
      checkedBy: { select: { name: true, surname: true } },
    },
  });

  const esc = (v: string) => '"' + v.replace(/"/g, '""') + '"';
  const header = ["Date", "Class", "Student", "Status", "Missing items", "Note", "Checked by"];
  const lines = rows.map((r) =>
    [
      r.date.toISOString().slice(0, 10),
      r.class.name,
      r.student.name + " " + r.student.surname,
      STATUS_LABEL[r.status as UniformStatusKey],
      r.missingItems.map(itemLabel).join("; "),
      r.note ?? "",
      r.checkedBy ? r.checkedBy.name + " " + r.checkedBy.surname : "",
    ]
      .map((c) => esc(String(c)))
      .join(",")
  );
  const csv = "﻿" + [header.map(esc).join(","), ...lines].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="uniform-' + from + '-to-' + to + '.csv"',
    },
  });
}
