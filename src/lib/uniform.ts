// Shared constants and helpers for the uniform-check feature.
// Kept out of uniformActions.ts because "use server" files may only export async functions.

export const UNIFORM_STATUSES = ["FULL", "PARTIAL", "NONE"] as const;
export type UniformStatusKey = (typeof UNIFORM_STATUSES)[number];

export const UNIFORM_ITEMS = [
  { key: "shirt", label: "Shirt" },
  { key: "bottoms", label: "Trousers / skirt" },
  { key: "jacket", label: "Jacket" },
  { key: "tie", label: "Tie" },
  { key: "shoes", label: "Shoes" },
  { key: "badge", label: "School badge" },
] as const;

export const UNIFORM_ITEM_KEYS: string[] = UNIFORM_ITEMS.map((i) => i.key);

export const STATUS_LABEL: Record<UniformStatusKey, string> = {
  FULL: "Full uniform",
  PARTIAL: "Partial",
  NONE: "No uniform",
};

// Number of non-compliant days inside the last 7 days that flags a student.
export const REPEAT_THRESHOLD = 3;

const SCHOOL_TZ = "Asia/Almaty";

// Today's calendar date at the school, as YYYY-MM-DD.
export function schoolToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: SCHOOL_TZ }).format(new Date());
}

export function isValidDateStr(value: string | undefined | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + "T00:00:00Z"));
}

// Midnight UTC of the given day - matches a Postgres DATE column.
export function toDbDate(value: string): Date {
  return new Date(value + "T00:00:00.000Z");
}

export function addDays(value: string, days: number): string {
  const d = toDbDate(value);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function itemLabel(key: string): string {
  return UNIFORM_ITEMS.find((i) => i.key === key)?.label ?? key;
}
