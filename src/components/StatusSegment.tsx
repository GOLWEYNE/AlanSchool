"use client";

import { Check, Clock, FileText, X, type LucideIcon } from "lucide-react";

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

const ICONS: Record<AttendanceStatus, LucideIcon> = {
  PRESENT: Check,
  ABSENT: X,
  LATE: Clock,
  EXCUSED: FileText,
};

// Solid colour once chosen, so the whole roster reads at a glance.
const ACTIVE: Record<AttendanceStatus, string> = {
  PRESENT: "bg-emerald-500 text-white shadow-sm",
  ABSENT: "bg-red-500 text-white shadow-sm",
  LATE: "bg-amber-500 text-white shadow-sm",
  EXCUSED: "bg-sky-500 text-white shadow-sm",
};

// Four big tap targets in a row (each at least 48px tall) for marking one
// student on a phone: one tap sets Present, Absent, Late or Excused. The
// tablet and desktop layouts keep their compact dropdown.
export default function StatusSegment({
  value,
  options,
  onChange,
}: {
  value: AttendanceStatus;
  options: { value: AttendanceStatus; label: string }[];
  onChange: (status: AttendanceStatus) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-1.5 md:hidden" role="radiogroup">
      {options.map((opt) => {
        const Icon = ICONS[opt.value];
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={opt.label}
            onClick={() => {
              try {
                navigator.vibrate?.(6);
              } catch {
                /* haptics are optional */
              }
              onChange(opt.value);
            }}
            className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[11px] font-semibold transition active:scale-95 ${
              active
                ? ACTIVE[opt.value]
                : "bg-white/70 text-gray-600 ring-1 ring-gray-200 dark:bg-slate-800/60 dark:text-slate-300 dark:ring-slate-700"
            }`}
          >
            <Icon size={18} strokeWidth={2.5} aria-hidden="true" />
            <span className="max-w-full truncate">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
