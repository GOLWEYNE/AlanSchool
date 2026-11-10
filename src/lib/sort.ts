// Shared ordering helpers so every list and dropdown in the app is sorted the
// same way: alphabetical (English, Russian and Kazakh letters together) and
// numerical wherever a name contains a number, so class "2B" comes before
// "10A" instead of after it.

// Kazakh first so its own letters (Ә, Ғ, Қ, Ң, Ө, Ұ, Ү, Һ, І) fall where a
// Kazakh reader expects them; Russian and Latin letters sort as usual.
const collator = new Intl.Collator(["kk", "ru", "en"], {
  numeric: true,
  sensitivity: "base",
});

export const compareText = (a?: string | null, b?: string | null): number =>
  collator.compare(a ?? "", b ?? "");

type Person = { name?: string | null; surname?: string | null };

export const comparePeople = (a: Person, b: Person): number =>
  compareText(a.name, b.name) || compareText(a.surname, b.surname);

export const sortByText = <T,>(
  items: T[],
  pick: (item: T) => string | null | undefined
): T[] => [...items].sort((a, b) => compareText(pick(a), pick(b)));

export const sortPeople = <T extends Person>(items: T[]): T[] =>
  [...items].sort(comparePeople);

export const sortClasses = <T extends { name: string }>(items: T[]): T[] =>
  sortByText(items, (c) => c.name);

// Alphabetical paging for people lists. The database sorts by raw character
// code, which misplaces Kazakh letters and mixes capitals with lower case, so
// big lists load only id + names, sort them here, and then fetch the full
// rows for just the requested page (see the students/teachers/parents pages).
export const alphabeticalPageIds = <T extends Person & { id: string }>(
  rows: T[],
  skip: number,
  take: number
): string[] => sortPeople(rows).slice(skip, skip + take).map((r) => r.id);

export const orderByIds = <T extends { id: string }>(items: T[], ids: string[]): T[] => {
  const position = new Map(ids.map((id, i) => [id, i]));
  return [...items].sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0));
};

// Prisma orderBy for people tables: first name, then surname.
export const PEOPLE_ORDER = [{ name: "asc" as const }, { surname: "asc" as const }];

// Sorts the dropdown data handed to the create/edit forms. Only keys that are
// present are touched, so it is safe to call on any form's relatedData.
export const sortRelatedData = <T,>(related: T): T => {
  if (!related || typeof related !== "object") return related;
  const out: any = { ...(related as any) };
  const has = (key: string) => Array.isArray(out[key]);

  if (has("classes")) out.classes = sortByText(out.classes, (c: any) => c.name);
  if (has("subjects")) out.subjects = sortByText(out.subjects, (s: any) => s.name);
  if (has("lessons")) out.lessons = sortByText(out.lessons, (l: any) => l.name);
  if (has("exams")) out.exams = sortByText(out.exams, (e: any) => e.title);
  if (has("assignments")) out.assignments = sortByText(out.assignments, (a: any) => a.title);
  if (has("objectives")) {
    out.objectives = sortByText(out.objectives, (o: any) => (o.code ?? "") + " " + (o.title ?? ""));
  }
  if (has("teachers")) out.teachers = sortPeople(out.teachers);
  if (has("students")) out.students = sortPeople(out.students);
  if (has("grades")) {
    out.grades = [...out.grades].sort((a: any, b: any) => Number(a.level) - Number(b.level));
  }
  return out;
};
