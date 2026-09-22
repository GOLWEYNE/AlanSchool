"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { recordClubAttendanceBulk } from "@/lib/masterModuleActions";

type Status = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

type StudentRow = {
  id: string;
  name: string;
  surname: string;
  className?: string;
  status: Status;
};

const STATUS_STYLES: Record<Status, string> = {
  PRESENT: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  ABSENT: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  LATE: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  EXCUSED: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
};

const inputClass =
  "ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2 rounded-md text-sm";

// Club counterpart of AttendanceMatrixForm: same roster grid, quick-fill and
// tally, plus the meeting's start/end time. Saving creates the day's
// ClubSession if there isn't one yet (see recordClubAttendanceBulk).
const ClubAttendanceMatrixForm = ({
  clubId,
  date,
  defaultStart,
  defaultEnd,
  students,
}: {
  clubId: number;
  date: string;
  defaultStart: string;
  defaultEnd: string;
  students: {
    id: string;
    name: string;
    surname: string;
    className?: string;
    existingStatus?: Status;
  }[];
}) => {
  const router = useRouter();
  const t = useTranslations("List.attendance");
  const tc = useTranslations("List.clubAttendance");

  const STATUS_OPTIONS: { value: Status; label: string }[] = [
    { value: "PRESENT", label: t("statusPresent") },
    { value: "ABSENT", label: t("statusAbsent") },
    { value: "LATE", label: t("statusLate") },
    { value: "EXCUSED", label: t("statusExcused") },
  ];

  const buildRows = (): StudentRow[] =>
    students.map((s) => ({
      id: s.id,
      name: s.name,
      surname: s.surname,
      className: s.className,
      status: s.existingStatus ?? "PRESENT",
    }));

  const [rows, setRows] = useState<StudentRow[]>(buildRows);
  const [startTime, setStartTime] = useState(defaultStart);
  const [endTime, setEndTime] = useState(defaultEnd);

  useEffect(() => {
    setRows(buildRows());
    setStartTime(defaultStart);
    setEndTime(defaultEnd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId, date, defaultStart, defaultEnd, students.map((s) => s.id).join(",")]);

  const [state, formAction] = useFormState(recordClubAttendanceBulk, {
    success: false,
    error: false,
  });

  useEffect(() => {
    if (state.success) {
      toast(t("attendanceSaved"));
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

  const timesValid = startTime < endTime;

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
          {t("markAttendance")}
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

      <div className="flex flex-wrap items-end gap-4 mb-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 dark:text-slate-400">{tc("startLabel")}</label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 dark:text-slate-400">{tc("endLabel")}</label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className={inputClass}
          />
        </div>
        {!timesValid && (
          <span className="text-red-500 text-xs pb-2">{tc("timeOrderError")}</span>
        )}
      </div>

      {rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-xs text-gray-500 dark:text-slate-400 mr-1">{t("quickFill")}</span>
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => markAll(opt.value)}
              className="text-xs font-semibold px-2.5 py-1 rounded-md ring-1 ring-gray-300 dark:ring-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800"
            >
              {t("allStatus", { status: opt.label })}
            </button>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400">{tc("noMembers")}</p>
      ) : (
        <div className="flex flex-col divide-y divide-gray-100 dark:divide-slate-800">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span>
                {r.name} {r.surname}
                {r.className && (
                  <span className="ml-2 text-xs text-gray-500 dark:text-slate-400">
                    {r.className}
                  </span>
                )}
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
          {state.message || t("somethingWrong")}
        </span>
      )}

      {rows.length > 0 && (
        <button
          type="button"
          disabled={!timesValid}
          onClick={() =>
            formAction({
              clubId,
              date,
              startTime,
              endTime,
              records: rows.map((r) => ({ studentId: r.id, status: r.status })),
            })
          }
          className="bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-md text-sm font-semibold mt-4"
        >
          {t("saveAttendance")}
        </button>
      )}
    </div>
  );
};

export default ClubAttendanceMatrixForm;
