"use client";

import { ITEM_PER_PAGE, PAGE_SIZE_OPTIONS } from "@/lib/settings";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

const Pagination = ({
  page,
  count,
  pageSize = ITEM_PER_PAGE,
}: {
  page: number;
  count: number;
  pageSize?: number;
}) => {
  const router = useRouter();
  const t = useTranslations("Pagination");

  const hasPrev = pageSize * (page - 1) > 0;
  const hasNext = pageSize * (page - 1) + pageSize < count;

  const changePage = (newPage: number) => {
    const params = new URLSearchParams(window.location.search);
    params.set("page", newPage.toString());
    router.push(`${window.location.pathname}?${params}`);
  };

  const changePageSize = (newSize: number) => {
    const params = new URLSearchParams(window.location.search);
    params.set("pageSize", newSize.toString());
    // A different page size changes what "page 3" even means, so land back
    // on page 1 rather than show a now-mismatched slice of rows.
    params.set("page", "1");
    router.push(`${window.location.pathname}?${params}`);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="p-4 flex items-center justify-between text-blue-700 dark:text-blue-300">
        <button
          disabled={!hasPrev}
          className="toolbar-chip py-2 px-4 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => {
            changePage(page - 1);
          }}
        >
          {t("previous")}
        </button>
        <div className="flex items-center gap-2 text-sm flex-wrap justify-center">
          {Array.from(
            { length: Math.ceil(count / pageSize) },
            (_, index) => {
              const pageIndex = index + 1;
              return (
                <button
                  key={pageIndex}
                  className={`px-3 py-1.5 rounded-full font-semibold transition-all ${
                    page === pageIndex
                      ? "bg-gradient-to-r from-blue-500 to-yellow-400 text-white shadow-md"
                      : "bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/40"
                  }`}
                  onClick={() => {
                    changePage(pageIndex);
                  }}
                >
                  {pageIndex}
                </button>
              );
            }
          )}
        </div>
        <button
          className="toolbar-chip py-2 px-4 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!hasNext}
          onClick={() => {
            changePage(page + 1);
          }}
        >
          {t("next")}
        </button>
      </div>
      <div className="px-4 pb-2 flex justify-end">
        <label className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
          {t("rowsPerPage")}
          <select
            value={pageSize}
            onChange={(e) => changePageSize(parseInt(e.target.value, 10))}
            className="rounded-full border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-2 py-1 text-xs font-semibold"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
};

export default Pagination;
