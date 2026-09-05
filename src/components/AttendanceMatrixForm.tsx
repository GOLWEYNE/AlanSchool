"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { recordAttendanceBulk } from "@/lib/masterModuleActions";

type Status = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

type StudentRow = {
  id: string;
  name: string;
  surname: string;
  status: Status;
};

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: "PRESENT", label: "Present" },
  { value: "ABSENT", label: "Absent" },
  { value: "LATE", label: "Late" },
  { value: "EXCUSED", label: "Excused" },
];

const STATUS_STYLES: Record<Status, string> = {
  PRESENT: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  ABSENT: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  LATE: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  EXCUSED: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
};

// The class/date-scoped matrix that backs the new dedicated attendance
// route: a teacher/admin marks a whole roster in one submit, wired to the
// existing (previously unused) recordAttendanceBulk server action.
const AttendanceMatrixForm = ({
  classId,
  date,
  students,
}: {
  classId: number;
  date: string;
  students: { id: string; name: string; surname: string; existingStatus?: Status }[];
}) => {
  const router = useRouter();

  const buildRows = (): StudentRow[] =>
    students.map((s) => ({
      id: s.id,
      name: s.name,
      surname: s.surname,
      status: s.existingStatus ?? "PRESENT",
    }));

  const [rows, setRows] = useState<StudentRow[]>(buildRows);

  // Reset the grid whenever the class/date/roster changes underneath it
  // (e.g. the teacher picks a different day) instead of keeping stale rows.
  useEffect(() => {
    setRows(buildRows());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, date, students.map((s) => s.id).join(",")]);

  const [state, formAction] = useFormState(recordAttendanceBulk, {
    success: false,
    error: false,
  });

  useEffect(() => {
    if (state.success) {
      toast("Attendance saved.");
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const tally = useMemo(() => {
    const counts: Record<Status, number> = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
    rows.forEach((r) => {
      counts[r.status] += 1;
    });
    return counts;
  }, [rows]);

  const setStatus = (studentId: string, status: Status) => {
    setRows((prev) => prev.map((r) => (r.id === studentId ? { ...r, status } : r)));
  };

  const markAll = (status: Status) => {
    setRows((prev) => prev.map((r) => ({ ...r, status })));
  };

  return (
    <div className="panel-card p-4 rounded-md mb-4 shine-hover">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
          Mark attendance
        </h2>
        <div className="flex flex-wrap gap-2 text-xs">
          {STATUS_OPTIONS.map((opt) => (
            <span
              key={opt.value}
              className={`rounded-full px-2.5 py-1 font-semibold ${STATUS_STYLES[opt.value]}`}
            >
              {opt.label}: {tally[opt.value]}
            </span>
          ))}
        </div>
      </div>

      {rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-xs text-gray-500 dark:text-slate-400 mr-1">Quick fill:</span>
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => markAll(opt.value)}
              className="text-xs font-semibold px-2.5 py-1 rounded-md ring-1 ring-gray-300 dark:ring-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800"
            >
              All {opt.label}
            </button>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400">
          No students in this class.
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-gray-100 dark:divide-slate-800">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span>
                {r.name} {r.surname}
              </span>
              <select
                className={`ring-[1.5px] ring-gray-300 dark:ring-slate-700 p-1.5 rounded-md text-xs font-semibold ${STATUS_STYLES[r.status]}`}
                value={r.status}
                onChange={(e) => setStatus(r.id, e.target.value as Status)}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {state.error && (
        <span className="text-red-500 text-sm block mt-2">
          {state.message || "Something went wrong."}
        </span>
      )}

      {rows.length > 0 && (
        <button
          type="button"
          onClick={() =>
            formAction({
              classId,
              date: new Date(date),
              records: rows.map((r) => ({ studentId: r.id, status: r.status })),
            })
          }
          className="bg-blue-500 text-white px-4 py-2 rounded-md text-sm font-semibold mt-4"
        >
          Save attendance
        </button>
      )}
    </div>
  );
};

export default AttendanceMatrixForm;
