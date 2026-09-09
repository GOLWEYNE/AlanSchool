"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

export type QuizQuestionType = "MULTIPLE_CHOICE" | "TRUE_FALSE";

export type QuizQuestionDraft = {
  type: QuizQuestionType;
  text: string;
  options: string[];
  correctIndex: number;
  points: number;
};

const emptyQuestion = (): QuizQuestionDraft => ({
  type: "MULTIPLE_CHOICE",
  text: "",
  options: ["", ""],
  correctIndex: 0,
  points: 1,
});

// An optional auto-graded quiz (multiple choice and/or true/false questions)
// attached to an exam or assignment. When turned on, the question list is
// handed up to the parent form via onChange (as a plain array - the parent
// wires it into react-hook-form with setValue), which the server validates
// and, once a student answers it, grades automatically - no manual review
// needed for that part.
//
// `type` is a display/authoring hint only, not a distinct persisted shape -
// a True/False question is really a 2-option multiple choice question under
// the hood (options locked to ["True", "False"]), so grading and rendering
// on the student side work unchanged for either type.
const WorkQuizBuilder = ({
  defaultQuestions,
  onChange,
}: {
  defaultQuestions?: QuizQuestionDraft[] | null;
  onChange: (questions: QuizQuestionDraft[]) => void;
}) => {
  const t = useTranslations("Forms");
  const trueFalseOptions = [t("quiz.true"), t("quiz.false")];

  const [enabled, setEnabled] = useState(!!defaultQuestions?.length);
  const [questions, setQuestions] = useState<QuizQuestionDraft[]>(
    defaultQuestions?.length
      ? defaultQuestions.map((q) => ({ ...q, type: q.type ?? "MULTIPLE_CHOICE" }))
      : [emptyQuestion()]
  );

  useEffect(() => {
    onChange(enabled ? questions : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, questions]);

  const updateQuestion = (i: number, patch: Partial<QuizQuestionDraft>) => {
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  };

  const updateType = (i: number, type: QuizQuestionType) => {
    setQuestions((qs) =>
      qs.map((q, idx) => {
        if (idx !== i) return q;
        if (type === "TRUE_FALSE") {
          return { ...q, type, options: trueFalseOptions, correctIndex: q.correctIndex <= 1 ? q.correctIndex : 0 };
        }
        return { ...q, type };
      })
    );
  };

  const updateOption = (qi: number, oi: number, value: string) => {
    setQuestions((qs) =>
      qs.map((q, idx) =>
        idx === qi ? { ...q, options: q.options.map((o, j) => (j === oi ? value : o)) } : q
      )
    );
  };

  const addOption = (qi: number) => {
    setQuestions((qs) =>
      qs.map((q, idx) =>
        idx === qi && q.options.length < 6 ? { ...q, options: [...q.options, ""] } : q
      )
    );
  };

  const removeOption = (qi: number, oi: number) => {
    setQuestions((qs) =>
      qs.map((q, idx) => {
        if (idx !== qi || q.options.length <= 2) return q;
        const options = q.options.filter((_, j) => j !== oi);
        const correctIndex = q.correctIndex >= options.length ? 0 : q.correctIndex;
        return { ...q, options, correctIndex };
      })
    );
  };

  const addQuestion = () => setQuestions((qs) => [...qs, emptyQuestion()]);
  const removeQuestion = (i: number) =>
    setQuestions((qs) => (qs.length > 1 ? qs.filter((_, idx) => idx !== i) : qs));

  return (
    <div className="flex flex-col gap-3 w-full rounded-lg border border-gray-200 dark:border-slate-700 p-3">
      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-slate-200 cursor-pointer">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        {t("quiz.enableLabel")}
      </label>
      <p className="text-xs text-gray-400 dark:text-slate-500">{t("quiz.helpText")}</p>

      {enabled && (
        <div className="flex flex-col gap-4">
          {questions.map((q, qi) => (
            <div
              key={qi}
              className="flex flex-col gap-2 rounded-md bg-gray-50 dark:bg-slate-800 p-3"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 shrink-0">
                  {t("quiz.questionLabel", { number: qi + 1 })}
                </span>
                <input
                  type="text"
                  value={q.text}
                  onChange={(e) => updateQuestion(qi, { text: e.target.value })}
                  placeholder={t("quiz.questionPlaceholder")}
                  className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-900 dark:text-slate-100 p-1.5 rounded-md text-sm flex-1"
                />
                <select
                  value={q.type}
                  onChange={(e) => updateType(qi, e.target.value as QuizQuestionType)}
                  title={t("quiz.typeLabel")}
                  className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-900 dark:text-slate-100 p-1.5 rounded-md text-sm shrink-0"
                >
                  <option value="MULTIPLE_CHOICE">{t("quiz.typeMultipleChoice")}</option>
                  <option value="TRUE_FALSE">{t("quiz.typeTrueFalse")}</option>
                </select>
                <input
                  type="number"
                  min={1}
                  value={q.points}
                  onChange={(e) => updateQuestion(qi, { points: parseInt(e.target.value) || 1 })}
                  title={t("quiz.pointsLabel")}
                  className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-900 dark:text-slate-100 p-1.5 rounded-md text-sm w-16"
                />
                {questions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeQuestion(qi)}
                    className="text-red-400 hover:text-red-500 shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-1.5 pl-6">
                {q.options.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`correct-${qi}`}
                      checked={q.correctIndex === oi}
                      onChange={() => updateQuestion(qi, { correctIndex: oi })}
                      title={t("quiz.correctAnswerLabel")}
                    />
                    {q.type === "TRUE_FALSE" ? (
                      <span className="text-sm flex-1 py-1.5">{opt}</span>
                    ) : (
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => updateOption(qi, oi, e.target.value)}
                        placeholder={t("quiz.optionPlaceholder", { number: oi + 1 })}
                        className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-900 dark:text-slate-100 p-1.5 rounded-md text-sm flex-1"
                      />
                    )}
                    {q.type !== "TRUE_FALSE" && q.options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOption(qi, oi)}
                        className="text-gray-400 hover:text-red-400"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
                {q.type !== "TRUE_FALSE" && q.options.length < 6 && (
                  <button
                    type="button"
                    onClick={() => addOption(qi)}
                    className="text-xs text-blue-500 hover:underline w-fit"
                  >
                    {t("quiz.addOption")}
                  </button>
                )}
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addQuestion}
            className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-300 font-semibold w-fit"
          >
            <Plus size={14} /> {t("quiz.addQuestion")}
          </button>
        </div>
      )}
    </div>
  );
};

export default WorkQuizBuilder;
