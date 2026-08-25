"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { generateReportCard } from "@/lib/masterModuleActions";
import { currentSchoolYear } from "@/lib/schoolYear";

type Term = "TERM_1" | "TERM_2" | "TERM_3";

const ReportCardGenerateButton = ({
  studentId,
  studentLabel,
  defaultTerm,
  defaultSchoolYear,
  variant = "icon",
}: {
  studentId: string;
  studentLabel?: string;
  defaultTerm?: Term;
  defaultSchoolYear?: string;
  variant?: "icon" | "button";
}) => {
  const t = useTranslations("Forms.reportCard");
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState<Term>(defaultTerm ?? "TERM_1");
  const [schoolYear, setSchoolYear] = useState(
    defaultSchoolYear ?? currentSchoolYear()
  );
  const router = useRouter();

  const [state, formAction] = useFormState(generateReportCard, {
    success: false,
    error: false,
  });

  useEffect(() => {
    if (state.success) {
      toast(t("toastGenerated"));
      setOpen(false);
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const isRegenerate = !!defaultTerm && !!defaultSchoolYear;

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          className="circle-icon-btn"
          title={t("generateTitle")}
          onClick={() => setOpen(true)}
        >
          <Image src="/result.png" alt="" width={16} height={16} />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs font-semibold text-blue-700 dark:text-blue-300 hover:underline"
        >
          {isRegenerate ? t("regenerate") : t("generate")}
        </button>
      )}

      {open && (
        <div className="w-screen h-screen fixed left-0 top-0 bg-black bg-opacity-60 z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-md relative w-[90%] md:w-[60%] lg:w-[40%] xl:w-[32%]">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                formAction({ studentId, term, schoolYear });
              }}
              className="flex flex-col gap-4"
            >
              <h1 className="text-lg font-semibold dark:text-blue-100">
                {t("generateTitle")}
                {studentLabel ? ` — ${studentLabel}` : ""}
              </h1>

              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-500 dark:text-slate-400">
                  {t("term")}
                </label>
                <select
                  className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2 rounded-md text-sm w-full"
                  value={term}
                  onChange={(e) => setTerm(e.target.value as Term)}
                >
                  <option value="TERM_1">{t("term1")}</option>
                  <option value="TERM_2">{t("term2")}</option>
                  <option value="TERM_3">{t("term3")}</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-500 dark:text-slate-400">
                  {t("schoolYear")}
                </label>
                <input
                  className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2 rounded-md text-sm w-full"
                  value={schoolYear}
                  onChange={(e) => setSchoolYear(e.target.value)}
                  placeholder="2026/2027"
                />
              </div>

              {state.error && (
                <span className="text-red-500 text-sm">
                  {state.message || t("error")}
                </span>
              )}

              <button className="bg-blue-500 text-white p-2 rounded-md text-sm">
                {isRegenerate ? t("regenerate") : t("generate")}
              </button>
            </form>
            <div
              className="absolute top-4 right-4 cursor-pointer"
              onClick={() => setOpen(false)}
            >
              <Image
                src="/close.png"
                alt=""
                width={14}
                height={14}
                className="dark:invert dark:opacity-70"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ReportCardGenerateButton;
