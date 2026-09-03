import { PartyPopper, Star, AlertCircle, AlertOctagon, History } from "lucide-react";
import { BehaviorEntryType, ReportCardBehaviorEntry } from "./types";

const TYPE_STYLES: Record<
  BehaviorEntryType,
  { icon: typeof Star; dot: string; ring: string; label: string }
> = {
  POSITIVE: {
    icon: Star,
    dot: "bg-emerald-500",
    ring: "ring-emerald-100 dark:ring-emerald-500/20",
    label: "Positive",
  },
  CONCERN: {
    icon: AlertCircle,
    dot: "bg-amber-500",
    ring: "ring-amber-100 dark:ring-amber-500/20",
    label: "Concern",
  },
  INCIDENT: {
    icon: AlertOctagon,
    dot: "bg-rose-500",
    ring: "ring-rose-100 dark:ring-rose-500/20",
    label: "Incident",
  },
};

const ReportCardBehaviorTimeline = ({ logs }: { logs: ReportCardBehaviorEntry[] }) => {
  return (
    <div className="panel-card rounded-2xl p-5 md:p-6 shine-hover print:shadow-none print:ring-1 print:ring-slate-200">
      <div className="flex items-center gap-2 mb-4">
        <History size={18} className="text-blue-600 dark:text-blue-300" />
        <h2 className="text-base font-bold text-gray-800 dark:text-blue-100">
          Behavior &amp; Conduct
        </h2>
      </div>

      {logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center gap-2 py-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20">
            <PartyPopper size={24} className="text-emerald-500 dark:text-emerald-300" />
          </div>
          <p className="text-sm font-semibold text-gray-600 dark:text-slate-300">
            All clear! No behavior infractions recorded this term.
          </p>
          <p className="text-xs text-gray-400 dark:text-slate-500 max-w-xs">
            Keep up the great work — positive notes and any concerns from teachers will show up
            here.
          </p>
        </div>
      ) : (
        <ul className="relative flex flex-col gap-5 pl-1">
          <div className="absolute left-[15px] top-2 bottom-2 w-px bg-slate-200 dark:bg-slate-800" />
          {logs.map((log) => {
            const style = TYPE_STYLES[log.type];
            const Icon = style.icon;
            return (
              <li key={log.id} className="relative flex gap-3">
                <div
                  className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${style.dot} ring-4 ${style.ring}`}
                >
                  <Icon size={14} className="text-white" strokeWidth={2.5} />
                </div>
                <div className="min-w-0 flex-1 -mt-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-gray-800 dark:text-slate-100">
                      {log.title}
                    </p>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">
                      {style.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                    {log.description}
                  </p>
                  <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1">
                    {log.date.toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default ReportCardBehaviorTimeline;
