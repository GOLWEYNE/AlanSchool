"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { loadStandardObjectives, type LoadStandardResult } from "@/lib/standardObjectivesActions";

// Admin-only helper on the Objectives page: adds the draft standard objectives
// for the Kazakhstan subjects and grades (existing ones are kept, duplicates skipped).
const LoadStandardObjectives = ({ total }: { total: number }) => {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<LoadStandardResult | null>(null);
  const [pending, startTransition] = useTransition();

  const run = () =>
    startTransition(async () => {
      const res = await loadStandardObjectives();
      setResult(res);
      setConfirming(false);
      router.refresh();
    });

  return (
    <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-slate-700 dark:bg-slate-800 dark:text-blue-100">
      <div className="font-semibold">Standard Kazakhstan objectives</div>
      <p className="mt-1 text-xs opacity-80">
        Adds about {total} draft objectives for the standard subjects and grades (physical education, languages, mathematics,
        sciences, history and more). Existing objectives are kept and duplicates are skipped. Edit them afterwards as needed.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={pending}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            Load standard objectives
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={run}
              disabled={pending}
              className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-60"
            >
              {pending ? "Loading..." : "Yes, add them"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={pending}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-slate-200"
            >
              Cancel
            </button>
          </>
        )}
        {result && (
          <span className={`text-xs ${result.ok ? "text-green-700 dark:text-green-300" : "text-red-600"}`}>
            {result.ok
              ? `Added ${result.added} objectives, skipped ${result.skipped} duplicates, created ${result.subjectsCreated} new subjects.` +
                (result.missingGrades.length ? ` No grade record for level(s): ${result.missingGrades.join(", ")}.` : "")
              : result.error}
          </span>
        )}
      </div>
    </div>
  );
};

export default LoadStandardObjectives;
