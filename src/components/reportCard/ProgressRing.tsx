// Pure SVG circular progress indicator. No client JS needed — this
// renders identically on the server, which keeps the report card page a
// fast server component with no unnecessary "use client" boundaries.
const ProgressRing = ({
  value,
  size = 88,
  strokeWidth = 8,
  colorClass = "stroke-blue-500 dark:stroke-blue-400",
  trackClassName = "stroke-blue-100 dark:stroke-slate-800",
  label,
  sublabel,
}: {
  value: number; // 0-100
  size?: number;
  strokeWidth?: number;
  colorClass?: string;
  trackClassName?: string;
  label: string;
  sublabel?: string;
}) => {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label}${sublabel ? `, ${sublabel}` : ""}`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          className={trackClassName}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`${colorClass} transition-[stroke-dashoffset] duration-700 ease-out`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-bold text-gray-800 dark:text-blue-100 leading-none">
          {label}
        </span>
        {sublabel && (
          <span className="text-[9px] font-medium text-gray-400 dark:text-slate-500 mt-1 uppercase tracking-wide">
            {sublabel}
          </span>
        )}
      </div>
    </div>
  );
};

export default ProgressRing;
