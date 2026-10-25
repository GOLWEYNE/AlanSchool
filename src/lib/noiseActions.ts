"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { getUserRole } from "@/lib/auth";
import {
  MAX_LIMIT_DB,
  MAX_YELLOW_MARGIN,
  MIN_LIMIT_DB,
  MIN_YELLOW_MARGIN,
  ensureNoise,
} from "@/lib/noise";

export type SaveNoiseSettingsResult = { ok: boolean; error?: string };

// Admins set the school-wide limit every classroom board uses.
export async function saveNoiseSettings(
  limitDb: number,
  yellowMargin: number
): Promise<SaveNoiseSettingsResult> {
  const { userId, sessionClaims } = await auth();
  if (!userId || getUserRole(sessionClaims) !== "admin") return { ok: false, error: "forbidden" };

  const limit = Math.round(limitDb);
  const margin = Math.round(yellowMargin);
  if (!Number.isFinite(limit) || limit < MIN_LIMIT_DB || limit > MAX_LIMIT_DB) {
    return { ok: false, error: "limit" };
  }
  if (!Number.isFinite(margin) || margin < MIN_YELLOW_MARGIN || margin > MAX_YELLOW_MARGIN) {
    return { ok: false, error: "margin" };
  }
  if (!(await ensureNoise())) return { ok: false, error: "unavailable" };

  await prisma.noiseSetting.upsert({
    where: { id: 1 },
    update: { limitDb: limit, yellowMargin: margin },
    create: { id: 1, limitDb: limit, yellowMargin: margin },
  });
  revalidatePath("/dashboard/list/noise-monitor");
  return { ok: true };
}
