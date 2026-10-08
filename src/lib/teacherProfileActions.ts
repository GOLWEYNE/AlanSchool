"use server";

import { revalidatePath } from "next/cache";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getUserRole } from "@/lib/auth";
import { currentSchoolYear } from "@/lib/schoolYear";
import {
  OBJECTIVE_STATUSES,
  POSITIONS,
  ensureTeacherProfile,
  type Achievement,
} from "@/lib/teacherProfile";

const text = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .transform((v) => {
      const trimmed = (v ?? "").trim();
      return trimmed ? trimmed : null;
    });

const intOrNull = (min: number, max: number) =>
  z
    .union([z.number(), z.string(), z.null()])
    .optional()
    .transform((v) => {
      if (v === null || v === undefined || v === "") return null;
      const n = Number(v);
      return Number.isInteger(n) && n >= min && n <= max ? n : null;
    });

const profileSchema = z.object({
  position: z.enum(POSITIONS).optional().nullable(),
  department: text(80),
  yearJoined: intOrNull(1950, 2100),
  about: text(500),
  education: text(500),
  previousSchools: text(500),
  yearsExperience: intOrNull(0, 70),
  certificates: text(500),
  achievements: z
    .array(
      z.object({
        title: z.string().max(120),
        year: intOrNull(1950, 2100),
        note: z.string().max(200).optional(),
      })
    )
    .max(5)
    .default([]),
  vision: text(1000),
  objectives: z
    .array(
      z.object({
        term: z.number().int().min(1).max(4),
        text: z.string().max(200),
        status: z.enum(OBJECTIVE_STATUSES),
      })
    )
    .max(16)
    .default([]),
});

export type TeacherProfileInput = z.input<typeof profileSchema>;

export type SaveProfileResult = {
  ok: boolean;
  error?: "notAllowed" | "invalid" | "noTeacher" | "unavailable" | "failed";
  complete?: boolean;
  // What is still missing before the profile counts as complete.
  missing?: ("photo" | "position")[];
};

// Saves the signed-in teacher's own profile. Everything is saved; the profile
// only counts as complete (and the first-login gate lifts) once a real photo
// is on the Clerk account and a position is chosen. The photo is checked on
// the server so the step can't be skipped from the browser.
export async function saveTeacherProfile(input: TeacherProfileInput): Promise<SaveProfileResult> {
  const { userId, sessionClaims } = await auth();
  if (!userId || getUserRole(sessionClaims) !== "teacher") return { ok: false, error: "notAllowed" };

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const data = parsed.data;

  if (!(await ensureTeacherProfile())) return { ok: false, error: "unavailable" };

  const teacher = await prisma.teacher.findUnique({ where: { id: userId }, select: { id: true } });
  if (!teacher) return { ok: false, error: "noTeacher" };

  try {
    const user = await clerkClient.users.getUser(userId);
    const hasPhoto = !!user.hasImage;
    const position = data.position ?? null;

    const missing: ("photo" | "position")[] = [];
    if (!hasPhoto) missing.push("photo");
    if (!position) missing.push("position");
    const complete = missing.length === 0;

    const achievements: Achievement[] = data.achievements
      .filter((a) => a.title.trim())
      .map((a) => ({ title: a.title.trim(), year: a.year ?? null, note: (a.note ?? "").trim() }));

    const fields = {
      photoUrl: hasPhoto ? user.imageUrl : null,
      position,
      department: data.department,
      yearJoined: data.yearJoined,
      about: data.about,
      education: data.education,
      previousSchools: data.previousSchools,
      yearsExperience: data.yearsExperience,
      certificates: data.certificates,
      achievements: achievements as unknown as object,
      vision: data.vision,
    };

    const schoolYear = currentSchoolYear();
    const objectives = data.objectives
      .map((o) => ({ ...o, text: o.text.trim() }))
      .filter((o) => o.text);

    const existing = await prisma.teacherProfile.findUnique({
      where: { teacherId: userId },
      select: { completedAt: true },
    });
    // Once complete, a profile stays complete even if the photo is later removed
    // from Clerk; the teacher is reminded on the edit page instead of being locked out.
    const completedAt = existing?.completedAt ?? (complete ? new Date() : null);

    await prisma.$transaction([
      prisma.teacherProfile.upsert({
        where: { teacherId: userId },
        create: { teacherId: userId, ...fields, completedAt },
        update: { ...fields, completedAt },
      }),
      prisma.teacherObjective.deleteMany({ where: { teacherId: userId, schoolYear } }),
      prisma.teacherObjective.createMany({
        data: objectives.map((o) => ({
          teacherId: userId,
          schoolYear,
          term: o.term,
          text: o.text,
          status: o.status,
        })),
      }),
    ]);

    revalidatePath("/dashboard", "layout");
    revalidatePath("/complete-profile");
    return { ok: true, complete: !!completedAt, missing };
  } catch (error) {
    console.error("[teacher-profile] save failed", error);
    return { ok: false, error: "failed" };
  }
}
