"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { checkInAttendance } from "@/lib/masterModuleActions";

type Feedback = { kind: "success" | "already" | "error"; text: string } | null;
type LogEntry = { key: string; name: string; time: string; already: boolean };

// The actual "cut daily admin time" flow: a single auto-focused text input
// that a plain USB/Bluetooth barcode scanner can "type" into (that's all a
// keyboard-wedge scanner is - a keyboard that types the decoded text then
// presses Enter), wired straight to checkInAttendance. No camera, no QR
// decoding library, no new npm dependency - just an input and a server
// action, which is what actually makes this buildable/shippable here.
const CheckInScanner = ({
  classId,
  date,
  className,
}: {
  classId: number;
  date: string;
  className: string;
}) => {
  const t = useTranslations("List.checkin");
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [log, setLog] = useState<LogEntry[]>([]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // A scanner only "types" into whatever element currently has focus, so
  // if the teacher's cursor wanders off (a stray click, a tab switch) the
  // next scan would silently go nowhere. Cheap insurance: pull focus back
  // to the input whenever the page is clicked.
  useEffect(() => {
    const refocus = () => inputRef.current?.focus();
    window.addEventListener("click", refocus);
    return () => window.removeEventListener("click", refocus);
  }, []);

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 2500);
    return () => clearTimeout(timer);
  }, [feedback]);

  const submitCode = async (code: string) => {
    if (!code.trim() || pending) return;
    setPending(true);
    setValue("");
    try {
      const result = await checkInAttendance({ code, classId, date: new Date(date) });
      if (result.success) {
        const name = result.studentName ?? "";
        setFeedback({
          kind: result.alreadyMarked ? "already" : "success",
          text: result.alreadyMarked
            ? t("alreadyToast", { name })
            : t("successToast", { name }),
        });
        setLog((prev) => [
          {
            key: `${Date.now()}-${name}`,
            name,
            time: new Date().toLocaleTimeString(),
            already: !!result.alreadyMarked,
          },
          ...prev,
        ]);
      } else {
        setFeedback({ kind: "error", text: result.message || t("notFoundToast") });
      }
    } finally {
      setPending(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="panel-card p-4 rounded-md mb-4 shine-hover flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-100">{className}</h2>
        <span className="text-xs text-gray-500 dark:text-slate-400">{date}</span>
      </div>

      <input
        ref={inputRef}
        value={value}
        disabled={pending}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submitCode(value);
          }
        }}
        placeholder={t("inputPlaceholder")}
        autoFocus
        className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-4 rounded-md text-lg text-center font-mono"
      />

      {feedback ? (
        <div
          className={`rounded-md p-4 text-center text-lg font-semibold ${
            feedback.kind === "success"
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
              : feedback.kind === "already"
              ? "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
              : "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
          }`}
        >
          {feedback.text}
        </div>
      ) : (
        <p className="text-center text-sm text-gray-400 dark:text-slate-500">{t("scanPrompt")}</p>
      )}

      <div>
        <h3 className="text-sm font-semibold text-gray-500 dark:text-slate-400 mb-2">
          {t("rosterLabel", { count: log.length })}
        </h3>
        {log.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-slate-500">{t("sessionListEmpty")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-gray-100 dark:divide-slate-800 max-h-72 overflow-y-auto">
            {log.map((entry) => (
              <li key={entry.key} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>{entry.name}</span>
                <span className="text-xs text-gray-400 dark:text-slate-500">
                  {entry.already ? t("alreadyBadge") : entry.time}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default CheckInScanner;
