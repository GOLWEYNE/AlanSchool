"use client";

import { useEffect } from "react";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { enrollInClub, withdrawFromClub } from "@/lib/masterModuleActions";

type EnrollState = { success: boolean; error: boolean; message?: string };

const initialState: EnrollState = { success: false, error: false };

export type ClubEnrollStudent = {
  id: string;
  label: string;
  enrollment: { id: number; status: "ACTIVE" | "WAITLISTED" } | null;
  waitlistPosition?: number;
};

const ClubEnrollRow = ({
  clubId,
  student,
  full,
  showLabel,
}: {
  clubId: number;
  student: ClubEnrollStudent;
  full: boolean;
  showLabel: boolean;
}) => {
  const router = useRouter();
  const [enrollState, enrollAction] = useFormState(enrollInClub, initialState);
  const [withdrawState, withdrawAction] = useFormState(withdrawFromClub, initialState);

  useEffect(() => {
    if (enrollState.success) {
      toast("Enrollment updated.");
      router.refresh();
    } else if (enrollState.error && enrollState.message) {
      toast.error(enrollState.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrollState]);

  useEffect(() => {
    if (withdrawState.success) {
      toast("Left the club.");
      router.refresh();
    } else if (withdrawState.error && withdrawState.message) {
      toast.error(withdrawState.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withdrawState]);

  const { enrollment } = student;

  return (
    <div className="flex items-center justify-between gap-3 text-sm py-1">
      <div className="flex items-center gap-2">
        {showLabel && (
          <span className="text-gray-700 dark:text-slate-300">{student.label}</span>
        )}
        {enrollment?.status === "ACTIVE" && (
          <span className="rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 px-2 py-0.5 text-xs font-semibold">
            Enrolled
          </span>
        )}
        {enrollment?.status === "WAITLISTED" && (
          <span className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 px-2 py-0.5 text-xs font-semibold">
            Waitlisted{student.waitlistPosition ? ` #${student.waitlistPosition}` : ""}
          </span>
        )}
        {!enrollment && (
          <span className="text-gray-400 dark:text-slate-500 text-xs">Not enrolled</span>
        )}
      </div>

      {enrollment ? (
        <button
          type="button"
          className="text-xs font-semibold text-red-600 hover:underline whitespace-nowrap"
          onClick={() => {
            const fd = new FormData();
            fd.set("id", String(enrollment.id));
            withdrawAction(fd);
          }}
        >
          {enrollment.status === "WAITLISTED" ? "Leave waitlist" : "Leave"}
        </button>
      ) : (
        <button
          type="button"
          className="text-xs font-semibold text-blue-700 dark:text-blue-300 hover:underline whitespace-nowrap"
          onClick={() => enrollAction({ clubId, studentId: student.id })}
        >
          {full ? "Join waitlist" : "Join"}
        </button>
      )}
    </div>
  );
};

// Renders one row per relevant student (the student themself, or each of a
// parent's children) with a Join/Leave control reflecting live capacity —
// this is what makes club enrollment self-service instead of admin-only.
const ClubEnrollControls = ({
  clubId,
  full,
  students,
}: {
  clubId: number;
  full: boolean;
  students: ClubEnrollStudent[];
}) => {
  if (students.length === 0) return null;

  return (
    <div className="flex flex-col gap-1 min-w-[160px]">
      {students.map((student) => (
        <ClubEnrollRow
          key={student.id}
          clubId={clubId}
          student={student}
          full={full}
          showLabel={students.length > 1}
        />
      ))}
    </div>
  );
};

export default ClubEnrollControls;
