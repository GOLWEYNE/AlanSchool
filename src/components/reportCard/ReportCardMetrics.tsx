import { Award, CalendarCheck2, ShieldCheck, AlertTriangle, Sparkles } from "lucide-react";
import ProgressRing from "./ProgressRing";
import MilestoneBadge from "./MilestoneBadge";
import { AttendanceBreakdown, getMilestone, ReportCardBehaviorEntry } from "./types";

const EmptyMetric = ({
  icon: Icon,
  title,
  message,
}: {
  icon: typeof Sparkles;
  title: string;
  message: string;
}) => (
  <div className="flex items-center gap-4">
    <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800/70 border border-dashed border-slate-300 dark:border-slate-700">
      <Icon size={26} className="text-slate-400 dark:text-slate-500" strokeWidth={1.75} />
    </div>
    <div>
      <p className="text-sm font-bold text-gray-700 dark:text-slate-200">{title}</p>
      <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 leading-snug">
        {message}
      </p>
    </div>
  </div>
);

const attendanceRing = (rate: number) => {
  if (rate >= 95) return "stroke-emerald-500 dark:stroke-emerald-400";
  if (rate >= 85) return "stroke-blue-500 dark:stroke-blue-400";
  return "stroke-amber-500 dark:stroke-amber-400";
};

const behaviorSummary = (logs: ReportCardBehaviorEntry[]) => {
  const incidents = logs.filter((l) => l.type === "INCIDENT").length;
  const concerns = logs.filter((l) => l.type === "CONCERN").length;
  const positives = logs.filter((l) => l.type === "POSITIVE").length;

  if (incidents > 0) {
    return {
      label: "Needs Attention",
      tone: "text-rose-600 dark:text-rose-300",
      ring: "bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30",
      Icon: AlertTriangle,
    };
  }
  if (concerns > 0) {
    return {
      label: "Monitor",
      tone: "text-amber-600 dark:text-amber-300",
      ring: "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30",
      Icon: ShieldCheck,
    };
  }
  return {
    label: positives > 0 ? "Excellent" : "All Clear",
    tone: "text-emerald-600 dark:text-emerald-300",
    ring: "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30",
    Icon: ShieldCheck,
  };
};

const ReportCardMetrics = ({
  gpa,
  attendanceRate,
  attendanceBreakdown,
  behaviorLogs,
}: {
  gpa: number | null;
  attendanceRate: number | null;
  attendanceBreakdown: AttendanceBreakdown;
  behaviorLogs: ReportCardBehaviorEntry[];
}) => {
  const milestone = gpa !== null ? getMilestone(gpa) : null;
  const behavior = behaviorSummary(behaviorLogs);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {/* Average Score / GPA */}
      <div className="panel-card p-5 rounded-2xl shine-hover print:shadow-none print:ring-1 print:ring-slate-200">
        {gpa !== null ? (
          <div className="flex items-center gap-4">
            <ProgressRing
              value={gpa}
              label={`${Math.round(gpa)}`}
              sublabel="/ 100"
              colorClass="stroke-blue-500 dark:stroke-blue-400"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-gray-400 dark:text-slate-500">
                <Award size={13} strokeWidth={2.5} />
                <span className="text-[11px] font-semibold uppercase tracking-wide">
                  Average Score
                </span>
              </div>
              <p className="text-2xl font-bold text-gray-800 dark:text-blue-100 mt-0.5">
                {Math.round(gpa * 100) / 100}
              </p>
              {milestone && (
                <div className="mt-1.5">
                  <MilestoneBadge level={milestone} />
                </div>
              )}
            </div>
          </div>
        ) : (
          <EmptyMetric
            icon={Award}
            title="Average Score"
            message="No recorded exam or assignment results yet."
          />
        )}
      </div>

      {/* Attendance */}
      <div className="panel-card p-5 rounded-2xl shine-hover print:shadow-none print:ring-1 print:ring-slate-200">
        {attendanceRate !== null ? (
          <div className="flex items-center gap-4">
            <ProgressRing
              value={attendanceRate}
              label={`${Math.round(attendanceRate)}%`}
              colorClass={attendanceRing(attendanceRate)}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-gray-400 dark:text-slate-500">
                <CalendarCheck2 size={13} strokeWidth={2.5} />
                <span className="text-[11px] font-semibold uppercase tracking-wide">
                  Attendance Rate
                </span>
              </div>
              <p className="text-2xl font-bold text-gray-800 dark:text-blue-100 mt-0.5">
                {Math.round(attendanceRate * 100) / 100}%
              </p>
              <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1.5">
                {attendanceBreakdown.present} present · {attendanceBreakdown.absent} absent
                {attendanceBreakdown.late ? ` · ${attendanceBreakdown.late} late` : ""}
              </p>
            </div>
          </div>
        ) : (
          <EmptyMetric
            icon={CalendarCheck2}
            title="Attendance Rate"
            message="No attendance has been recorded yet."
          />
        )}
      </div>

      {/* Behavior */}
      <div className="panel-card p-5 rounded-2xl shine-hover print:shadow-none print:ring-1 print:ring-slate-200">
        <div className="flex items-center gap-4">
          <div
            className={`flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full border ${behavior.ring}`}
          >
            <behavior.Icon size={28} className={behavior.tone} strokeWidth={1.9} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-gray-400 dark:text-slate-500">
              <ShieldCheck size={13} strokeWidth={2.5} />
              <span className="text-[11px] font-semibold uppercase tracking-wide">
                Behavior Status
              </span>
            </div>
            <p className={`text-2xl font-bold mt-0.5 ${behavior.tone}`}>{behavior.label}</p>
            <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1.5">
              {behaviorLogs.length === 0
                ? "No logs recorded this term"
                : `${behaviorLogs.length} recent log${behaviorLogs.length === 1 ? "" : "s"}`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportCardMetrics;
