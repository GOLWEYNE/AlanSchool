import prisma from "@/lib/prisma";
import { resend, RESEND_FROM } from "@/lib/resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Weekly digest emailed to every parent who has an email on file: their
// child's attendance, newly graded work, and anything still due - the
// "electronic grade diary" from the roadmap. Triggered by Vercel Cron (see
// vercel.json) every Sunday evening; safe to call more than once, since it
// only ever reads data and sends mail, never writes anything.
function isAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    return req.headers.get("authorization") === `Bearer ${secret}`;
  }
  // No CRON_SECRET configured yet - fall back to the header Vercel itself
  // attaches to cron-triggered requests, so this isn't wide open to the
  // public in the meantime. Add a CRON_SECRET env var for stronger
  // protection (Vercel starts sending it automatically once it exists).
  return req.headers.get("user-agent")?.includes("vercel-cron") ?? false;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function escapeHtml(input: string) {
  return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const weekAhead = new Date(now.getTime() + 7 * DAY_MS);

  const parents = await prisma.parent.findMany({
    where: { email: { not: null } },
    include: { students: { include: { class: true } } },
  });

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const parent of parents) {
    if (!parent.email || parent.students.length === 0) {
      skipped++;
      continue;
    }

    const sections: string[] = [];

    for (const student of parent.students) {
      const [attendance, gradedWork, dueThisWeek] = await Promise.all([
        prisma.attendanceRecord.findMany({
          where: { studentId: student.id, date: { gte: weekAgo } },
        }),
        prisma.studentSubmission.findMany({
          where: { studentId: student.id, status: "GRADED", gradedAt: { gte: weekAgo } },
          include: {
            assignment: { select: { title: true } },
            exam: { select: { title: true } },
          },
        }),
        // Simplification for v1: matches by class, same as the assignment
        // list students already see - doesn't yet narrow by
        // Assignment.targetStudentIds for assignments given to only a
        // subset of the class.
        prisma.assignment.findMany({
          where: {
            lesson: { classId: student.classId },
            dueDate: { gte: now, lte: weekAhead },
          },
          include: { lesson: { select: { subject: { select: { name: true } } } } },
        }),
      ]);

      const submitted = await prisma.studentSubmission.findMany({
        where: {
          studentId: student.id,
          assignmentId: { in: dueThisWeek.map((a) => a.id) },
        },
        select: { assignmentId: true },
      });
      const submittedIds = new Set(submitted.map((s) => s.assignmentId));
      const stillDue = dueThisWeek.filter((a) => !submittedIds.has(a.id));

      const presentCount = attendance.filter((a) => a.status === "PRESENT").length;
      const absentCount = attendance.filter((a) => a.status === "ABSENT").length;
      const lateCount = attendance.filter((a) => a.status === "LATE").length;
      const excusedCount = attendance.filter((a) => a.status === "EXCUSED").length;

      const attendanceLine = attendance.length
        ? `${presentCount} present, ${absentCount} absent, ${lateCount} late, ${excusedCount} excused`
        : "No attendance recorded this week";

      const gradedLines = gradedWork.length
        ? gradedWork
            .map((s) => {
              const title = s.assignment?.title ?? s.exam?.title ?? "Assessment";
              return `<li>${escapeHtml(title)} &mdash; ${s.grade ?? "-"}${
                s.feedback ? ` (${escapeHtml(s.feedback)})` : ""
              }</li>`;
            })
            .join("")
        : "<li>Nothing newly graded this week</li>";

      const dueLines = stillDue.length
        ? stillDue
            .map(
              (a) =>
                `<li>${escapeHtml(a.title)} (${escapeHtml(a.lesson.subject.name)}) &mdash; due ${a.dueDate.toLocaleDateString()}</li>`
            )
            .join("")
        : "<li>Nothing due in the next 7 days</li>";

      sections.push(`
        <h3 style="margin:20px 0 6px;color:#1e3a8a;">${escapeHtml(student.name)} ${escapeHtml(
        student.surname
      )} &mdash; ${escapeHtml(student.class.name)}</h3>
        <p style="margin:4px 0;"><strong>Attendance this week:</strong> ${attendanceLine}</p>
        <p style="margin:12px 0 4px;"><strong>Newly graded:</strong></p>
        <ul style="margin:0 0 8px;padding-left:20px;">${gradedLines}</ul>
        <p style="margin:12px 0 4px;"><strong>Still due:</strong></p>
        <ul style="margin:0;padding-left:20px;">${dueLines}</ul>
      `);
    }

    const html = `
      <div style="font-family:system-ui,sans-serif;color:#1f2937;max-width:560px;">
        <h2 style="color:#1e3a8a;">Weekly update from Alan International School</h2>
        ${sections.join('<hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;" />')}
        <p style="margin-top:24px;font-size:12px;color:#6b7280;">
          You're receiving this because you're listed as a parent/guardian in the school platform.
        </p>
      </div>
    `;

    try {
      await resend.emails.send({
        from: RESEND_FROM,
        to: parent.email,
        subject: "Your child's weekly update - Alan International School",
        html,
      });
      sent++;
    } catch (err) {
      console.error("weekly-parent-summary send error", parent.id, err);
      errors.push(parent.id);
    }
  }

  return Response.json({ sent, skipped, failed: errors.length });
}
