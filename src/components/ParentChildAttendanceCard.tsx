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
    <div className="bg-white rounded-md p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{studentName}</h2>
          <p className="text-sm text-gray-500">{className}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">Overall attendance</p>
          <p className="text-xl font-semibold">{overallPercent ? `${overallPercent.toFixed(0)}%` : "-"}</p>
        </div>
      </div>
      <div className="mt-4 rounded-md border border-gray-100 bg-slate-50 p-3">
        <p className="text-sm text-gray-700 font-medium">Today</p>
        <p className="mt-1 text-sm text-gray-500">{statusText}</p>
      </div>
    </div>
  );
};

export default ParentChildAttendanceCard;
