import { getTranslations } from "next-intl/server";

// "Download schedule (PDF)" button. A plain <a> on purpose: the target is a file
// download, not a page, so it must not go through client-side navigation or
// prefetching. Pass a teacher, a class, or both (an admin's current selection);
// a teacher's own week needs neither.
const ScheduleDownloadLink = async ({
  teacherId,
  classId,
  className = "",
}: {
  teacherId?: string | null;
  classId?: number | null;
  className?: string;
}) => {
  const t = await getTranslations("SchedulePdf");
  const params = new URLSearchParams();
  if (classId) params.set("classId", String(classId));
  if (teacherId) params.set("teacherId", teacherId);
  const query = params.toString();

  return (
    <a
      href={`/api/schedule/pdf${query ? `?${query}` : ""}`}
      className={`inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-blue-600 to-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:from-blue-700 hover:to-sky-600 ${className}`}
    >
      <span aria-hidden="true">📄</span>
      {t("download")}
    </a>
  );
};

export default ScheduleDownloadLink;
