import { ClipboardList, PenLine, FileQuestion } from "lucide-react";
import MilestoneBadge from "./MilestoneBadge";
import { getSubjectIcon } from "./subjectIcons";
import { getMilestone, ReportCardResultRow } from "./types";

const scoreBarColor = (score: number) => {
  if (score >= 85) return "bg-emerald-500";
  if (score >= 70) return "bg-blue-500";
  return "bg-amber-500";
};

const ReportCardResultsTable = ({ results }: { results: ReportCardResultRow[] }) => {
  return (
    <div className="panel-card rounded-2xl p-5 md:p-6 shine-hover print:shadow-none print:ring-1 print:ring-slate-200">
      <div className="flex items-center gap-2 mb-4">
        <ClipboardList size={18} className="text-blue-600 dark:text-blue-300" />
        <h2 className="text-base font-bold text-gray-800 dark:text-blue-100">
          Results Breakdown
        </h2>
        {results.length > 0 && (
          <span className="ml-auto text-[11px] font-semibold text-gray-400 dark:text-slate-500">
            {results.length} assessment{results.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {results.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center gap-2 py-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800/70 border border-dashed border-slate-300 dark:border-slate-700">
            <FileQuestion size={24} className="text-slate-400 dark:text-slate-500" />
          </div>
          <p className="text-sm font-semibold text-gray-600 dark:text-slate-300">
            No recorded exam or assignment results yet
          </p>
          <p className="text-xs text-gray-400 dark:text-slate-500 max-w-xs">
            Results will appear here automatically as soon as this student&apos;s exams and
            assignments are graded.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {results.map((row) => {
            const SubjectIcon = getSubjectIcon(row.subject);
            const milestone = getMilestone(row.score);
            return (
              <li
                key={row.id}
                className="group flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-4 rounded-xl px-3 py-3 odd:bg-slate-50/70 even:bg-transparent dark:odd:bg-slate-900/40 hover:bg-blue-50/70 dark:hover:bg-blue-950/30 transition-colors"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-950/60 dark:to-slate-900 text-blue-600 dark:text-blue-300 ring-1 ring-blue-100 dark:ring-slate-800">
                  <SubjectIcon size={18} strokeWidth={2} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-800 dark:text-slate-100 truncate">
                    {row.subject}
                  </p>
                  <p className="flex items-center gap-1 text-xs text-gray-400 dark:text-slate-500 truncate">
                    <PenLine size={11} />
                    {row.type}: {row.assessment}
                  </p>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-48 shrink-0">
                  <div className="h-1.5 flex-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${scoreBarColor(row.score)} transition-all duration-700`}
                      style={{ width: `${Math.max(0, Math.min(100, row.score))}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-gray-700 dark:text-slate-200 w-9 text-right tabular-nums">
                    {row.score}
                  </span>
                </div>

                <MilestoneBadge level={milestone} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default ReportCardResultsTable;
