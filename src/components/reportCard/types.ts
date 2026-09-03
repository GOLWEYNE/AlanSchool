// Shared data contract for the modern report card view. This is fully
// generic — every field is populated per-student by the page loader at
// src/app/dashboard/list/report-cards/[id]/page.tsx, so the exact same
// components render a beautiful, correct report card for ANY student in
// the school, not just a hardcoded example.

export type ReportCardResultRow = {
  id: string;
  subject: string;
  assessment: string;
  type: "Exam" | "Assignment";
  score: number;
};

export type BehaviorEntryType = "POSITIVE" | "CONCERN" | "INCIDENT";

export type ReportCardBehaviorEntry = {
  id: number;
  type: BehaviorEntryType;
  title: string;
  description: string;
  date: Date;
};

export type AttendanceBreakdown = {
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
};

export type ReportCardViewData = {
  reportCardId: number;
  studentId: string;
  studentName: string;
  studentUsername: string;
  studentImg: string | null;
  className: string;
  gradeLevel?: number;
  term: string;
  termLabel: string;
  schoolYear: string;
  gpa: number | null;
  attendanceRate: number | null;
  attendanceBreakdown: AttendanceBreakdown;
  results: ReportCardResultRow[];
  behaviorLogs: ReportCardBehaviorEntry[];
  generatedAt: Date;
  pdfHref: string;
};

export type MilestoneLevel = "exceeding" | "meeting" | "inProgress";

// Singapore Math-style Concrete-Pictorial-Abstract milestone bands. Scores
// are stored 0-100 across the app (see buildReportCardForStudent), so the
// thresholds below are simple percentage bands rather than a letter scale.
export const getMilestone = (score: number): MilestoneLevel => {
  if (score >= 85) return "exceeding";
  if (score >= 70) return "meeting";
  return "inProgress";
};

export const MILESTONE_LABEL: Record<MilestoneLevel, string> = {
  exceeding: "Exceeding",
  meeting: "Meeting",
  inProgress: "In Progress",
};
