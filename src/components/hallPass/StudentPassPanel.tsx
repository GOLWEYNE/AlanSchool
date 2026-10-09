"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { endPass, requestPass } from "@/lib/hallPassActions";
import type { StudentPassState } from "@/lib/hallPassShared";
import { formatSchoolTime } from "@/lib/hallPassShared";
import { formatClock, useServerNow } from "./clock";

const CARD =
  "rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900";

// What a student sees: pick a destination to leave class, then tap "I'm back".
export default function StudentPassPanel({ state }: { state: StudentPassState }) {
  const t = useTranslations("HallPass");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const now = useServerNow(state.serverNow);

  const leave = (destinationId: number) => {
    setError(null);
    startTransition(async () => {
      const res = await requestPass(destinationId);
      if (!res.ok) setError(res.error ?? t("errors.generic"));
      router.refresh();
    });
  };

  const comeBack = (passId: number) => {
    setError(null);
    startTransition(async () => {
      const res = await endPass(passId);
      if (!res.ok) setError(res.error ?? t("errors.generic"));
      router.refresh();
    });
  };

  const active = state.active;
  const elapsed = active ? now - Date.parse(active.issuedAt) : 0;
  const limitMs = active ? active.maxMinutes * 60_000 : 0;
  const overdue = !!active && elapsed > limitMs;

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm font-medium text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-300"
        >
          {error}
        </div>
      )}

      {active ? (
        <div
          className={
            CARD + " flex flex-col items-center gap-3 text-center " + (overdue ? "!border-rose-400 !bg-rose-50 dark:!bg-rose-950/30" : "")
          }
        >
          <p className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">{t("student.youAreOut")}</p>
          <p className="text-xl font-bold dark:text-slate-100">{active.destination}</p>
          <p
            suppressHydrationWarning
            className={"text-5xl font-extrabold tabular-nums " + (overdue ? "text-rose-600" : "text-blue-600 dark:text-blue-400")}
          >
            {formatClock(elapsed)}
          </p>
          <p className="text-sm text-gray-500 dark:text-slate-400">{t("student.timeLimit", { minutes: active.maxMinutes })}</p>
          {overdue && <p className="text-sm font-semibold text-rose-600">{t("student.overdueNotice")}</p>}
          <button
            type="button"
            disabled={pending}
            onClick={() => comeBack(active.id)}
            className="mt-1 w-full max-w-xs rounded-xl bg-emerald-600 px-6 py-3 text-lg font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {pending ? t("student.ending") : t("student.iAmBack")}
          </button>
        </div>
      ) : (
        <div className={CARD}>
          <h2 className="text-lg font-semibold dark:text-slate-100">{t("student.chooseDestination")}</h2>
          {state.destinations.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">{t("student.noDestinations")}</p>
          ) : (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {state.destinations.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  disabled={pending}
                  onClick={() => leave(d.id)}
                  className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-left transition hover:border-blue-400 hover:bg-blue-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
                >
                  <span className="block text-base font-semibold text-blue-800 dark:text-blue-300">{d.name}</span>
                  <span className="mt-1 block text-xs text-gray-500 dark:text-slate-400">
                    {t("student.maxTime", { minutes: d.maxMinutes })}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className={CARD}>
        <h2 className="text-lg font-semibold dark:text-slate-100">{t("student.todayTitle")}</h2>
        {state.today.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">{t("student.noneToday")}</p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-100 dark:divide-slate-800">
            {state.today.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <span className="font-medium dark:text-slate-100">{p.destination}</span>
                <span className="text-gray-500 dark:text-slate-400">
                  {formatSchoolTime(p.issuedAt)}
                  {p.returnedAt ? ` - ${formatSchoolTime(p.returnedAt)}` : ""}
                </span>
                <span className="ml-auto text-xs font-semibold text-gray-500 dark:text-slate-400">{t("status." + p.status)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
