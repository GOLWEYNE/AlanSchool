import { TrendingUp, CircleCheck, CircleDot } from "lucide-react";
import { MILESTONE_LABEL, MilestoneLevel } from "./types";

const STYLES: Record<MilestoneLevel, string> = {
  exceeding:
    "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30",
  meeting:
    "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/30",
  inProgress:
    "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30",
};

const ICONS: Record<MilestoneLevel, typeof TrendingUp> = {
  exceeding: TrendingUp,
  meeting: CircleCheck,
  inProgress: CircleDot,
};

const MilestoneBadge = ({ level }: { level: MilestoneLevel }) => {
  const Icon = ICONS[level];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${STYLES[level]}`}
    >
      <Icon size={12} strokeWidth={2.5} />
      {MILESTONE_LABEL[level]}
    </span>
  );
};

export default MilestoneBadge;
