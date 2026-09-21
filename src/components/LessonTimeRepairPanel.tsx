"use client";

import { useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";
import {
  applyLessonTimeRepairAction,
  undoLessonTimeRepairAction,
} from "@/lib/lessonTimeRepairActions";

type Slot = {
  n: number;
  shownStart: string;
  shownEnd: string;
  fixedStart: string;
  fixedEnd: string;
  count: number;
};

type Props = {
  pendingCount: number;
  classCount: number;
  slots: Slot[];
  appliedCount: number;
  /** ISO instant of the repair, or null. */
  appliedAt: string | null;
};

const LessonTimeRepairPanel = ({ pendingCount, classCount, slots, appliedCount, appliedAt }: Props) => {
  const t = useTranslations("LessonTimes.repair");
  const format = useFormatter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const run = (
    action: () => Promise<{ ok: true; count: number } | { ok: false; error: string }>,
    doneKey: "applied" | "undone"
  ) => {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setMessage({ tone: "ok", text: t(doneKey, { count: result.count }) });
      } else {
        setMessage({ tone: "error", text: t(result.error === "unauthorized" ? "errors.unauthorized" : "errors.failed") });
      }
    });
  };

  const onApply = () => {
    if (!window.confirm(t("confirmApply", { count: pendingCount }))) return;
    run(applyLessonTimeRepairAction, "applied");
  };

  const onUndo = () => {
    if (!window.confirm(t("confirmUndo", { count: appliedCount }))) return;
    run(undoLessonTimeRepairAction, "undone");
  };

  return (
    <div className="flex flex-col gap-4">
      {pendingCount > 0 ? (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4 flex flex-col gap-3">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            {t("pending", { count: pendingCount, classes: classCount })}
          </p>
          <p className="text-sm text-amber-800 dark:text-amber-300">{t("pendingHelp")}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-amber-700 dark:text-amber-400">
                  <th className="py-1 pr-4">{t("colLesson")}</th>
                  <th className="py-1 pr-4">{t("colNow")}</th>
                  <th className="py-1 pr-4">{t("colAfter")}</th>
                  <th className="py-1">{t("colCount")}</th>
                </tr>
              </thead>
              <tbody>
                {slots.map((s) => (
                  <tr key={s.n} className="border-t border-amber-100 dark:border-amber-900/50 text-gray-800 dark:text-slate-200">
                    <td className="py-1 pr-4">{s.n}</td>
                    <td className="py-1 pr-4 line-through opacity-70">
                      {s.shownStart} – {s.shownEnd}
                    </td>
                    <td className="py-1 pr-4 font-semibold">
                      {s.fixedStart} – {s.fixedEnd}
                    </td>
                    <td className="py-1">{s.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <button
              type="button"
              onClick={onApply}
              disabled={isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isPending ? t("working") : t("apply", { count: pendingCount })}
            </button>
          </div>
        </div>
      ) : (
        <p className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/20 p-4 text-sm text-emerald-800 dark:text-emerald-300">
          {t("nothingPending")}
        </p>
      )}

      {appliedCount > 0 && (
        <div className="rounded-xl border border-blue-100 dark:border-slate-800 bg-blue-50/40 dark:bg-slate-900/40 p-4 flex flex-col gap-2">
          <p className="text-sm text-gray-700 dark:text-slate-300">
            {t("appliedInfo", {
              count: appliedCount,
              date: appliedAt ? format.dateTime(new Date(appliedAt), { dateStyle: "medium", timeStyle: "short" }) : "",
            })}
          </p>
          <p className="text-xs text-gray-500 dark:text-slate-400">{t("undoHelp")}</p>
          <div>
            <button
              type="button"
              onClick={onUndo}
              disabled={isPending}
              className="rounded-lg border border-blue-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-slate-800 disabled:opacity-50"
            >
              {t("undo")}
            </button>
          </div>
        </div>
      )}

      {message && (
        <p
          role={message.tone === "error" ? "alert" : "status"}
          className={`text-sm ${
            message.tone === "error" ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-300"
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
};

export default LessonTimeRepairPanel;
