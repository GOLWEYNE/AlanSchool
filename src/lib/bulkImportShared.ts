// Shared (isomorphic - no server-only imports) building blocks for the
// general bulk CSV/Excel import flow (admin -> Students/Teachers/Parents).
// Used by the client-side upload panel (BulkImportPanel.tsx, to parse the
// file and build the template) AND by the server-side validate/commit API
// routes (bulkImportServer.ts) - keeping the column keys, aliases and value
// parsing identical on both sides so what the admin previews is exactly
// what gets committed.

export type BulkImportRole = "student" | "teacher" | "parent";

export const BULK_IMPORT_ROLES: BulkImportRole[] = ["student", "teacher", "parent"];

export const SCHOOL_EMAIL_DOMAIN = "alaninternationalschool.com";

export type FieldSpec = {
  /** Canonical, normalized key (see normalizeHeader). */
  key: string;
  /** Column header written into the downloadable template. */
  header: string;
  required: boolean;
};

// Field order doubles as the template's column order.
export const ROLE_FIELDS: Record<BulkImportRole, FieldSpec[]> = {
  student: [
    { key: "username", header: "Username", required: false },
    { key: "name", header: "First Name", required: true },
    { key: "surname", header: "Last Name", required: true },
    { key: "sex", header: "Sex (M/F)", required: true },
    { key: "birthday", header: "Birthday (YYYY-MM-DD)", required: true },
    { key: "bloodtype", header: "Blood Type", required: true },
    { key: "class", header: "Class", required: true },
    { key: "parentusername", header: "Parent Username", required: true },
    { key: "email", header: "Email", required: false },
    { key: "phone", header: "Phone", required: false },
    { key: "address", header: "Address", required: false },
  ],
  teacher: [
    { key: "username", header: "Username", required: false },
    { key: "name", header: "First Name", required: true },
    { key: "surname", header: "Last Name", required: true },
    { key: "sex", header: "Sex (M/F)", required: true },
    { key: "birthday", header: "Birthday (YYYY-MM-DD)", required: true },
    { key: "bloodtype", header: "Blood Type", required: true },
    { key: "subjects", header: "Subjects (comma-separated)", required: false },
    { key: "email", header: "Email", required: false },
    { key: "phone", header: "Phone", required: false },
    { key: "address", header: "Address", required: false },
  ],
  parent: [
    { key: "username", header: "Username", required: false },
    { key: "name", header: "First Name", required: true },
    { key: "surname", header: "Last Name", required: true },
    { key: "phone", header: "Phone", required: true },
    { key: "address", header: "Address", required: true },
    { key: "email", header: "Email", required: false },
  ],
};

// Extra header spellings (English + Russian) recognized on upload, beyond
// each field's own template header text - so a spreadsheet exported from
// another system, or with Cyrillic column names, still maps correctly.
const EXTRA_ALIASES: Record<string, string[]> = {
  username: ["login", "имяпользователя", "логин"],
  name: ["firstname", "имя"],
  surname: ["lastname", "familyname", "фамилия"],
  sex: ["gender", "пол"],
  birthday: ["dob", "dateofbirth", "датарождения", "деньрождения"],
  bloodtype: ["blood", "bloodgroup", "группакрови"],
  class: ["classname", "класс"],
  parentusername: ["parent", "parentlogin", "родитель", "логинродителя"],
  email: ["mail", "почта", "электроннаяпочта"],
  phone: ["telephone", "phonenumber", "телефон"],
  address: ["адрес"],
  subjects: ["subject", "предметы", "предмет"],
};

/** Strips everything but letters/digits and lowercases - so "First Name",
 * "first_name" and "firstname" all normalize the same way. Covers Latin and
 * Cyrillic (incl. the extra Kazakh letters) without needing the regex `u`
 * flag, which the project's tsconfig target doesn't allow. */
export const normalizeHeader = (raw: string): string =>
  raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яёәғқңөұүі]+/g, "");

const ALIAS_TO_KEY: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const fields of Object.values(ROLE_FIELDS)) {
    for (const f of fields) {
      map[normalizeHeader(f.key)] = f.key;
      map[normalizeHeader(f.header)] = f.key;
    }
  }
  for (const [key, aliases] of Object.entries(EXTRA_ALIASES)) {
    for (const alias of aliases) {
      map[normalizeHeader(alias)] = key;
    }
  }
  return map;
})();

/** Maps a raw column header (any recognized spelling) to its canonical
 * field key, or null if the column isn't one this importer understands. */
export const resolveHeaderKey = (rawHeader: string): string | null =>
  ALIAS_TO_KEY[normalizeHeader(rawHeader)] ?? null;

export type RawImportRow = Record<string, unknown>;

const asText = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
};

export const readField = (row: RawImportRow, key: string): string => asText(row[key]);

export type SexValue = "MALE" | "FEMALE";

export function parseSexValue(raw: unknown): SexValue | null {
  const v = asText(raw).toLowerCase();
  if (["m", "male", "м", "муж", "мальчик", "boy"].includes(v)) return "MALE";
  if (["f", "female", "ж", "жен", "девочка", "girl"].includes(v)) return "FEMALE";
  return null;
}

/** Accepts a real Date (from an Excel date cell), ISO "YYYY-MM-DD", or the
 * common Kazakhstani "DD.MM.YYYY" / "DD/MM/YYYY" written form. Returns a
 * UTC-midnight Date (matching how birthdays are stored elsewhere in the
 * app) or null if nothing recognizable was given. */
export function parseBirthdayValue(raw: unknown): Date | null {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return new Date(Date.UTC(raw.getFullYear(), raw.getMonth(), raw.getDate()));
  }
  const v = asText(raw);
  if (!v) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (iso) {
    const [, y, m, d] = iso;
    const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const dotted = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(v);
  if (dotted) {
    const [, d, m, y] = dotted;
    const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

export function parseEmailValue(raw: unknown): string | null {
  const v = asText(raw);
  if (!v) return "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null;
}

export function splitSubjectNames(raw: unknown): string[] {
  return asText(raw)
    .split(/[,;/]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const TRANSLIT: Record<string, string> = {
  а: "a", ә: "a", б: "b", в: "v", г: "g", ғ: "g", д: "d", е: "e", ё: "yo",
  ж: "zh", з: "z", и: "i", й: "i", к: "k", қ: "q", л: "l", м: "m", н: "n",
  ң: "n", о: "o", ө: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ұ: "u",
  ү: "u", ф: "f", х: "h", һ: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", і: "i", ь: "", э: "e", ю: "yu", я: "ya",
};

export function transliterate(text: string): string {
  return text
    .toLowerCase()
    .split("")
    .map((ch) => (ch in TRANSLIT ? TRANSLIT[ch] : ch))
    .join("")
    .replace(/[^a-z0-9]+/g, "");
}

/** Base username candidate from a first/last name - the caller is
 * responsible for de-duplicating against existing + in-batch usernames. */
export function slugifyUsername(first: string, last: string): string {
  const base = `${transliterate(first)}_${transliterate(last)}`.replace(/^_+|_+$/g, "");
  return base.length >= 3 ? base : `${base || "user"}${Math.floor(Math.random() * 900 + 100)}`;
}

export type IssueCode =
  | "required"
  | "invalidSex"
  | "invalidBirthday"
  | "invalidEmail"
  | "unknownClass"
  | "classFull"
  | "unknownParent"
  | "unknownSubject"
  | "duplicateUsername"
  | "duplicateEmail"
  | "duplicatePhone";

export type RowIssue = {
  code: IssueCode;
  field?: string;
  value?: string;
  /** true = blocks the row from being imported; false = informational only. */
  blocking: boolean;
};

export type RowPreview = Record<string, string>;

export type RowResult = {
  row: number; // 1-based row number within the uploaded data (header excluded)
  status: "ready" | "error";
  preview: RowPreview;
  issues: RowIssue[];
};

// The template always ships one example row so the expected shape is
// obvious in Excel/Sheets - callers should replace or delete it.
export const TEMPLATE_EXAMPLES: Record<BulkImportRole, string[]> = {
  student: ["", "АЙГЕРІМ", "ЕРМЕКОВА", "F", "2016-03-14", "O+", "5A", "parent1011", "", "", ""],
  teacher: ["", "ЕРЛАН", "ТӨЛЕГЕНОВ", "M", "1990-07-02", "A+", "Mathematics, Algebra", "", "", ""],
  parent: ["", "Parent", "1099", "9001234567", "N/A", ""],
};
