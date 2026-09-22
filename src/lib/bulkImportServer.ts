import crypto from "crypto";
import prisma from "@/lib/prisma";
import { clerkClient } from "@clerk/nextjs/server";
import {
  BulkImportRole,
  RawImportRow,
  ROLE_FIELDS,
  RowIssue,
  RowPreview,
  RowResult,
  SCHOOL_EMAIL_DOMAIN,
  parseBirthdayValue,
  parseEmailValue,
  parseSexValue,
  readField,
  slugifyUsername,
  splitSubjectNames,
} from "@/lib/bulkImportShared";

// Server-side validation + commit for the general bulk CSV/Excel import
// flow. Two-step by design (mirrors the "preview before committing" ask):
//   validateRows() is read-only - it never touches Clerk or writes to the
//     database, so the admin can upload, review and re-upload freely.
//   commitRows() only ever processes rows the client got back as "ready"
//     from validateRows() (re-validated here in case the database changed
//     in between), in caller-sized batches so a large sheet doesn't risk
//     the serverless function's time limit.

const issue = (code: RowIssue["code"], blocking: boolean, field?: string, value?: string): RowIssue => ({
  code,
  blocking,
  ...(field ? { field } : {}),
  ...(value ? { value } : {}),
});

/** The exact payload commitRows() needs for one row - produced by
 * validateRows() and round-tripped by the client unchanged. */
export type CommitRow = {
  row: number;
  username: string;
  name: string;
  surname: string;
  email: string | null;
  phone: string | null;
  address: string;
  bloodType?: string;
  sex?: "MALE" | "FEMALE";
  birthday?: string; // ISO date
  classId?: number;
  parentId?: string;
  subjectIds?: number[];
};

export type CommitOutcome = {
  row: number;
  status: "created" | "failed";
  username?: string;
  password?: string;
  error?: string;
};

export async function validateRows(
  role: BulkImportRole,
  rows: RawImportRow[]
): Promise<{ results: RowResult[]; commits: CommitRow[] }> {
  const fields = ROLE_FIELDS[role];

  const [students, teachers, parents] = await Promise.all([
    prisma.student.findMany({ select: { username: true, email: true, phone: true } }),
    prisma.teacher.findMany({ select: { username: true, email: true, phone: true } }),
    prisma.parent.findMany({ select: { id: true, username: true, email: true, phone: true } }),
  ]);

  const usedUsernames = new Set(
    [...students, ...teachers, ...parents].map((r) => r.username.toLowerCase())
  );
  const usedEmails = new Set(
    [...students, ...teachers, ...parents]
      .map((r) => r.email)
      .filter((e): e is string => !!e)
      .map((e) => e.toLowerCase())
  );
  const usedPhones = new Set(
    [...students, ...teachers, ...parents]
      .map((r) => r.phone)
      .filter((p): p is string => !!p)
  );
  const parentByUsername = new Map(parents.map((p) => [p.username.toLowerCase(), p.id]));

  let classesByName: Map<string, { id: number; capacityLeft: number }> | null = null;
  let subjectsByName: Map<string, number> | null = null;

  if (role === "student") {
    const classes = await prisma.class.findMany({
      select: { id: true, name: true, capacity: true, _count: { select: { students: true } } },
    });
    classesByName = new Map(
      classes.map((c) => [c.name.toLowerCase(), { id: c.id, capacityLeft: c.capacity - c._count.students }])
    );
  }

  if (role === "teacher") {
    const subjects = await prisma.subject.findMany({ select: { id: true, name: true } });
    subjectsByName = new Map(subjects.map((s) => [s.name.toLowerCase(), s.id]));
  }

  const results: RowResult[] = [];
  const commits: CommitRow[] = [];

  rows.forEach((raw, idx) => {
    const rowNumber = idx + 1;
    const issues: RowIssue[] = [];
    const preview: RowPreview = {};

    for (const f of fields) {
      const val = readField(raw, f.key);
      if (f.required && !val && f.key !== "username" && f.key !== "email") {
        issues.push(issue("required", true, f.key));
      }
    }

    const name = readField(raw, "name");
    const surname = readField(raw, "surname");
    preview.name = name;
    preview.surname = surname;

    let username = readField(raw, "username");
    if (!username) {
      let base = slugifyUsername(name || "student", surname || String(rowNumber));
      let candidate = base;
      let suffix = 2;
      while (usedUsernames.has(candidate.toLowerCase())) {
        candidate = `${base}${suffix++}`;
      }
      username = candidate;
    } else if (usedUsernames.has(username.toLowerCase())) {
      issues.push(issue("duplicateUsername", true, "username", username));
    }
    usedUsernames.add(username.toLowerCase());
    preview.username = username;

    const emailRaw = readField(raw, "email");
    let email: string | null;
    if (!emailRaw) {
      email = `${username}@${SCHOOL_EMAIL_DOMAIN}`;
    } else {
      const parsed = parseEmailValue(emailRaw);
      if (parsed === null) {
        issues.push(issue("invalidEmail", true, "email", emailRaw));
        email = null;
      } else {
        email = parsed;
      }
    }
    if (email) {
      if (usedEmails.has(email.toLowerCase())) {
        issues.push(issue("duplicateEmail", true, "email", email));
      }
      usedEmails.add(email.toLowerCase());
    }
    preview.email = email ?? emailRaw;

    // Missing-but-required phone/address (parent role) is already flagged
    // by the generic required-fields loop above.
    const phoneRaw = readField(raw, "phone");
    const phone: string | null = phoneRaw || null;
    if (phone) {
      if (usedPhones.has(phone)) {
        issues.push(issue("duplicatePhone", true, "phone", phone));
      }
      usedPhones.add(phone);
    }
    preview.phone = phone ?? "";

    const address = readField(raw, "address");
    preview.address = address;

    const commit: CommitRow = {
      row: rowNumber,
      username,
      name,
      surname,
      email,
      phone,
      address,
    };

    if (role === "student" || role === "teacher") {
      // Blank sex/birthday is already flagged as "required" above - only
      // add an "invalid" issue when something was actually typed in but
      // couldn't be understood, so a blank cell doesn't show two issues.
      const sexRaw = readField(raw, "sex");
      const sex = parseSexValue(sexRaw);
      if (!sex && sexRaw) {
        issues.push(issue("invalidSex", true, "sex", sexRaw));
      } else if (sex) {
        commit.sex = sex;
      }
      preview.sex = sex ?? sexRaw;

      const birthdayRaw = readField(raw, "birthday");
      const birthday = parseBirthdayValue(raw["birthday"] ?? birthdayRaw);
      if (!birthday && birthdayRaw) {
        issues.push(issue("invalidBirthday", true, "birthday", birthdayRaw));
      } else if (birthday) {
        commit.birthday = birthday.toISOString();
      }
      preview.birthday = birthday ? birthday.toISOString().slice(0, 10) : birthdayRaw;

      const bloodType = readField(raw, "bloodtype");
      commit.bloodType = bloodType;
      preview.bloodType = bloodType;
    }

    if (role === "student") {
      const className = readField(raw, "class");
      preview.class = className;
      const classEntry = classesByName?.get(className.toLowerCase());
      if (!className) {
        // already flagged as required above
      } else if (!classEntry) {
        issues.push(issue("unknownClass", true, "class", className));
      } else if (classEntry.capacityLeft <= 0) {
        issues.push(issue("classFull", true, "class", className));
      } else {
        classEntry.capacityLeft -= 1;
        commit.classId = classEntry.id;
      }

      const parentUsername = readField(raw, "parentusername");
      preview.parentUsername = parentUsername;
      if (!parentUsername) {
        // already flagged as required above
      } else {
        const parentId = parentByUsername.get(parentUsername.toLowerCase());
        if (!parentId) {
          issues.push(issue("unknownParent", true, "parentusername", parentUsername));
        } else {
          commit.parentId = parentId;
        }
      }
    }

    if (role === "teacher") {
      const subjectNames = splitSubjectNames(readField(raw, "subjects"));
      const ids: number[] = [];
      const unknown: string[] = [];
      for (const s of subjectNames) {
        const id = subjectsByName?.get(s.toLowerCase());
        if (id) ids.push(id);
        else unknown.push(s);
      }
      commit.subjectIds = ids;
      preview.subjects = subjectNames.join(", ");
      for (const u of unknown) {
        issues.push(issue("unknownSubject", false, "subjects", u));
      }
    }

    const blocking = issues.some((i) => i.blocking);
    results.push({ row: rowNumber, status: blocking ? "error" : "ready", preview, issues });
    if (!blocking) commits.push(commit);
  });

  return { results, commits };
}

function generateTempPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const pick = (s: string) => s[crypto.randomInt(s.length)];
  let pw = pick(upper) + pick(upper);
  for (let i = 0; i < 5; i++) pw += pick(lower);
  pw += pick(digits) + pick(digits) + "!";
  return pw;
}

export async function commitRows(role: BulkImportRole, rows: CommitRow[]): Promise<CommitOutcome[]> {
  const outcomes: CommitOutcome[] = [];

  // Re-check uniqueness against the database right before writing - the
  // preview may be stale if another import batch or admin action ran
  // in between validate and commit.
  const [students, teachers, parents] = await Promise.all([
    prisma.student.findMany({ select: { username: true, email: true, phone: true } }),
    prisma.teacher.findMany({ select: { username: true, email: true, phone: true } }),
    prisma.parent.findMany({ select: { username: true, email: true, phone: true } }),
  ]);
  const usedUsernames = new Set(
    [...students, ...teachers, ...parents].map((r) => r.username.toLowerCase())
  );
  const usedEmails = new Set(
    [...students, ...teachers, ...parents].map((r) => r.email).filter((e): e is string => !!e).map((e) => e.toLowerCase())
  );
  const usedPhones = new Set(
    [...students, ...teachers, ...parents].map((r) => r.phone).filter((p): p is string => !!p)
  );

  for (const row of rows) {
    if (usedUsernames.has(row.username.toLowerCase())) {
      outcomes.push({ row: row.row, status: "failed", error: "duplicateUsername" });
      continue;
    }
    if (row.email && usedEmails.has(row.email.toLowerCase())) {
      outcomes.push({ row: row.row, status: "failed", error: "duplicateEmail" });
      continue;
    }
    if (row.phone && usedPhones.has(row.phone)) {
      outcomes.push({ row: row.row, status: "failed", error: "duplicatePhone" });
      continue;
    }

    const password = generateTempPassword();

    try {
      const user = await clerkClient.users.createUser({
        username: row.username,
        password,
        firstName: row.name,
        lastName: row.surname,
        publicMetadata: { role },
      });

      try {
        if (role === "student") {
          if (!row.classId || !row.parentId || !row.sex || !row.birthday) {
            throw new Error("Missing resolved student fields");
          }
          const classRow = await prisma.class.findUnique({
            where: { id: row.classId },
            include: { _count: { select: { students: true } } },
          });
          if (!classRow || classRow._count.students >= classRow.capacity) {
            throw new Error("Class is now full");
          }
          await prisma.student.create({
            data: {
              id: user.id,
              username: row.username,
              name: row.name,
              surname: row.surname,
              email: row.email || null,
              phone: row.phone || null,
              address: row.address,
              bloodType: row.bloodType || "",
              sex: row.sex,
              birthday: new Date(row.birthday),
              gradeId: classRow.gradeId,
              classId: row.classId,
              parentId: row.parentId,
            },
          });
        } else if (role === "teacher") {
          if (!row.sex || !row.birthday) {
            throw new Error("Missing resolved teacher fields");
          }
          await prisma.teacher.create({
            data: {
              id: user.id,
              username: row.username,
              name: row.name,
              surname: row.surname,
              email: row.email || null,
              phone: row.phone || null,
              address: row.address,
              bloodType: row.bloodType || "",
              sex: row.sex,
              birthday: new Date(row.birthday),
              subjects: { connect: (row.subjectIds ?? []).map((id) => ({ id })) },
            },
          });
        } else {
          if (!row.phone) {
            throw new Error("Missing parent phone");
          }
          await prisma.parent.create({
            data: {
              id: user.id,
              username: row.username,
              name: row.name,
              surname: row.surname,
              email: row.email || null,
              phone: row.phone,
              address: row.address,
            },
          });
        }
      } catch (dbErr) {
        // Roll back the Clerk account so a DB-side failure doesn't leave an
        // orphaned login with no matching school record.
        try {
          await clerkClient.users.deleteUser(user.id);
        } catch {
          // best effort
        }
        throw dbErr;
      }

      usedUsernames.add(row.username.toLowerCase());
      if (row.email) usedEmails.add(row.email.toLowerCase());
      if (row.phone) usedPhones.add(row.phone);

      outcomes.push({ row: row.row, status: "created", username: row.username, password });
    } catch (err) {
      console.log("bulk import commit error for row", row.row, err);
      outcomes.push({ row: row.row, status: "failed", error: String(err instanceof Error ? err.message : err) });
    }
  }

  return outcomes;
}
