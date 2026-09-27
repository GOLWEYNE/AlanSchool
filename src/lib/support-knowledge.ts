/**
 * Editable knowledge base for the AI support widget.
 *
 * This is plain text injected into the AI's system prompt (see
 * app/api/support-chat/route.ts). Keep it short and factual — the model
 * answers *from* this text, so wrong or missing info here means wrong
 * or "I don't know" answers to parents/teachers/students.
 *
 * Update this whenever a policy, deadline, or workflow in the app changes.
 * No code changes needed elsewhere.
 */

export const SCHOOL_NAME = "Alan International School";

// Shown to the AI as ground truth about how the platform works.
export const SUPPORT_KNOWLEDGE = `
# ${SCHOOL_NAME} — Platform Support Knowledge

## Roles on the platform
- Admin: manages the whole school — teachers, classes, exams, report cards.
- Teacher: manages their own profile and subject, creates/updates exams and
  enters student results.
- Parent: looks up their child by student ID or name to view that child's
  daily schedule, assignments, exams, and results.
- Student: sees their own daily schedule, assignments, exams, and the
  names of their teachers/supervisors.

## Common tasks
- Signing in: use the school account credentials provided by the school
  (Clerk-based login). If sign-in fails, check that Caps Lock is off and
  that you're using the email the school registered for you.
- Forgot password: use "Forgot password" on the sign-in screen. If that
  doesn't arrive, contact the school office to reset it — teachers cannot
  reset student/parent passwords themselves.
- Finding a child's schedule/results (parent): go to your dashboard, search
  the student by ID or name, then open Schedule / Assignments / Exams /
  Results from their profile.
- Entering results (teacher): open the class/exam from your dashboard,
  select the student, and enter/update the score — changes save
  automatically.
- Report cards: generated per class and per student from the admin
  dashboard.

## Timezone
All schedule, assignment, and exam times are shown in the school's local
time, Kazakhstan time (UTC+5) — not the visitor's device timezone.

## When you don't know the answer
If a question is about something not covered here (billing, a bug, a
specific student's private data, or anything you're not sure about),
say so honestly and tell the user to contact the school office directly
rather than guessing.
`.trim();

// Contact info shown when the AI can't help and needs to hand off to a human.
export const HUMAN_FALLBACK =
  "If this doesn't answer your question, please contact the school office directly.";
