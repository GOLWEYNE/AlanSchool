import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { getUserRole } from "@/lib/auth";

export const maxDuration = 60;

// One-off, idempotent, admin-only endpoint.
//
// Grades 0 and 1 (classes 0A/0B/0C and 1A-1G/1AR/1BR - 12 classes total)
// have real supervisors and lessons already set up but zero students,
// unlike every other grade in the school. This fills each of those 12
// classes up to its own `capacity` with realistic Kazakh-style student
// records, matching the naming conventions already used across the other
// ~579 students (UPPERCASE Cyrillic name/surname, transliterated
// `firstname_surname` username, `${username}@alaninternationalschool.com`
// email).
//
// Like /api/admin/split-paula-overflow-into-parents, these are
// database-only records with no Clerk login - the same pattern already
// used for other bulk/placeholder rows in this database. Skipping Clerk
// means this migration doesn't bulk-create ~170 real authentication
// accounts; it only adds the roster data (names, class/grade placement)
// the report cards and class lists need to render. Every new student is
// attached to a dedicated placeholder parent, capped at 3 students per
// parent (continuing the school's existing parentNNNN numbering
// convention), per the same rule established when the Paula-overflow
// students were split up.
//
// Safe to call repeatedly: for every target class it only tops up the
// gap between current enrollment and that class's capacity, so a second
// call is a no-op (added: 0) once all 12 classes are full.

const TARGET_CLASS_NAMES = [
  "0A",
  "0B",
  "0C",
  "1A",
  "1B",
  "1C",
  "1D",
  "1E",
  "1F",
  "1G",
  "1AR",
  "1BR",
];

const MAX_STUDENTS_PER_PLACEHOLDER_PARENT = 3;

const MALE_FIRST = [
  "АЛИХАН", "ЕРЛАН", "ДАНИЯР", "ТІМУР", "АРМАН", "НҰРСҰЛТАН", "АЙДОС",
  "ЕРБОЛ", "ЖАСҰЛАН", "ТАЛГАТ", "БЕКЗАТ", "САНЖАР", "АЙБЕК", "ДӘУЛЕТ",
  "НҰРЛАН", "ЕРЖАН", "АСХАТ", "БАУЫРЖАН", "ДИАС", "РУСЛАН", "ЖАНАТ",
  "МҰРАТ", "ЕРЛИК", "АЗАМАТ", "ЖАНДОС", "ТЕМІРЛАН", "ӘДІЛЕТ", "СЕРІК",
  "ҚАЙРАТ", "НҰРЖАН",
];

const FEMALE_FIRST = [
  "АЙГЕРІМ", "ДІНАРА", "ЖАНАР", "ГҮЛНАРА", "ӘЙГЕРІМ", "ІНКАР", "САБИНА",
  "АЛУА", "ЖАСМИН", "АЙША", "ІНЖУ", "МӨЛДІР", "ГҮЛДЕР", "ЗЕРЕ", "АЙЖАН",
  "ЕРКЕЖАН", "ДАНА", "АЙНҰР", "СӘУЛЕ", "БОТАГӨЗ", "КАМИЛА", "ТОҒЖАН",
  "АРУЖАН", "ШЫНАР", "ЖІБЕК", "ЛЕЙЛА", "ДІЛНАЗ", "АЙЗЕРЕ", "НАЗЕРКЕ",
  "ЭЛЬМИРА",
];

const MALE_LAST = [
  "ЕРМЕКҰЛЫ", "ТӨЛЕУҰЛЫ", "ЖҰМАБЕКОВ", "ӘБДІРАХМАНОВ", "СЕЙІТҚАЛИЕВ",
  "ТӨЛЕГЕНОВ", "БАЙМҰРАТОВ", "ҚҰТТЫБАЙҰЛЫ", "ТАСБҰЛАТОВ", "ДӘУЛЕТОВ",
  "ҚАЛИЕВ", "НҰРЖАНҰЛЫ", "БЕКЖАНОВ", "МЕЙРЖАНҰЛЫ", "ӘЛІМБЕКОВ",
  "ЖАҚСЫБЕКОВ", "ИСАБЕКОВ", "СМАҒҰЛОВ", "ОРАЗБЕКОВ", "ТӨЛЕПБЕРГЕНОВ",
  "ҚАСЫМОВ", "ЖАНДОСҰЛЫ", "БАЙТАСОВ", "СӘРСЕНБАЕВ", "ШӘКЕНОВ",
  "ТӨЛЕУБАЕВ", "ҚОЖАХМЕТОВ", "ЕСЖАНОВ", "БЕЙСЕНОВ", "ДӘРМЕНОВ",
];

const FEMALE_LAST = [
  "ЕРМЕКҚЫЗЫ", "ТӨЛЕУҚЫЗЫ", "ЖҰМАБЕКОВА", "ӘБДІРАХМАНОВА", "СЕЙІТҚАЛИЕВА",
  "ТӨЛЕГЕНОВА", "БАЙМҰРАТОВА", "ҚҰТТЫБАЕВА", "ТАСБҰЛАТОВА", "ДӘУЛЕТОВА",
  "ҚАЛИЕВА", "НҰРЖАНҚЫЗЫ", "БЕКЖАНОВА", "МЕЙРЖАНҚЫЗЫ", "ӘЛІМБЕКОВА",
  "ЖАҚСЫБЕКОВА", "ИСАБЕКОВА", "СМАҒҰЛОВА", "ОРАЗБЕКОВА", "ТӨЛЕПБЕРГЕНОВА",
  "ҚАСЫМОВА", "ЖАНДОСҚЫЗЫ", "БАЙТАСОВА", "СӘРСЕНБАЕВА", "ШӘКЕНОВА",
  "ТӨЛЕУБАЕВА", "ҚОЖАХМЕТОВА", "ЕСЖАНОВА", "БЕЙСЕНОВА", "ДӘРМЕНОВА",
];

const BLOOD_TYPES = ["O+", "A+", "B+", "AB+", "O-", "A-", "B-", "AB-"];

const TRANSLIT: Record<string, string> = {
  а: "a", ә: "a", б: "b", в: "v", г: "g", ғ: "g", д: "d", е: "e", ё: "yo",
  ж: "zh", з: "z", и: "i", й: "i", к: "k", қ: "q", л: "l", м: "m", н: "n",
  ң: "n", о: "o", ө: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ұ: "u",
  ү: "u", ф: "f", х: "h", һ: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", і: "i", ь: "", э: "e", ю: "yu", я: "ya",
};

function transliterate(cyrillic: string): string {
  return cyrillic
    .toLowerCase()
    .split("")
    .map((ch) => (ch in TRANSLIT ? TRANSLIT[ch] : ch))
    .join("")
    .replace(/[^a-z0-9]/g, "");
}

// Grade 0 (kindergarten/prep) students are ~5 on Sept 1; Grade 1 students
// are ~6-7. School year starts September, so pick a birthday inside the
// matching age band for the given grade level.
function birthdayForGrade(level: number, seed: number): Date {
  const ageAtIntake = level === 0 ? 5 : 6;
  const today = new Date();
  const birthYear = today.getFullYear() - ageAtIntake;
  const month = (seed % 12) + 1;
  const day = (seed % 27) + 1;
  return new Date(Date.UTC(birthYear, month - 1, day));
}

type NamePair = { first: string; last: string; sex: "MALE" | "FEMALE" };

function buildNamePool(): NamePair[] {
  const pool: NamePair[] = [];
  for (let i = 0; i < MALE_FIRST.length; i++) {
    for (let j = 0; j < MALE_LAST.length; j++) {
      pool.push({ first: MALE_FIRST[i], last: MALE_LAST[j], sex: "MALE" });
    }
  }
  for (let i = 0; i < FEMALE_FIRST.length; i++) {
    for (let j = 0; j < FEMALE_LAST.length; j++) {
      pool.push({ first: FEMALE_FIRST[i], last: FEMALE_LAST[j], sex: "FEMALE" });
    }
  }
  // Deterministic shuffle (fixed seed) so repeated calls draw names in the
  // same order - keeps the endpoint's output stable/idempotent-friendly.
  let seed = 42;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

async function nextParentNumber(): Promise<number> {
  const existing = await prisma.parent.findMany({
    where: { username: { startsWith: "parent" } },
    select: { username: true },
  });
  let max = 1010;
  for (const p of existing) {
    const m = /^parent(\d+)$/.exec(p.username);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return max + 1;
}

export async function POST() {
  const { sessionClaims } = auth();
  const role = getUserRole(sessionClaims);

  if (role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const [existingUsernames, existingEmails]: [
    { username: string }[],
    { email: string | null }[]
  ] = await Promise.all([
    prisma.student.findMany({ select: { username: true } }),
    prisma.student.findMany({ select: { email: true } }),
  ]);
  const usedUsernames = new Set(
    existingUsernames.map((s: { username: string }) => s.username)
  );
  const usedEmails = new Set(
    existingEmails
      .map((s: { email: string | null }) => s.email)
      .filter((e: string | null): e is string => !!e)
  );

  const namePool = buildNamePool();
  let nameCursor = 0;
  const nextName = (): NamePair => {
    while (nameCursor < namePool.length) {
      const candidate = namePool[nameCursor++];
      const username = `${transliterate(candidate.first)}_${transliterate(
        candidate.last
      )}`;
      if (!usedUsernames.has(username)) {
        return candidate;
      }
    }
    throw new Error("Ran out of unique names in the pool");
  };

  let nextParentNum = await nextParentNumber();
  let currentPlaceholderParentId: string | null = null;
  let currentPlaceholderParentCount = 0;

  async function getPlaceholderParentId(): Promise<string> {
    if (
      currentPlaceholderParentId &&
      currentPlaceholderParentCount < MAX_STUDENTS_PER_PLACEHOLDER_PARENT
    ) {
      currentPlaceholderParentCount += 1;
      return currentPlaceholderParentId;
    }
    const number = nextParentNum++;
    const username = `parent${number}`;
    const id = `parent_${number}`;
    await prisma.parent.create({
      data: {
        id,
        username,
        name: "Parent",
        surname: String(number),
        email: `${username}@alaninternationalschool.com`,
        phone: `90${String(number).padStart(8, "0")}`,
        address: "N/A",
      },
    });
    currentPlaceholderParentId = id;
    currentPlaceholderParentCount = 1;
    return id;
  }

  const summary: {
    className: string;
    before: number;
    capacity: number;
    added: number;
    createdStudents: { username: string; name: string }[];
  }[] = [];
  const errors: { className: string; error: string }[] = [];

  for (const className of TARGET_CLASS_NAMES) {
    const classRow = await prisma.class.findUnique({
      where: { name: className },
      include: { grade: true, _count: { select: { students: true } } },
    });

    if (!classRow) {
      errors.push({ className, error: "Class not found" });
      continue;
    }

    const before = classRow._count.students;
    const needed = classRow.capacity - before;
    const createdStudents: { username: string; name: string }[] = [];

    for (let i = 0; i < needed; i++) {
      try {
        const namePair = nextName();
        const username = `${transliterate(namePair.first)}_${transliterate(
          namePair.last
        )}`;
        const email = `${username}@alaninternationalschool.com`;
        if (usedEmails.has(email)) {
          continue;
        }

        const parentId = await getPlaceholderParentId();
        const seed = before + i + classRow.id * 31;

        await prisma.student.create({
          data: {
            id: username,
            username,
            name: namePair.first,
            surname: namePair.last,
            email,
            phone: null,
            address: "N/A",
            bloodType: BLOOD_TYPES[seed % BLOOD_TYPES.length],
            sex: namePair.sex,
            birthday: birthdayForGrade(classRow.grade.level, seed),
            gradeId: classRow.gradeId,
            classId: classRow.id,
            parentId,
          },
        });

        usedUsernames.add(username);
        usedEmails.add(email);
        createdStudents.push({ username, name: `${namePair.first} ${namePair.last}` });
      } catch (err) {
        console.log("seed-grade0-1-students error in class", className, err);
        errors.push({ className, error: String(err) });
      }
    }

    summary.push({
      className,
      before,
      capacity: classRow.capacity,
      added: createdStudents.length,
      createdStudents,
    });
  }

  return NextResponse.json({
    totalAdded: summary.reduce((sum, s) => sum + s.added, 0),
    summary,
    errors,
  });
}
