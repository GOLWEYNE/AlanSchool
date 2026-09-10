"use client";

import { useTranslations } from "next-intl";

type ObjectiveLite = { id: number; title: string; code: string | null; subjectId: number };

// Tag a Lesson or Exam with the curriculum objectives it covers, so the
// Curriculum Coverage report can tell which objectives a class has
// actually been taught/assessed against. Narrowed client-side to the
// currently-selected subject, same pattern as WorkTargetPicker narrowing
// students by the selected lesson's class.
const ObjectiveTagPicker = ({
  objectives,
  selectedSubjectId,
  register,
  defaultObjectiveIds,
}: {
  objectives: ObjectiveLite[];
  selectedSubjectId: number | string | undefined;
  register: any;
  defaultObjectiveIds?: number[];
}) => {
  const t = useTranslations("Forms");
  const subjectObjectives = selectedSubjectId
    ? objectives.filter((o) => String(o.subjectId) === String(selectedSubjectId))
    : [];

  return (
    <div className="flex flex-col gap-2 w-full">
      <label className="text-xs text-gray-500 dark:text-slate-400">{t("objectiveTags.label")}</label>
      <p className="text-xs text-gray-400 dark:text-slate-500">{t("objectiveTags.helpText")}</p>
      <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto rounded-lg border border-gray-200 dark:border-slate-700 p-2">
        {subjectObjectives.length === 0 ? (
          <span className="text-xs text-gray-400 dark:text-slate-500 p-1">
            {selectedSubjectId ? t("objectiveTags.noneForSubject") : t("objectiveTags.pickSubject")}
          </span>
        ) : (
          subjectObjectives.map((o) => (
            <label
              key={o.id}
              className="flex items-center gap-1.5 text-xs bg-gray-50 dark:bg-slate-800 rounded-full px-2.5 py-1 cursor-pointer"
            >
              <input
                type="checkbox"
                value={o.id}
                defaultChecked={defaultObjectiveIds?.includes(o.id)}
                {...register("objectiveIds")}
              />
              {o.code ? `${o.code} - ${o.title}` : o.title}
            </label>
          ))
        )}
      </div>
    </div>
  );
};

export default ObjectiveTagPicker;
