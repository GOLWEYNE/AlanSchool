"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { generateReportCardsForClass } from "@/lib/masterModuleActions";
import { currentSchoolYear } from "@/lib/schoolYear";

type Term = "TERM_1" | "TERM_2" | "TERM_3";
type ClassOption = { id: number; name: string };

const BulkGenerateReportCardsPanel = ({
  classes,
}: {
  classes: ClassOption[];
}) => {
  const t = useTranslations("Forms.reportCard");
  const router = useRouter();

  const [classId, setClassId] = useState<number | "">(
    classes[0]?.id ?? ""
  );
  const [term, setTerm] = useState<Term>("TERM_1");
  const [schoolYear, setSchoolYear] = useState(currentSchoolYear());

  const [state, formAction] = useFormState(generateReportCardsForClass, {
    success: false,
    error: false,
  });

  useEffect(() => {
    if (state.success) {
      toast(t("toastBulkGenerated"));
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <div className="panel-card p-4 rounded-md mb-4 shine-hover">
      <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">
        {t("bulkTitle")}
      </h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!classId) return;
          formAction({ classId, term, schoolYear });
        }}
        className="flex flex-wrap items-end gap-4"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 dark:text-slate-400">
            {t("class")}
          </label>
          <select
            className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2 rounded-md text-sm"
            value={classId}
            onChange={(e) => setClassId(parseInt(e.target.value, 10))}
          >
            {classes.map((c) => (
              <option value={c.id} key={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 dark:text-slate-400">
            {t("term")}
          </label>
          <select
            className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2 rounded-md text-sm"
            value={term}
            onChange={(e) => setTerm(e.target.value as Term)}
          >
            <option value="TERM_1">{t("term1")}</option>
            <option value="TERM_2">{t("term2")}</option>
            <option value="TERM_3">{t("term3")}</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 dark:text-slate-400">
            {t("schoolYear")}
          </label>
          <input
            className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2 rounded-md text-sm"
            value={schoolYear}
            onChange={(e) => setSchoolYear(e.target.value)}
            placeholder="2026/2027"
          />
        </div>

        <button
          disabled={!classId}
          className="bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-md text-sm font-semibold"
        >
          {t("generateForClass")}
        </button>

        {state.error && (
          <span className="text-red-500 text-sm w-full">
            {state.message || t("error")}
          </span>
        )}
      </form>
    </div>
  );
};

export default BulkGenerateReportCardsPanel;
