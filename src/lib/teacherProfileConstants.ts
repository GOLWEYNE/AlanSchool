// Client-safe constants and types for the teacher profile. Kept apart from
// teacherProfile.ts, which imports the database client and must stay server-only.

export const POSITIONS = [
  "SUBJECT_TEACHER",
  "CLASS_SUPERVISOR",
  "CLUB_SUPERVISOR",
  "HEAD_OF_DEPARTMENT",
  "DEPUTY_DIRECTOR",
  "DIRECTOR",
  "LIBRARIAN",
  "OTHER",
] as const;
export type PositionKey = (typeof POSITIONS)[number];

export const OBJECTIVE_STATUSES = ["PLANNED", "IN_PROGRESS", "ACHIEVED"] as const;
export type ObjectiveStatus = (typeof OBJECTIVE_STATUSES)[number];

export const TERMS = [1, 2, 3, 4] as const;

export type Achievement = { title: string; year?: number | null; note?: string };
