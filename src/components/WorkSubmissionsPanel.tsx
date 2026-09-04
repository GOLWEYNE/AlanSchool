"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { gradeSubmission } from "@/lib/actions";

type Row = {
  studentId: string;
  name: string;
  surname: string;
  submission: {
    id: number;
    fileUrl: string | null;
    fileName: string | null;
    submittedAt: string | null;
    status: string;
    grade: number | null;
    feedback: string | null;
    autoGraded: boolean;
  } | null;
};

const statusBadge: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-300",
  SUBMITTED: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  LATE: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  GRADED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  MISSING: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
};

// One row: a student's submission status, their file (if any), and either
// their auto-graded quiz score (read-only) or a small inline form for a
// teacher/admin to type a grade + feedback for a file-based submission.
const GradeRow = ({ row }: { row: Row }) => {
  const router = useRouter();
  const [state, formAction] = useFormState(gradeSubmission, {
    success: false,
    error: false,
  });
  const [grade, setGrade] = useState(row.submission?.grade ?? 0);
  const [feedback, setFeedback] = useState(row.submission?.feedback ?? "");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (state.success) {
      toast("Grade saved.");
      setEditing(false);
      router.refresh();
    } else if (state.error) {
      toast.error("Couldn't save the grade.");
    }
  }, [state, router]);

  const status = row.submission?.status ?? "MISSING";

  return (
    <tr className="border-b border-gray-200 dark:border-slate-800 text-sm">
      <td className="p-3">
        {row.name} {row.surname}
      </td>
      <td className="p-3">
        <span
          className={`text-xs font-semibold px-2 py-1 rounded-full ${
            statusBadge[status] ?? statusBadge.MISSING
          }`}
        >
          {status}
        </span>
      </td>
      <td className="p-3 text-xs text-gray-500 dark:text-slate-400">
        {row.submission?.submittedAt
          ? new Date(row.submission.submittedAt).toLocaleString()
          : "-"}
      </td>
      <td className="p-3">
        {row.submission?.fileUrl ? (
          <a
            href={row.submission.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline flex items-center gap-1 text-xs"
          >
            <FileText size={12} /> {row.submission.fileName ?? "Download"}
          </a>
        ) : (
          <span className="text-xs text-gray-400">-</span>
        )}
      </td>
      <td className="p-3">
        {!row.submission ? (
          <span className="text-xs text-gray-400">Not submitted</span>
        ) : row.submission.autoGraded ? (
          <span className="text-sm font-semibold">{row.submission.grade} (auto)</span>
        ) : editing ? (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              formAction({ submissionId: row.submission!.id, grade, feedback });
            }}
          >
            <input
              type="number"
              min={0}
              value={grade}
              onChange={(e) => setGrade(parseInt(e.target.value) || 0)}
              className="w-16 ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-1 rounded text-sm"
            />
            <input
              type="text"
              placeholder="Feedback (optional)"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="flex-1 min-w-0 ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-1 rounded text-sm"
            />
            <button
              type="submit"
              className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded shrink-0"
            >
              Save
            </button>
          </form>
        ) : (
          <button onClick={() => setEditing(true)} className="text-xs text-blue-500 hover:underline">
            {row.submission.grade !== null ? `${row.submission.grade} - edit` : "Grade"}
          </button>
        )}
      </td>
    </tr>
  );
};

const WorkSubmissionsPanel = ({ rows }: { rows: Row[] }) => {
  if (rows.length === 0) {
    return <p className="text-sm text-gray-400">No students are assigned this yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="text-left text-xs text-gray-500 dark:text-slate-400 border-b border-gray-200 dark:border-slate-800">
            <th className="p-3">Student</th>
            <th className="p-3">Status</th>
            <th className="p-3">Submitted</th>
            <th className="p-3">File</th>
            <th className="p-3">Grade</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <GradeRow key={row.studentId} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default WorkSubmissionsPanel;
