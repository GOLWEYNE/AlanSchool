import ReportCardActions from "./ReportCardActions";
import ReportCardHeader from "./ReportCardHeader";
import ReportCardMetrics from "./ReportCardMetrics";
import ReportCardResultsTable from "./ReportCardResultsTable";
import ReportCardBehaviorTimeline from "./ReportCardBehaviorTimeline";
import { ReportCardViewData } from "./types";

// The single entry point for the modern report card experience. Every
// prop comes from real DB data resolved for one ReportCard row (see the
// [id]/page.tsx loader), so this same component tree is what renders for
// every student in the school each time a report card is generated and
// opened — nothing here is specific to any one example student.
const ReportCardView = ({ data }: { data: ReportCardViewData }) => {
  return (
    <div className="flex-1 p-4 md:p-5 flex flex-col gap-4 print:p-0 print:bg-white">
      <ReportCardActions pdfHref={data.pdfHref} />

      <ReportCardHeader data={data} />

      <ReportCardMetrics
        gpa={data.gpa}
        attendanceRate={data.attendanceRate}
        attendanceBreakdown={data.attendanceBreakdown}
        behaviorLogs={data.behaviorLogs}
      />

      <ReportCardResultsTable results={data.results} />

      <ReportCardBehaviorTimeline logs={data.behaviorLogs} />

      <div className="hidden print:flex justify-between text-[10px] text-slate-400 border-t border-slate-200 pt-3 mt-2">
        <span>Alan International School · Official Document</span>
        <span>
          This report card was generated electronically and is valid without a signature.
        </span>
      </div>
    </div>
  );
};

export default ReportCardView;
