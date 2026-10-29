import { STANDARD_OBJECTIVES_A } from "./standardObjectivesData/part_a";
import { STANDARD_OBJECTIVES_B } from "./standardObjectivesData/part_b";
import { STANDARD_OBJECTIVES_C } from "./standardObjectivesData/part_c";

// Draft learning objectives for the standard Kazakhstan school subjects, written
// as a starting point that teachers and admins can edit on the Objectives page.
//
// Text format (see the part_*.ts files):
//   ## CODE ; Subject name | alias | alias   one subject (aliases are other names the
//                                            school may already use for it)
//   # 3                                      grade level
//   Strand: Objective title                  one objective
// Codes are generated as CODE-grade.strand.item, e.g. "PE-3.2.1", the same style
// as the existing objectives (e.g. "Sinm-3.1.1").

export type StandardObjective = { code: string; strand: string; title: string };
export type StandardGradeBlock = { grade: number; objectives: StandardObjective[] };
export type StandardSubject = { code: string; names: string[]; grades: StandardGradeBlock[] };

export function parseStandardObjectives(
  source: string = [STANDARD_OBJECTIVES_A, STANDARD_OBJECTIVES_B, STANDARD_OBJECTIVES_C].join("\n")
): StandardSubject[] {
  const subjects: StandardSubject[] = [];
  let subject: StandardSubject | null = null;
  let block: StandardGradeBlock | null = null;
  let strandIndex = new Map<string, number>();
  let itemCount = new Map<string, number>();

  for (const raw of source.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("## ")) {
      const [codePart, namesPart = ""] = line.slice(3).split(";");
      subject = {
        code: codePart.trim(),
        names: namesPart.split("|").map((n) => n.trim()).filter(Boolean),
        grades: [],
      };
      subjects.push(subject);
      block = null;
    } else if (line.startsWith("# ")) {
      if (!subject) continue;
      block = { grade: parseInt(line.slice(2), 10), objectives: [] };
      subject.grades.push(block);
      strandIndex = new Map();
      itemCount = new Map();
    } else if (subject && block) {
      const cut = line.indexOf(": ");
      if (cut < 0) continue;
      const strand = line.slice(0, cut).trim();
      const title = line.slice(cut + 2).trim();
      if (!strandIndex.has(strand)) strandIndex.set(strand, strandIndex.size + 1);
      const item = (itemCount.get(strand) ?? 0) + 1;
      itemCount.set(strand, item);
      block.objectives.push({
        code: `${subject.code}-${block.grade}.${strandIndex.get(strand)}.${item}`,
        strand,
        title,
      });
    }
  }
  return subjects;
}

export function countStandardObjectives(): number {
  return parseStandardObjectives().reduce(
    (sum, s) => sum + s.grades.reduce((g, b) => g + b.objectives.length, 0),
    0
  );
}
