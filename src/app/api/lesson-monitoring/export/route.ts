import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserRole } from "@/lib/auth";
import { getLessonMonitoring, resolveMonitorRange } from "@/lib/lessonMonitoring";

// CSV export of the lesson monitoring cabinet (opens directly in Excel).
// Admins get every teacher (or one, with ?teacherId=); a teacher only ever
// gets their own lessons.
export async function GET(req: Request) {
  const { userId, sessionClaims } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });
  const role = getUserRole(sessionClaims);
  if (role !== "admin" && role !== "teacher") return new NextResponse("Forbidden", { status: 403 });

  const url = new URL(req.url);
  const range = resolveMonitorRange({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });
  const teacherId = role === "teacher" ? userId : url.searchParams.get("teacherId") || undefined;

  const data = await getLessonMonitoring({ range, teacherId });

  const esc = (v: string) => '"' + v.replace(/"/g, '""') + '"';
  const pct = (p: number | null) => (p === null ? "" : String(p));
  const cnt = (m: { done: number; total: number }) => (m.total > 0 ? `${m.done}/${m.total}` : "");
  const header = [
    "Teacher",
    "Class",
    "Subject",
    "Lessons",
    "Journal index %",
    "Conducted %",
    "Conducted",
    "With topics %",
    "With topics",
    "With grades %",
    "With grades",
    "Homework given %",
    "Homework given",
  ];
  const lines: string[] = [];
  for (const t of data.teachers) {
    for (const r of t.rows) {
      lines.push(
        [
          t.name,
          r.className,
          r.subjectName,
          String(r.lessons),
          pct(r.index),
          pct(r.conducted.pct),
          cnt(r.conducted),
          pct(r.topics.pct),
          cnt(r.topics),
          pct(r.grades.pct),
          cnt(r.grades),
          pct(r.homework.pct),
          cnt(r.homework),
        ]
          .map((c) => esc(String(c)))
          .join(",")
      );
    }
  }
  const csv = "﻿" + [header.map(esc).join(","), ...lines].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="lesson-monitoring-${range.from}-to-${range.to}.csv"`,
    },
  });
}
