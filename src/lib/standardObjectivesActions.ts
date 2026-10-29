"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { getUserRole } from "@/lib/auth";
import { parseStandardObjectives } from "@/lib/standardObjectives";

export type LoadStandardResult = {
  ok: boolean;
  error?: string;
  subjectsCreated: number;
  added: number;
  skipped: number;
  missingGrades: number[];
};

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

// Admin-only. Adds the draft standard objectives for the Kazakhstan subjects.
// Safe to run more than once: an objective is skipped when the subject already
// has one with the same code or the same title in that grade.
export async function loadStandardObjectives(): Promise<LoadStandardResult> {
  const empty = { subjectsCreated: 0, added: 0, skipped: 0, missingGrades: [] as number[] };
  const { userId, sessionClaims } = await auth();
  if (!userId || getUserRole(sessionClaims) !== "admin") {
    return { ok: false, error: "Only an admin can load the standard objectives.", ...empty };
  }

  try {
    const entries = parseStandardObjectives();
    const [subjects, grades] = await Promise.all([
      prisma.subject.findMany({ select: { id: true, name: true } }),
      prisma.grade.findMany({ select: { id: true, level: true } }),
    ]);
    const gradeId = new Map<number, number>(
      grades.map((g: { id: number; level: number }): [number, number] => [g.level, g.id])
    );
    const missing = new Set<number>();
    let subjectsCreated = 0;

    // Match each entry to the school's existing subject names (or create it).
    const matched: { entry: (typeof entries)[number]; ids: number[] }[] = [];
    for (const entry of entries) {
      const wanted = new Set(entry.names.map(norm));
      let ids = subjects
        .filter((s: { id: number; name: string }) => wanted.has(norm(s.name)))
        .map((s: { id: number; name: string }) => s.id);
      if (ids.length === 0 && entry.names[0]) {
        const created = await prisma.subject.create({ data: { name: entry.names[0] }, select: { id: true, name: true } });
        subjects.push(created);
        ids = [created.id];
        subjectsCreated++;
      }
      matched.push({ entry, ids });
    }

    const existing = await prisma.curriculumObjective.findMany({
      select: { subjectId: true, gradeId: true, code: true, title: true },
    });
    const seen = new Set<string>();
    for (const o of existing as { subjectId: number; gradeId: number | null; code: string | null; title: string }[]) {
      seen.add(`t|${o.subjectId}|${o.gradeId ?? ""}|${norm(o.title)}`);
      if (o.code) seen.add(`c|${o.subjectId}|${norm(o.code)}`);
    }

    const rows: { code: string; title: string; strand: string; subjectId: number; gradeId: number }[] = [];
    let skipped = 0;
    for (const { entry, ids } of matched) {
      for (const block of entry.grades) {
        const gid = gradeId.get(block.grade);
        if (gid === undefined) {
          missing.add(block.grade);
          continue;
        }
        for (const subjectId of ids) {
          for (const o of block.objectives) {
            const titleKey = `t|${subjectId}|${gid}|${norm(o.title)}`;
            const codeKey = `c|${subjectId}|${norm(o.code)}`;
            if (seen.has(titleKey) || seen.has(codeKey)) {
              skipped++;
              continue;
            }
            seen.add(titleKey);
            seen.add(codeKey);
            rows.push({ code: o.code, title: o.title, strand: o.strand, subjectId, gradeId: gid });
          }
        }
      }
    }

    for (let i = 0; i < rows.length; i += 400) {
      await prisma.curriculumObjective.createMany({ data: rows.slice(i, i + 400) });
    }

    revalidatePath("/dashboard/list/objectives");
    revalidatePath("/dashboard/list/subjects");
    revalidatePath("/dashboard/list/curriculum-coverage");
    return {
      ok: true,
      subjectsCreated,
      added: rows.length,
      skipped,
      missingGrades: Array.from(missing).sort((a, b) => a - b),
    };
  } catch (error) {
    console.error("[standard objectives] load failed", error);
    return { ok: false, error: "Something went wrong while loading the objectives.", ...empty };
  }
}
