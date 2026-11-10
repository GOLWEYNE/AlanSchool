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
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const a11yType = (a: GradebookAssessment) => (a.type === "exam" ? t("examBadge") : t("assignmentBadge"));

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

  // Phones: pick one exam/assignment with the chips, then grade every student
  // in a simple list with big number fields (same save-on-leave as the grid).
  const active = assessments.find((a) => a.key === activeKey) ?? assessments[0];
  const filledFor = (a: GradebookAssessment) =>
    students.filter((s) => (values[cellKey(s.id, a.key)] ?? "").trim() !== "").length;

  const phoneView = active && (
    <div className="mt-4 flex flex-col gap-3 md:hidden">
      <div
        role="tablist"
        className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1"
        style={{ scrollbarWidth: "none" }}
      >
        {assessments.map((a) => {
          const on = a.key === active.key;
          return (
            <button
              key={a.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setActiveKey(a.key)}
              className={`flex min-h-12 max-w-[14rem] shrink-0 snap-start flex-col items-start justify-center rounded-2xl px-4 py-1.5 text-left transition-colors ${
                on
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-white/80 text-blue-900 ring-1 ring-blue-100 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700"
              }`}
            >
              <span className="w-full truncate text-sm font-semibold">{a.title}</span>
              <span className={`text-[11px] ${on ? "text-blue-100" : "text-gray-500 dark:text-slate-400"}`}>
                {a.type === "exam" ? t("examBadge") : t("assignmentBadge")} · {filledFor(a)}/{students.length}
              </span>
            </button>
          );
        })}
      </div>

      <div className="rounded-3xl border border-blue-100 bg-gradient-to-br from-yellow-50/90 via-white/80 to-blue-50/90 p-4 shadow-sm dark:border-slate-700 dark:from-yellow-500/10 dark:via-slate-900/70 dark:to-blue-500/10">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-lg font-bold text-blue-950 dark:text-blue-50">{active.title}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              {a11yType(active)}
              {active.totalMarks != null ? ` · /${active.totalMarks}` : ""}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-blue-600 px-3 py-1 text-sm font-bold text-white">
            {filledFor(active)}/{students.length}
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-blue-100 dark:bg-slate-700" aria-hidden="true">
          <div
            className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-blue-500 transition-[width] duration-500"
            style={{ width: `${students.length ? (filledFor(active) / students.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      <ul className="overflow-hidden rounded-3xl border border-blue-100 bg-white/80 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
        {students.map((s) => {
          const key = cellKey(s.id, active.key);
          const raw = (values[key] ?? "").trim();
          const num = Number(raw);
          // Colour the score by percentage of the total (only when the total is known).
          const pct = raw !== "" && !Number.isNaN(num) && active.totalMarks ? num / active.totalMarks : null;
          const tone =
            pct === null
              ? "text-blue-900 dark:text-blue-100"
              : pct >= 0.8
                ? "text-emerald-600 dark:text-emerald-300"
                : pct >= 0.5
                  ? "text-amber-600 dark:text-amber-300"
                  : "text-rose-600 dark:text-rose-300";
          return (
            <li
              key={s.id}
              className="flex min-h-16 items-center gap-3 border-b border-blue-50 px-4 py-2 last:border-b-0 dark:border-slate-800"
            >
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700 dark:bg-blue-500/20 dark:text-blue-200"
              >
                {(s.name[0] ?? "") + (s.surname[0] ?? "")}
              </span>
              <span className="min-w-0 flex-1 truncate text-base font-medium text-gray-800 dark:text-slate-100">
                {s.name} {s.surname}
              </span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                max={active.totalMarks ?? undefined}
                step="1"
                placeholder="—"
                aria-label={`${s.name} ${s.surname}`}
                value={values[key] ?? ""}
                disabled={!canEdit || savingKey === key}
                onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
                onBlur={(e) => commit(s, active, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                className={`h-12 w-24 rounded-2xl bg-slate-100 text-center text-xl font-bold ring-0 transition-colors focus:bg-white focus:ring-2 focus:ring-blue-400 dark:bg-slate-800 dark:focus:bg-slate-900 ${tone} ${
                  savingKey === key ? "opacity-50" : ""
                }`}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <>
      {phoneView}
    <div className="mt-4 hidden data-table-shell overflow-auto md:block" style={{ maxHeight: "70vh" }}>
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
    </>
  );
};

export default GradebookGrid;
