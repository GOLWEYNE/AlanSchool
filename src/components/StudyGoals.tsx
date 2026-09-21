"use client";

import { FormEvent, useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";
import {
  createStudyGoal,
  deleteStudyGoal,
  setStudyGoalProgress,
} from "@/lib/studyGoalActions";

export type StudyGoalItem = {
  id: number;
  title: string;
  subjectName: string | null;
  /** ISO instant (school-time midnight of the target day), or null. */
  targetDate: string | null;
  progress: number;
  completedAt: string | null;
  overdue: boolean;
};

type Props = {
  goals: StudyGoalItem[];
  subjects: { id: number; name: string }[];
  maxGoals: number;
  /** The goals table could not be read - show a notice instead of the tracker. */
  unavailable?: boolean;
};

const STEPS = [0, 25, 50, 75, 100];

const inputClass =
  "w-full rounded-lg border border-blue-100 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-gray-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-300";

const StudyGoals = ({ goals, subjects, maxGoals, unavailable }: Props) => {
  const t = useTranslations("StudyPlanner.goals");
  const format = useFormatter();
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [targetDate, setTargetDate] = useState("");

  const done = goals.filter((g) => g.completedAt !== null);
  const open = goals.filter((g) => g.completedAt === null);
  const average = goals.length
    ? Math.round(goals.reduce((sum, g) => sum + g.progress, 0) / goals.length)
    : 0;

  const showError = (code: string) => {
    const known = ["unauthorized", "invalid", "limit", "notFound", "unavailable"];
    setError(t(`errors.${known.includes(code) ? code : "generic"}`, { max: maxGoals }));
  };

  const onAdd = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createStudyGoal({
        title,
        subjectId: subjectId ? Number(subjectId) : null,
        targetDate: targetDate || null,
      });
      if (result.ok) {
        setTitle("");
        setSubjectId("");
        setTargetDate("");
      } else {
        showError(result.error);
      }
    });
  };

  const onProgress = (goal: StudyGoalItem, progress: number) => {
    if (progress === goal.progress) return;
    setError(null);
    setBusyId(goal.id);
    startTransition(async () => {
      const result = await setStudyGoalProgress(goal.id, progress);
      if (!result.ok) showError(result.error);
      setBusyId(null);
    });
  };

  const onDelete = (goal: StudyGoalItem) => {
    if (!window.confirm(t("confirmDelete"))) return;
    setError(null);
    setBusyId(goal.id);
    startTransition(async () => {
      const result = await deleteStudyGoal(goal.id);
      if (!result.ok) showError(result.error);
      setBusyId(null);
    });
  };

  const dateLabel = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "medium" });

  const renderGoal = (goal: StudyGoalItem) => {
    const finished = goal.completedAt !== null;
    const busy = busyId === goal.id;
    return (
      <li
        key={goal.id}
        className={`rounded-xl border p-4 transition-opacity ${
          finished
            ? "border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-950/20"
            : "border-blue-100 dark:border-slate-800 bg-white dark:bg-slate-900/60"
        } ${busy ? "opacity-60" : ""}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h4
              className={`font-semibold break-words ${
                finished
                  ? "text-emerald-800 dark:text-emerald-300"
                  : "text-gray-800 dark:text-blue-100"
              }`}
            >
              {finished ? "✓ " : ""}
              {goal.title}
            </h4>
            <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] font-medium">
              {goal.subjectName && (
                <span className="rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-2 py-0.5">
                  {goal.subjectName}
                </span>
              )}
              {goal.targetDate && !finished && (
                <span
                  className={`rounded-full px-2 py-0.5 ${
                    goal.overdue
                      ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300"
                      : "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300"
                  }`}
                >
                  {goal.overdue ? t("overdue") : t("due", { date: dateLabel(goal.targetDate) })}
                </span>
              )}
              {finished && goal.completedAt && (
                <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5">
                  {t("doneOn", { date: dateLabel(goal.completedAt) })}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onDelete(goal)}
            disabled={busy}
            aria-label={t("delete")}
            title={t("delete")}
            className="shrink-0 rounded-lg px-2 py-1 text-xs text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            ✕
          </button>
        </div>

        <div
          className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-slate-800"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={goal.progress}
          aria-label={t("progressLabel")}
        >
          <div
            className={`h-full rounded-full transition-all ${
              finished ? "bg-emerald-500" : "bg-gradient-to-r from-yellow-400 to-blue-500"
            }`}
            style={{ width: `${goal.progress}%` }}
          />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label={t("progressLabel")}>
          {STEPS.map((step) => (
            <button
              key={step}
              type="button"
              onClick={() => onProgress(goal, step)}
              disabled={busy}
              aria-pressed={goal.progress === step}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold border transition-colors ${
                goal.progress === step
                  ? "bg-blue-600 border-blue-600 text-white"
                  : "bg-white dark:bg-slate-900 border-blue-100 dark:border-slate-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-slate-800"
              }`}
            >
              {step === 100 ? t("markDone") : `${step}%`}
            </button>
          ))}
        </div>
      </li>
    );
  };

  if (unavailable) {
    return (
      <p className="rounded-xl border border-dashed border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4 text-sm text-amber-800 dark:text-amber-300">
        {t("errors.unavailable")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 p-3">
          <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">{goals.length}</div>
          <div className="text-[11px] uppercase tracking-wide text-blue-700 dark:text-blue-300">{t("stats.total")}</div>
        </div>
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 p-3">
          <div className="text-2xl font-bold text-emerald-800 dark:text-emerald-200">{done.length}</div>
          <div className="text-[11px] uppercase tracking-wide text-emerald-700 dark:text-emerald-300">{t("stats.done")}</div>
        </div>
        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 p-3">
          <div className="text-2xl font-bold text-amber-800 dark:text-amber-200">{average}%</div>
          <div className="text-[11px] uppercase tracking-wide text-amber-700 dark:text-amber-300">{t("stats.average")}</div>
        </div>
      </div>

      <form onSubmit={onAdd} className="rounded-xl border border-blue-100 dark:border-slate-800 bg-blue-50/40 dark:bg-slate-900/40 p-4 flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-600 dark:text-slate-300">
          {t("form.titleLabel")}
          <input
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            required
            placeholder={t("form.titlePlaceholder")}
          />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-600 dark:text-slate-300">
            {t("form.subjectLabel")}
            <select className={inputClass} value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">{t("form.noSubject")}</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-600 dark:text-slate-300">
            {t("form.dateLabel")}
            <input
              type="date"
              className={inputClass}
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </label>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending || title.trim().length === 0}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending && busyId === null ? t("form.adding") : t("form.add")}
          </button>
          <span className="text-xs text-gray-400 dark:text-slate-500">{t("form.limit", { max: maxGoals })}</span>
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </form>

      {goals.length === 0 ? (
        <p className="rounded-xl border border-dashed border-blue-100 dark:border-slate-800 p-6 text-center text-sm text-gray-400 dark:text-slate-500">
          {t("empty")}
        </p>
      ) : (
        <>
          {open.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-blue-100">{t("active")}</h3>
              <ul className="flex flex-col gap-2">{open.map(renderGoal)}</ul>
            </section>
          )}
          {done.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-blue-100">{t("completed")}</h3>
              <ul className="flex flex-col gap-2">{done.map(renderGoal)}</ul>
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default StudyGoals;
