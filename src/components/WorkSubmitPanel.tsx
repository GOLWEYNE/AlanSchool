"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import { CldUploadWidget } from "next-cloudinary";
import { UploadCloud, CheckCircle2, Lock } from "lucide-react";
import { submitStudentWork } from "@/lib/actions";

type QuestionForStudent = { text: string; options: string[]; points: number };

type ExistingSubmission = {
  fileUrl: string | null;
  fileName: string | null;
  submittedAt: string | null;
  status: string;
  grade: number | null;
  feedback: string | null;
  answers: number[] | null;
} | null;

// The student-facing half of an exam/assignment: read the attached paper,
// then either answer an in-app quiz (auto-graded instantly) or upload a
// completed file - whichever the teacher set up. Resubmitting before the
// deadline replaces the previous attempt; once the deadline passes the
// server refuses new submissions outright, so this mirrors that by
// locking the UI too.
const WorkSubmitPanel = ({
  workType,
  workId,
  deadline,
  questions,
  existingSubmission,
}: {
  workType: "exam" | "assignment";
  workId: number;
  deadline: string;
  questions?: QuestionForStudent[] | null;
  existingSubmission?: ExistingSubmission;
}) => {
  const router = useRouter();
  const [state, formAction] = useFormState(submitStudentWork, {
    success: false,
    error: false,
  });

  const [uploadUrl, setUploadUrl] = useState<string | null>(
    existingSubmission?.fileUrl ?? null
  );
  const [uploadName, setUploadName] = useState<string | null>(
    existingSubmission?.fileName ?? null
  );
  const [answers, setAnswers] = useState<number[]>(
    existingSubmission?.answers ?? (questions ? questions.map(() => -1) : [])
  );

  const isPast = new Date() > new Date(deadline);
  const alreadyGraded = existingSubmission?.status === "GRADED";
  const hasQuiz = !!questions && questions.length > 0;

  useEffect(() => {
    if (state.success) {
      if (typeof state.autoScore === "number") {
        toast(`Submitted! You scored ${state.autoScore}/${state.autoTotal}.`);
      } else {
        toast("Submitted!");
      }
      router.refresh();
    } else if (state.error && state.message) {
      toast.error(state.message);
    }
  }, [state, router]);

  const handleSubmit = () => {
    const common = {
      fileUrl: uploadUrl || undefined,
      fileName: uploadName || undefined,
      answers: hasQuiz ? answers : undefined,
    };
    formAction(
      workType === "exam"
        ? { examId: workId, ...common }
        : { assignmentId: workId, ...common }
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {existingSubmission && (
        <div className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-sm">
          <p className="font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
            <CheckCircle2 size={14} />
            You submitted this
            {existingSubmission.submittedAt
              ? ` on ${new Date(existingSubmission.submittedAt).toLocaleString()}`
              : ""}
            .
          </p>
          {existingSubmission.status === "GRADED" && (
            <p className="mt-1 text-gray-700 dark:text-slate-300">
              Grade: <span className="font-semibold">{existingSubmission.grade}</span>
              {existingSubmission.feedback ? ` - ${existingSubmission.feedback}` : ""}
            </p>
          )}
          {!isPast && (
            <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
              You can resubmit until the deadline to replace this.
            </p>
          )}
        </div>
      )}

      {isPast ? (
        <div className="flex items-center gap-2 text-sm text-red-500 bg-red-50 dark:bg-red-950/30 rounded-lg p-3">
          <Lock size={16} /> The deadline has passed - submissions are closed.
        </div>
      ) : (
        <>
          {hasQuiz ? (
            <div className="flex flex-col gap-4">
              {questions!.map((q, qi) => (
                <div
                  key={qi}
                  className="rounded-lg border border-gray-200 dark:border-slate-700 p-3"
                >
                  <p className="text-sm font-semibold text-gray-800 dark:text-slate-100 mb-2">
                    {qi + 1}. {q.text}{" "}
                    <span className="text-xs text-gray-400 font-normal">
                      ({q.points} pt{q.points === 1 ? "" : "s"})
                    </span>
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {q.options.map((opt, oi) => (
                      <label
                        key={oi}
                        className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-300"
                      >
                        <input
                          type="radio"
                          name={`q-${qi}`}
                          checked={answers[qi] === oi}
                          onChange={() =>
                            setAnswers((a) => a.map((v, i) => (i === qi ? oi : v)))
                          }
                          disabled={alreadyGraded}
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <label className="text-xs text-gray-500 dark:text-slate-400">
                Upload your completed work (PDF or Word)
              </label>
              <CldUploadWidget
                uploadPreset="school"
                options={{
                  resourceType: "auto",
                  sources: ["local"],
                  clientAllowedFormats: ["pdf", "doc", "docx"],
                  maxFileSize: 20971520,
                }}
                onSuccess={(result, { widget }) => {
                  const info = result?.info as
                    | { secure_url?: string; original_filename?: string; format?: string }
                    | undefined;
                  if (info?.secure_url) {
                    setUploadUrl(info.secure_url);
                    setUploadName(
                      info.original_filename
                        ? `${info.original_filename}${info.format ? "." + info.format : ""}`
                        : "file"
                    );
                  }
                  widget.close();
                }}
              >
                {({ open }) => (
                  <div
                    onClick={() => open()}
                    className="flex items-center gap-3 cursor-pointer rounded-lg border-2 border-dashed border-gray-300 dark:border-slate-700 p-3 hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/10 shrink-0">
                      <UploadCloud size={16} className="text-blue-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-700 dark:text-slate-200">
                        {uploadName ? "File ready" : "Choose your completed file"}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-slate-500 truncate">
                        {uploadName ?? "PDF, DOC, or DOCX - up to 20MB"}
                      </p>
                    </div>
                    {uploadName && (
                      <CheckCircle2 size={16} className="text-green-500 ml-auto shrink-0" />
                    )}
                  </div>
                )}
              </CldUploadWidget>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={hasQuiz ? answers.some((a) => a === -1) : !uploadUrl}
            className="bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-white px-4 py-2.5 rounded-lg text-sm font-semibold w-fit"
          >
            {existingSubmission ? "Resubmit" : "Submit"}
          </button>
        </>
      )}
    </div>
  );
};

export default WorkSubmitPanel;
