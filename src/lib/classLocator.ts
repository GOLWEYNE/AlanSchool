import prisma from "./prisma";

// "Class Locator" = the room number of a class. It lives in its own table
// (prisma/migrations/*_add_class_locator) so existing Class queries never
// depend on a new column. The Vercel build does not run migrations, so the
// (additive, idempotent) table is created on first use.

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS "ClassLocator" (
    "classId" INTEGER NOT NULL,
    "roomNumber" TEXT NOT NULL,
    CONSTRAINT "ClassLocator_pkey" PRIMARY KEY ("classId"),
    CONSTRAINT "ClassLocator_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE
)`;

let creating: Promise<void> | null = null;

const createTable = () => {
  creating ??= (async () => {
    try {
      await prisma.$executeRawUnsafe(CREATE_TABLE_SQL);
    } catch (error) {
      creating = null;
      throw error;
    }
  })();
  return creating;
};

const isMissingTableError = (error: unknown) => {
  const code = (error as { code?: string } | null)?.code;
  if (code === "P2021") return true;
  const message = String((error as { message?: string } | null)?.message ?? error);
  return /ClassLocator/.test(message) && /does not exist|42P01/i.test(message);
};

async function withTable<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (!isMissingTableError(error)) throw error;
    await createTable();
    return run();
  }
}

/** classId -> room number for every class that has one. */
export async function getClassRooms(): Promise<Record<number, string>> {
  const rows = await withTable(() =>
    prisma.$queryRaw<{ classId: number; roomNumber: string }[]>`
      SELECT "classId", "roomNumber" FROM "ClassLocator"`
  );
  return Object.fromEntries(rows.map((r) => [r.classId, r.roomNumber]));
}

/** Sets (or, when blank, clears) the room number of one class. */
export async function setClassRoom(classId: number, roomNumber?: string | null) {
  const room = (roomNumber ?? "").trim();
  await withTable(async () => {
    if (!room) {
      await prisma.$executeRaw`DELETE FROM "ClassLocator" WHERE "classId" = ${classId}`;
    } else {
      await prisma.$executeRaw`
        INSERT INTO "ClassLocator" ("classId", "roomNumber") VALUES (${classId}, ${room})
        ON CONFLICT ("classId") DO UPDATE SET "roomNumber" = EXCLUDED."roomNumber"`;
    }
  });
}

/** 1xx -> floor 1, 2xx -> floor 2, 3xxx -> floor 3 (first digit of the room). */
export function floorOfRoom(roomNumber?: string | null): number | null {
  const d = (roomNumber ?? "").trim()[0];
  return d && /[1-9]/.test(d) ? Number(d) : null;
}
