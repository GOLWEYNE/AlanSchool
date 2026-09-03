import Image from "next/image";
import { IdCard, Users, CalendarRange } from "lucide-react";
import LiveVerificationBadge from "./LiveVerificationBadge";
import { ReportCardViewData } from "./types";

const ReportCardHeader = ({ data }: { data: ReportCardViewData }) => {
  const avatarSrc =
    typeof data.studentImg === "string" && data.studentImg.trim()
      ? data.studentImg
      : "/noAvatar.png";

  const generatedLabel = data.generatedAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="relative overflow-hidden rounded-[20px] page-top-banner p-6 md:p-8 shine-hover print:bg-white print:text-slate-900 print:shadow-none print:ring-1 print:ring-slate-300">
      {/* decorative glass orbs */}
      <div className="pointer-events-none absolute -top-16 -right-10 h-56 w-56 rounded-full bg-white/10 blur-2xl print:hidden" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-yellow-300/10 blur-2xl print:hidden" />

      <div className="relative flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-white/90 print:text-slate-500">
            <span className="text-lg">🎓</span>
            <span className="text-sm font-semibold tracking-wide">
              Alan International School
            </span>
          </div>
          <LiveVerificationBadge generatedAt={generatedLabel} />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-full bg-white/30 blur-md scale-110 print:hidden" />
            <Image
              src={avatarSrc}
              alt=""
              width={88}
              height={88}
              className="relative h-20 w-20 sm:h-[88px] sm:w-[88px] rounded-full object-cover ring-4 ring-white/40 backdrop-blur-md print:ring-slate-300"
            />
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white truncate print:text-slate-900">
              {data.studentName}
            </h1>
            <p className="text-white/80 text-sm mt-0.5 print:text-slate-500">
              Official Student Report Card · {data.termLabel} · {data.schoolYear}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/25 px-3 py-1 text-xs font-semibold text-white print:bg-slate-100 print:text-slate-700 print:border-slate-300">
                <IdCard size={13} strokeWidth={2.5} />
                {data.studentUsername}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/25 px-3 py-1 text-xs font-semibold text-white print:bg-slate-100 print:text-slate-700 print:border-slate-300">
                <Users size={13} strokeWidth={2.5} />
                {data.className}
                {data.gradeLevel ? ` · Grade ${data.gradeLevel}` : ""}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/25 px-3 py-1 text-xs font-semibold text-white print:bg-slate-100 print:text-slate-700 print:border-slate-300">
                <CalendarRange size={13} strokeWidth={2.5} />
                {data.schoolYear}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportCardHeader;
