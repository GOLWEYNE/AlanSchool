import { CheckCircle2, Clock, FileText, AlertCircle } from "lucide-react";

type Submission = {
  fileUrl: string | null;
  fileName: string | null;
  submittedAt: string | null;
  status: string;
  grade: number | null;
  feedback: string | null;
} | null;

// Read-only summary a parent sees of their child's homework/exam submission -
// the same status, grade and feedback the student and teacher already see,
// just without any way to edit it. Renders on the assignment/exam detail
// page whenever the signed-in user is a parent.
const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  GRADED: {
    label: "Graded",
    className:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300",
  },
  SUBMITTED: {
    label: "Submitted",
    className:
      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300",
  },
  LATE: {
    label: "Submitted late",
    className:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300",
  },
  MISSING: {
    label: "Not submitted",
    className:
      "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300",
  },
  PENDING: {
    label: "Not submitted yet",
    className:
      "bg-gray-50 text-gray-600 border-gray-200 dark:bg-slate-800/60 dark:text-slate-300",
  },
};

const ParentSubmissionStatus = ({
  childName,
  submission,
}: {
  childName: string;
  submission: Submission;
}) => {
  const status = submission?.status ?? "PENDING";
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.PENDING;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-500 dark:text-slate-400">
          {childName}&apos;s submission
        </p>
        <span
          className={`text-xs font-semibold px-3 py-1.5 rounded-full border flex items-center gap-1.5 shrink-0 ${style.className}`}
        >
          {status === "GRADED" ? (
            <CheckCircle2 size={12} />
          ) : status === "LATE" ? (
            <AlertCircle size={12} />
          ) : (
            <Clock size={12} />
          )}
          {style.label}
        </span>
      </div>

      {submission?.submittedAt && (
        <p className="text-xs text-gray-500 dark:text-slate-400">
          Submitted {new Date(submission.submittedAt).toLocaleString()}
        </p>
      )}

      {submission?.fileUrl && (
        <a
          href={submission.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-300 hover:underline w-fit"
        >
          <FileText size={16} /> {submission.fileName ?? "View submitted file"}
        </a>
      )}

      {status === "GRADED" && (
        <div className="rounded-lg border border-gray-200 dark:border-slate-700 p-3 text-sm">
          <p className="text-gray-700 dark:text-slate-300">
            Grade: <span className="font-semibold">{submission?.grade}</span>
          </p>
          {submission?.feedback && (
            <p className="mt-1 text-gray-600 dark:text-slate-400">
              {submission.feedback}
            </p>
          )}
        </div>
      )}

      {(!submission || status === "PENDING" || status === "MISSING") && (
        <p className="text-xs text-gray-500 dark:text-slate-400">
          {childName} hasn&apos;t submitted this yet.
        </p>
      )}
    </div>
  );
};

export default ParentSubmissionStatus;
