import Table from "@/components/Table";
import { getTranslations } from "next-intl/server";
import type { TeacherKpaRow, KpaRating } from "@/lib/curriculumDeliveryKpa";

const ratingClass: Record<KpaRating, string> = {
  meets:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  below: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  noData: "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-300",
};

// KPA "Curriculum Delivery": one row per teacher (admins) or just the
// signed-in teacher's own row (teachers), scored against a coverage target.
const CurriculumDeliveryKpaSection = async ({
  rows,
  target,
  isAdmin,
}: {
  rows: TeacherKpaRow[];
  target: number;
  isAdmin: boolean;
}) => {
  const t = await getTranslations("List.curriculumCoverage.kpa");

  const scored = rows.filter((r) => r.rating !== "noData");
  const meetsCount = scored.filter((r) => r.rating === "meets").length;

  const columns = [
    { header: t("columns.teacher"), accessor: "teacher" },
    { header: t("columns.coverage"), accessor: "coverage" },
    { header: t("columns.objectives"), accessor: "objectives", className: "hidden md:table-cell" },
    { header: t("columns.lessonsTagged"), accessor: "lessonsTagged", className: "hidden lg:table-cell" },
    { header: t("columns.rating"), accessor: "rating" },
  ];

  const renderRow = (item: TeacherKpaRow) => (
    <tr
      key={item.teacherId}
      className="border-b border-gray-200 dark:border-slate-800 even:bg-slate-50 dark:even:bg-slate-900/40 text-sm"
    >
      <td className="p-4">
        <div className="font-medium">{item.name}</div>
        {item.assignmentsWithoutObjectives > 0 && (
          <div className="text-xs text-gray-400 dark:text-slate-500">
            {t("unscored", { count: item.assignmentsWithoutObjectives })}
          </div>
        )}
      </td>
      <td className="font-semibold">
        {item.coveragePct !== null ? `${item.coveragePct}%` : "-"}
      </td>
      <td className="hidden md:table-cell">
        {item.totalObjectives > 0
          ? `${item.coveredObjectives} / ${item.totalObjectives}`
          : "-"}
      </td>
      <td className="hidden lg:table-cell">
        {item.lessons > 0 ? `${item.taggedLessons} / ${item.lessons}` : "-"}
      </td>
      <td>
        <span
          className={`text-xs font-semibold px-2 py-1 rounded-full ${ratingClass[item.rating]}`}
        >
          {t(`rating.${item.rating}`)}
        </span>
      </td>
    </tr>
  );

  return (
    <section className="panel-card p-4 rounded-md mt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{t("title")}</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400">{t("subtitle", { target })}</p>
        </div>
        {isAdmin && scored.length > 0 && (
          <p className="text-sm text-gray-600 dark:text-slate-300">
            {t("summary", { meets: meetsCount, total: scored.length })}
          </p>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400 p-4">{t("empty")}</p>
      ) : (
        <Table columns={columns} renderRow={renderRow} data={rows} />
      )}

      <p className="text-xs text-gray-400 dark:text-slate-500 mt-3">{t("howCalculated")}</p>
    </section>
  );
};

export default CurriculumDeliveryKpaSection;
