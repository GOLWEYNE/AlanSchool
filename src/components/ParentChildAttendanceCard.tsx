type ParentChildAttendanceCardProps = {
  studentName: string;
  className: string;
  todayPresent: number;
  todayTotal: number;
  overallPercent: number;
};

const ParentChildAttendanceCard = ({
  studentName,
  className,
  todayPresent,
  todayTotal,
  overallPercent,
}: ParentChildAttendanceCardProps) => {
  const statusText =
    todayTotal > 0
      ? `${todayPresent}/${todayTotal} present today`
      : "No attendance record today";

  return (
    <div className="bg-white dark:bg-slate-900 rounded-md p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold dark:text-blue-100">{studentName}</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400">{className}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400 dark:text-slate-500">Overall attendance</p>
          <p className="text-xl font-semibold dark:text-blue-100">{overallPercent ? `${overallPercent.toFixed(0)}%` : "-"}</p>
        </div>
      </div>
      <div className="mt-4 rounded-md border border-gray-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-3">
        <p className="text-sm text-gray-700 dark:text-slate-300 font-medium">Today</p>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">{statusText}</p>
      </div>
    </div>
  );
};

export default ParentChildAttendanceCard;
