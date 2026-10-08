// Constants and pure helpers for the school library. Safe to import from both
// server and client components (no server-only imports here).

export const BOOK_CATEGORIES = ["TEXTBOOK", "FICTION", "OTHER"] as const;
export type BookCategory = (typeof BOOK_CATEGORIES)[number];

export const CATEGORY_EMOJI: Record<BookCategory, string> = {
  TEXTBOOK: "📘",
  FICTION: "📖",
  OTHER: "📚",
};

// Default number of days a book can be kept.
export const LOAN_DAYS = 14;

// Reading badges are earned from the number of finished (returned) non-textbook books.
export const BADGE_TIERS = [
  { key: "b1", min: 1, emoji: "🌱" },
  { key: "b5", min: 5, emoji: "📖" },
  { key: "b10", min: 10, emoji: "🦉" },
  { key: "b20", min: 20, emoji: "🚀" },
  { key: "b50", min: 50, emoji: "👑" },
] as const;

export function earnedBadges(booksRead: number) {
  return BADGE_TIERS.filter((b) => booksRead >= b.min);
}

export function nextBadge(booksRead: number) {
  return BADGE_TIERS.find((b) => booksRead < b.min) ?? null;
}

// The school runs on UTC+5 (see lib/schoolTime.ts).
const OFFSET_MS = 5 * 60 * 60 * 1000;

// Start (as a real instant) of the school-time month that contains `now`.
export function schoolMonthStart(now: Date = new Date(), monthsBack = 0): Date {
  const local = new Date(now.getTime() + OFFSET_MS);
  const start = Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - monthsBack, 1);
  return new Date(start - OFFSET_MS);
}

// "2026-10" style key of the school-time month an instant falls in.
export function schoolMonthKey(d: Date): string {
  const local = new Date(d.getTime() + OFFSET_MS);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Monday-based week number key used for reading streaks.
export function schoolWeekIndex(d: Date): number {
  const local = new Date(d.getTime() + OFFSET_MS);
  const dayMs = 24 * 60 * 60 * 1000;
  // 1970-01-05 was a Monday.
  return Math.floor((Math.floor(local.getTime() / dayMs) - 4) / 7);
}

// Consecutive weeks (ending this week or last week) in which the student finished a book.
export function weekStreak(dates: Date[], now: Date = new Date()): number {
  const weeks = new Set(dates.map(schoolWeekIndex));
  let w = schoolWeekIndex(now);
  if (!weeks.has(w)) w -= 1;
  let streak = 0;
  while (weeks.has(w)) {
    streak += 1;
    w -= 1;
  }
  return streak;
}

export function clamp(value: string | null | undefined, max: number): string {
  return (value ?? "").trim().slice(0, max);
}
