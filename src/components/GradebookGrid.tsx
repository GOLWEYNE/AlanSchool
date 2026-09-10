"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { saveGradebookScore } from "@/lib/actions";

export type GradebookStudent = {
  id: string;
  name: string;
  surname: string;
};

export type GradebookAssessment = {
  key: string; // "exam-<id>" | "assignment-<id>"
  id: number;
  type: "exam" | "assignment";
  title: string;
  totalMarks: number | null;
  date: Date;
};

const cellKey = (studentId: string, assessmentKey: string) => `${studentId}:${assessmentKey}`;

// Students x assessments spreadsheet grid for one class/subject. Every cell
// is independently inline-editable: typing a score and leaving the cell
// (blur or Enter) saves it immediately via saveGradebookScore, mirroring
// TimetableGrid's applyReschedule - optimistic local update first, then an
// awaited plain server action call, reverting the cell and toasting on
// failure, refreshing the page's server data on success. Clearing a cell
// back to empty deletes the underlying Result row instead of saving 0.
const GradebookGrid = ({
  students,
  assessments,
  initialScores,
  canEdit,
}: {
  students: GradebookStudent[];
  assessments: GradebookAssessment[];
  initialScores: Record<string, number>;
  canEdit: boolean;
}) => {
  const t = useTranslations("List.gradebook");
  const router = useRouter();

  const buildFromInitial = () => {
    const next: Record<string, string> = {};
    for (const s of students) {
      for (const a of assessments) {
        const key = cellKey(s.id, a.key);
        const score = initialScores[key];
        next[key] = score === undefined ? "" : String(score);
      }
    }
    return next;
  };

  const [values, setValues] = useState<Record<string, string>>(buildFromInitial);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // The server refetches (and re-sends fresh props) after every successful
  // save and on every class/subject filter change - keep local state in
  // lockstep with whatever the server last confirmed.
  useEffect(() => {
    setValues(buildFromInitial());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, assessments, initialScores]);

  const commit = async (student: GradebookStudent, assessment: GradebookAssessment, raw: string) => {
    const key = cellKey(student.id, assessment.key);
    const previousScore = initialScores[key];
    const previousRaw = previousScore === undefined ? "" : String(previousScore);
    const trimmed = raw.trim();

    if (trimmed === previousRaw) return;

    let scoreToSave: number | null = null;

    if (trimmed !== "") {
      const num = Number(trimmed);
      if (Number.isNaN(num) || num < 0) {
        toast.error(t("scoreNegative"));
        setValues((prev) => ({ ...prev, [key]: previousRaw }));
        return;
      }
      if (assessment.totalMarks != null && num > assessment.totalMarks) {
        toast.error(t("scoreExceedsMax", { max: assessment.totalMarks }));
        setValues((prev) => ({ ...prev, [key]: previousRaw }));
        return;
      }
      scoreToSave = num;
    }

    setSavingKey(key);
    const result = await saveGradebookScore({
      studentId: student.id,
      examId: assessment.type === "exam" ? assessment.id : undefined,
      assignmentId: assessment.type === "assignment" ? assessment.id : undefined,
      score: scoreToSave,
    });
    setSavingKey(null);

    if (!result.success) {
      setValues((prev) => ({ ...prev, [key]: previousRaw }));
      toast.error(result.message || t("saveError"));
      return;
    }

    toast(scoreToSave === null ? t("cleared") : t("saved"));
    router.refresh();
  };

  return (
    <div className="mt-4 data-table-shell overflow-auto" style={{ maxHeight: "70vh" }}>
      <table className="min-w-full border-collapse text-sm">
        <thead className="sticky top-0 z-20 bg-gradient-to-r from-blue-50 via-sky-50 to-yellow-50 dark:from-blue-950/40 dark:via-slate-900/60 dark:to-yellow-950/20 border-b border-blue-100 dark:border-slate-800">
          <tr className="text-left text-blue-700 dark:text-blue-300">
            <th className="sticky left-0 z-30 bg-blue-50 dark:bg-blue-950/40 px-4 py-3 font-semibold uppercase tracking-wide text-[11px] min-w-[11rem]">
              {t("studentColumn")}
            </th>
            {assessments.map((a) => (
              <th
                key={a.key}
                className="px-3 py-3 font-semibold text-[11px] whitespace-nowrap min-w-[8rem] align-bottom"
              >
                <div className="flex flex-col gap-0.5 normal-case">
                  <span
                    className="truncate max-w-[10rem] font-semibold text-gray-700 dark:text-slate-200"
                    title={a.title}
                  >
                    {a.title}
                  </span>
                  <span className="text-[10px] font-normal text-gray-400 dark:text-slate-500 uppercase tracking-wide">
                    {a.type === "exam" ? t("examBadge") : t("assignmentBadge")}
                    {a.totalMarks != null ? ` · /${a.totalMarks}` : ""}
                  </span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {students.map((s, idx) => {
            const rowBg = idx % 2 === 1 ? "bg-slate-50 dark:bg-slate-900/40" : "bg-white dark:bg-slate-900";
            return (
              <tr key={s.id} className={`border-b border-gray-100 dark:border-slate-800 ${rowBg}`}>
                <td
                  className={`sticky left-0 z-10 ${rowBg} px-4 py-2 font-medium whitespace-nowrap`}
                >
                  {s.name} {s.surname}
                </td>
                {assessments.map((a) => {
                  const key = cellKey(s.id, a.key);
                  return (
                    <td key={a.key} className="px-2 py-1.5">
                      <input
                        type="number"
                        min={0}
                        max={a.totalMarks ?? undefined}
                        step="1"
                        value={values[key] ?? ""}
                        disabled={!canEdit || savingKey === key}
                        onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
                        onBlur={(e) => commit(s, a, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        }}
                        className={`ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-900 dark:text-slate-100 p-1.5 rounded-md text-sm w-16 text-center ${
                          savingKey === key ? "opacity-50" : ""
                        }`}
                      />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default GradebookGrid;
