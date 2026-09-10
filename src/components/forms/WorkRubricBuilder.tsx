"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

export type RubricCriterionDraft = {
  name: string;
  description?: string;
  maxPoints: number;
};

const emptyCriterion = (): RubricCriterionDraft => ({
  name: "",
  description: "",
  maxPoints: 10,
});

// An optional rubric (weighted criteria) attached to an assignment, for
// project/essay-style work that a single number doesn't do justice to.
// When turned on, the criteria list is handed up to the parent form via
// onChange (as a plain array - the parent wires it into react-hook-form
// with setValue), same pattern as WorkQuizBuilder. Grading against it
// still isn't automatic like the quiz builder's questions - a teacher
// scores each criterion by hand on the submissions panel - but the total
// is computed for them instead of typed in free-hand.
const WorkRubricBuilder = ({
  defaultCriteria,
  onChange,
}: {
  defaultCriteria?: RubricCriterionDraft[] | null;
  onChange: (criteria: RubricCriterionDraft[]) => void;
}) => {
  const t = useTranslations("Forms");

  const [enabled, setEnabled] = useState(!!defaultCriteria?.length);
  const [criteria, setCriteria] = useState<RubricCriterionDraft[]>(
    defaultCriteria?.length ? defaultCriteria : [emptyCriterion()]
  );

  useEffect(() => {
    onChange(enabled ? criteria : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, criteria]);

  const updateCriterion = (i: number, patch: Partial<RubricCriterionDraft>) => {
    setCriteria((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  };

  const addCriterion = () => setCriteria((cs) => [...cs, emptyCriterion()]);
  const removeCriterion = (i: number) =>
    setCriteria((cs) => (cs.length > 1 ? cs.filter((_, idx) => idx !== i) : cs));

  const totalPoints = criteria.reduce((sum, c) => sum + (c.maxPoints || 0), 0);

  return (
    <div className="flex flex-col gap-3 w-full rounded-lg border border-gray-200 dark:border-slate-700 p-3">
      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-slate-200 cursor-pointer">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        {t("rubric.enableLabel")}
      </label>
      <p className="text-xs text-gray-400 dark:text-slate-500">{t("rubric.helpText")}</p>

      {enabled && (
        <div className="flex flex-col gap-3">
          {criteria.map((c, ci) => (
            <div
              key={ci}
              className="flex flex-col gap-2 rounded-md bg-gray-50 dark:bg-slate-800 p-3"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 shrink-0">
                  {t("rubric.criterionLabel", { number: ci + 1 })}
                </span>
                <input
                  type="text"
                  value={c.name}
                  onChange={(e) => updateCriterion(ci, { name: e.target.value })}
                  placeholder={t("rubric.namePlaceholder")}
                  className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-900 dark:text-slate-100 p-1.5 rounded-md text-sm flex-1"
                />
                <input
                  type="number"
                  min={1}
                  value={c.maxPoints}
                  onChange={(e) =>
                    updateCriterion(ci, { maxPoints: parseInt(e.target.value) || 1 })
                  }
                  title={t("rubric.maxPointsLabel")}
                  className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-900 dark:text-slate-100 p-1.5 rounded-md text-sm w-20"
                />
                {criteria.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeCriterion(ci)}
                    className="text-red-400 hover:text-red-500 shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <input
                type="text"
                value={c.description ?? ""}
                onChange={(e) => updateCriterion(ci, { description: e.target.value })}
                placeholder={t("rubric.descriptionPlaceholder")}
                className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-900 dark:text-slate-100 p-1.5 rounded-md text-sm w-full ml-6"
              />
            </div>
          ))}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={addCriterion}
              className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-300 font-semibold w-fit"
            >
              <Plus size={14} /> {t("rubric.addCriterion")}
            </button>
            <span className="text-xs text-gray-500 dark:text-slate-400">
              {t("rubric.totalPoints", { total: totalPoints })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkRubricBuilder;
