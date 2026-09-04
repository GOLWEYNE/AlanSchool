"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

export type QuizQuestionDraft = {
  text: string;
  options: string[];
  correctIndex: number;
  points: number;
};

const emptyQuestion = (): QuizQuestionDraft => ({
  text: "",
  options: ["", ""],
  correctIndex: 0,
  points: 1,
});

// An optional multiple-choice quiz attached to an exam or assignment. When
// turned on, the question list is handed up to the parent form via
// onChange (as a plain array - the parent wires it into react-hook-form
// with setValue), which the server validates and, once a student answers
// it, grades automatically - no manual review needed for that part.
const WorkQuizBuilder = ({
  defaultQuestions,
  onChange,
}: {
  defaultQuestions?: QuizQuestionDraft[] | null;
  onChange: (questions: QuizQuestionDraft[]) => void;
}) => {
  const [enabled, setEnabled] = useState(!!defaultQuestions?.length);
  const [questions, setQuestions] = useState<QuizQuestionDraft[]>(
    defaultQuestions?.length ? defaultQuestions : [emptyQuestion()]
  );

  useEffect(() => {
    onChange(enabled ? questions : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, questions]);

  const updateQuestion = (i: number, patch: Partial<QuizQuestionDraft>) => {
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
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
        Add an auto-graded quiz (multiple choice)
      </label>
      <p className="text-xs text-gray-400 dark:text-slate-500">
        Students answer these in-app and get their score the moment they submit - no manual
        grading needed. You can still attach a PDF/Word paper above for context.
      </p>

      {enabled && (
        <div className="flex flex-col gap-4">
          {questions.map((q, qi) => (
            <div
              key={qi}
              className="flex flex-col gap-2 rounded-md bg-gray-50 dark:bg-slate-800 p-3"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 shrink-0">
                  Q{qi + 1}
                </span>
                <input
                  type="text"
                  value={q.text}
                  onChange={(e) => updateQuestion(qi, { text: e.target.value })}
                  placeholder="Question text"
                  className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-900 dark:text-slate-100 p-1.5 rounded-md text-sm flex-1"
                />
                <input
                  type="number"
                  min={1}
                  value={q.points}
                  onChange={(e) => updateQuestion(qi, { points: parseInt(e.target.value) || 1 })}
                  title="Points"
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
                      title="Correct answer"
                    />
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => updateOption(qi, oi, e.target.value)}
                      placeholder={`Option ${oi + 1}`}
                      className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-900 dark:text-slate-100 p-1.5 rounded-md text-sm flex-1"
                    />
                    {q.options.length > 2 && (
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
                {q.options.length < 6 && (
                  <button
                    type="button"
                    onClick={() => addOption(qi)}
                    className="text-xs text-blue-500 hover:underline w-fit"
                  >
                    + Add option
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
            <Plus size={14} /> Add question
          </button>
        </div>
      )}
    </div>
  );
};

export default WorkQuizBuilder;
