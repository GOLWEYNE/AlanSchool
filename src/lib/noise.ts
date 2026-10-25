import prisma from "@/lib/prisma";
import { NOISE_DDL } from "@/lib/noiseDdl";
import { teacherCanAccessClass } from "@/lib/teacherScope";
import { schoolDayRange, toWallClock } from "@/lib/schoolTime";
import {
  CELL_MINUTES,
  DEFAULT_LIMIT_DB,
  DEVICE_TIMEOUT_MS,
  DEFAULT_YELLOW_MARGIN,
  LIVE_WINDOW_MS,
  STRIP_END_HOUR,
  STRIP_START_HOUR,
  type NoiseClassRow,
  type NoiseReport,
  type NoiseSettings,
  type NoiseTodayPayload,
  type StripCell,
} from "@/lib/noiseShared";

export * from "@/lib/noiseShared";

// Shared (non-"use server") helpers for the classroom noise monitor.
// Only numbers are stored: a loudness figure per class per minute. No audio ever
// reaches the server.

// ---------------------------------------------------------------------------
// Table bootstrap, same idea as ensureHallPass(): create the tables if the
// migration has not been applied yet. Idempotent.
// ---------------------------------------------------------------------------
let ready = false;
let pending: Promise<boolean> | null = null;

async function probeTables() {
  await prisma.noiseMinute.count();
  await prisma.noiseSetting.count();
  await prisma.noiseDevice.count();
}

async function prepareTables(): Promise<boolean> {
  try {
    await probeTables();
    return true;
  } catch {
    try {
      for (const statement of NOISE_DDL) {
        await prisma.$executeRawUnsafe(statement);
      }
      await probeTables();
      return true;
    } catch (error) {
      console.error("[noise] could not prepare tables", error);
      return false;
    }
  }
}

export async function ensureNoise(): Promise<boolean> {
  if (ready) return true;
  if (!pending) {
    pending = prepareTables().finally(() => {
      pending = null;
    });
  }
  const ok = await pending;
  if (ok) ready = true;
  return ok;
}

// ---------------------------------------------------------------------------
// Settings (one school-wide row)
// ---------------------------------------------------------------------------
export async function getNoiseSettings(): Promise<NoiseSettings> {
  if (!(await ensureNoise())) {
    return { limitDb: DEFAULT_LIMIT_DB, yellowMargin: DEFAULT_YELLOW_MARGIN };
  }
  const row = await prisma.noiseSetting.findUnique({ where: { id: 1 } });
  return {
    limitDb: row?.limitDb ?? DEFAULT_LIMIT_DB,
    yellowMargin: row?.yellowMargin ?? DEFAULT_YELLOW_MARGIN,
  };
}

// Teachers may only listen for their own classes; admins for any class.
export async function canUseClass(role: string, userId: string, classId: number): Promise<"ok" | "forbidden" | "missing"> {
  if (role === "teacher") return (await teacherCanAccessClass(userId, classId)) ? "ok" : "forbidden";
  const exists = await prisma.class.findUnique({ where: { id: classId }, select: { id: true } });
  return exists ? "ok" : "missing";
}

// ---------------------------------------------------------------------------
// One listening device per class. A device claims the class when it starts and
// refreshes the claim with every report; another device is refused until the claim
// is released, goes quiet for DEVICE_TIMEOUT_MS, or is taken over on purpose.
// Returns true when this device now holds (or refreshed) the claim.
// ---------------------------------------------------------------------------
export async function claimClass(classId: number, deviceId: string, takeover: boolean): Promise<boolean> {
  if (!(await ensureNoise())) return false;
  const now = new Date();
  const stale = new Date(now.getTime() - DEVICE_TIMEOUT_MS);
  const changed = await prisma.$executeRaw`
    INSERT INTO "NoiseDevice" ("classId", "deviceId", "lastSeenAt")
    VALUES (${classId}, ${deviceId}, ${now})
    ON CONFLICT ("classId") DO UPDATE SET
      "deviceId" = EXCLUDED."deviceId",
      "lastSeenAt" = EXCLUDED."lastSeenAt"
    WHERE "NoiseDevice"."deviceId" = EXCLUDED."deviceId"
       OR "NoiseDevice"."lastSeenAt" < ${stale}
       OR ${takeover}`;
  return changed > 0;
}

export async function releaseClass(classId: number, deviceId: string): Promise<void> {
  if (!(await ensureNoise())) return;
  await prisma.$executeRaw`DELETE FROM "NoiseDevice" WHERE "classId" = ${classId} AND "deviceId" = ${deviceId}`;
}

// ---------------------------------------------------------------------------
// Recording. Each report covers a few seconds and is added into the row of the
// current server minute, so a class produces about 60 rows an hour, not thousands.
// ---------------------------------------------------------------------------
export async function recordNoise(report: NoiseReport): Promise<boolean> {
  if (!(await ensureNoise())) return false;
  const minute = new Date(Math.floor(Date.now() / 60_000) * 60_000);
  const sumDb = report.avgDb * report.seconds;
  await prisma.$executeRaw`
    INSERT INTO "NoiseMinute" ("classId", "minute", "seconds", "sumDb", "maxDb", "overSeconds", "yellowSeconds")
    VALUES (${report.classId}, ${minute}, ${report.seconds}, ${sumDb}, ${report.maxDb}, ${report.overSeconds}, ${report.yellowSeconds})
    ON CONFLICT ("classId", "minute") DO UPDATE SET
      "seconds" = "NoiseMinute"."seconds" + EXCLUDED."seconds",
      "sumDb" = "NoiseMinute"."sumDb" + EXCLUDED."sumDb",
      "maxDb" = GREATEST("NoiseMinute"."maxDb", EXCLUDED."maxDb"),
      "overSeconds" = "NoiseMinute"."overSeconds" + EXCLUDED."overSeconds",
      "yellowSeconds" = "NoiseMinute"."yellowSeconds" + EXCLUDED."yellowSeconds"`;
  return true;
}

// ---------------------------------------------------------------------------
// "Which class is noisy today"
// ---------------------------------------------------------------------------
const STRIP_CELLS = ((STRIP_END_HOUR - STRIP_START_HOUR) * 60) / CELL_MINUTES;

export async function loadNoiseDay(ymd?: string): Promise<NoiseTodayPayload> {
  const now = new Date();
  const [dayStart, dayEnd] = schoolDayRange(ymd ?? null, now);
  const w = toWallClock(dayStart);
  const date = `${String(w.year).padStart(4, "0")}-${String(w.month).padStart(2, "0")}-${String(w.day).padStart(2, "0")}`;

  const settings = await getNoiseSettings();
  const classes = await prisma.class.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  if (!(await ensureNoise())) {
    return { date, settings, rows: [], serverNow: now.toISOString() };
  }

  const minutes = await prisma.noiseMinute.findMany({
    where: { minute: { gte: dayStart, lt: dayEnd } },
    select: { classId: true, minute: true, seconds: true, sumDb: true, maxDb: true, overSeconds: true, yellowSeconds: true },
  });

  type Acc = {
    seconds: number;
    sumDb: number;
    maxDb: number;
    over: number;
    yellow: number;
    last: number;
    lastSeconds: number;
    lastSum: number;
    cellSeconds: number[];
    cellOver: number[];
  };
  const byClass = new Map<number, Acc>();
  for (const m of minutes) {
    let a = byClass.get(m.classId);
    if (!a) {
      a = {
        seconds: 0,
        sumDb: 0,
        maxDb: 0,
        over: 0,
        yellow: 0,
        last: 0,
        lastSeconds: 0,
        lastSum: 0,
        cellSeconds: new Array<number>(STRIP_CELLS).fill(0),
        cellOver: new Array<number>(STRIP_CELLS).fill(0),
      };
      byClass.set(m.classId, a);
    }
    a.seconds += m.seconds;
    a.sumDb += m.sumDb;
    a.maxDb = Math.max(a.maxDb, m.maxDb);
    a.over += m.overSeconds;
    a.yellow += m.yellowSeconds;
    if (m.minute.getTime() >= a.last) {
      a.last = m.minute.getTime();
      a.lastSeconds = m.seconds;
      a.lastSum = m.sumDb;
    }

    const wall = toWallClock(m.minute);
    const cell = Math.floor(((wall.hour - STRIP_START_HOUR) * 60 + wall.minute) / CELL_MINUTES);
    if (cell >= 0 && cell < STRIP_CELLS) {
      a.cellSeconds[cell] += m.seconds;
      a.cellOver[cell] += m.overSeconds;
    }
  }

  const rows: NoiseClassRow[] = classes.map((c) => {
    const a = byClass.get(c.id);
    const strip: StripCell[] = Array.from({ length: STRIP_CELLS }, (_, i) => ({
      startMin: STRIP_START_HOUR * 60 + i * CELL_MINUTES,
      overShare: a && a.cellSeconds[i] > 0 ? a.cellOver[i] / a.cellSeconds[i] : null,
    }));
    return {
      classId: c.id,
      className: c.name,
      measuredSeconds: a?.seconds ?? 0,
      overSeconds: a?.over ?? 0,
      yellowSeconds: a?.yellow ?? 0,
      avgDb: a && a.seconds > 0 ? a.sumDb / a.seconds : null,
      maxDb: a ? a.maxDb : null,
      lastAvgDb: a && a.lastSeconds > 0 ? a.lastSum / a.lastSeconds : null,
      lastMinuteIso: a ? new Date(a.last).toISOString() : null,
      live: !!a && now.getTime() - (a.last + 60_000) <= LIVE_WINDOW_MS,
      strip,
    };
  });

  // Noisiest first: most time over the limit, then loudest average. Classes with
  // no readings go last.
  rows.sort(
    (x, y) =>
      Number(y.measuredSeconds > 0) - Number(x.measuredSeconds > 0) ||
      y.overSeconds - x.overSeconds ||
      (y.avgDb ?? 0) - (x.avgDb ?? 0) ||
      x.className.localeCompare(y.className)
  );

  return { date, settings, rows, serverNow: now.toISOString() };
}
