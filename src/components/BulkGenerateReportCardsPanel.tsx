"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import {
  generateReportCard,
  generateReportCardsForClass,
} from "@/lib/masterModuleActions";
import { currentSchoolYear } from "@/lib/schoolYear";

type Term = "TERM_1" | "TERM_2" | "TERM_3";
type ClassOption = { id: number; name: string };
type StudentOption = { id: string; name: string; classId: number };
type Mode = "class" | "student";

const BulkGenerateReportCardsPanel = ({
  classes,
  students,
}: {
  classes: ClassOption[];
  students: StudentOption[];
}) => {
  const t = useTranslations("Forms.reportCard");
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("class");
  const [classId, setClassId] = useState<number | "">(classes[0]?.id ?? "");
  const [term, setTerm] = useState<Term>("TERM_1");
  const [schoolYear, setSchoolYear] = useState(currentSchoolYear());

  // Student picker is scoped to the selected class so the list stays
  // short and the chosen student can never belong to a different class
  // than the one shown alongside them.
  const studentsInClass = useMemo(
    () => students.filter((s) => s.classId === classId),
    [students, classId]
  );
  const [studentId, setStudentId] = useState<string>("");

  useEffect(() => {
    // Whenever the class changes, drop any previously selected student
    // that no longer belongs to it and default to the first one available.
    setStudentId(studentsInClass[0]?.id ?? "");
  }, [studentsInClass]);

  const [classState, classFormAction] = useFormState(
    generateReportCardsForClass,
    { success: false, error: false }
  );
  const [studentState, studentFormAction] = useFormState(generateReportCard, {
    success: false,
    error: false,
  });

  const selectedStudentName = studentsInClass.find(
    (s) => s.id === studentId
  )?.name;

  useEffect(() => {
    if (classState.success) {
      toast(t("toastBulkGenerated"));
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classState]);

  useEffect(() => {
    if (studentState.success) {
      toast(
        selectedStudentName
          ? `${t("toastGenerated")} (${selectedStudentName})`
          : t("toastGenerated")
      );
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentState]);

  return (
    <div className="panel-card p-4 rounded-md mb-4 shine-hover">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
          {mode === "class" ? t("bulkTitle") : t("studentTitle")}
        </h2>
        <div className="flex rounded-md ring-[1.5px] ring-gray-300 dark:ring-slate-700 overflow-hidden text-xs font-semibold">
          <button
            type="button"
            onClick={() => setMode("class")}
            className={`px-3 py-1.5 ${
              mode === "class"
                ? "bg-blue-500 text-white"
                : "bg-transparent text-gray-600 dark:text-slate-300"
            }`}
          >
            {t("modeClass")}
          </button>
          <button
            type="button"
            onClick={() => setMode("student")}
            className={`px-3 py-1.5 ${
              mode === "student"
                ? "bg-blue-500 text-white"
                : "bg-transparent text-gray-600 dark:text-slate-300"
            }`}
          >
            {t("modeStudent")}
          </button>
        </div>
      </div>

      {mode === "class" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!classId) return;
            classFormAction({ classId, term, schoolYear });
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

          {classState.error && (
            <span className="text-red-500 text-sm w-full">
              {classState.message || t("error")}
            </span>
          )}
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!studentId) return;
            studentFormAction({ studentId, term, schoolYear });
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
              {t("student")}
            </label>
            <select
              className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2 rounded-md text-sm min-w-[12rem]"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              disabled={studentsInClass.length === 0}
            >
              {studentsInClass.length === 0 ? (
                <option value="">{t("noStudentsInClass")}</option>
              ) : (
                studentsInClass.map((s) => (
                  <option value={s.id} key={s.id}>
                    {s.name}
                  </option>
                ))
              )}
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
            disabled={!studentId}
            className="bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-md text-sm font-semibold"
          >
            {t("generateForStudent")}
          </button>

          {studentState.error && (
            <span className="text-red-500 text-sm w-full">
              {studentState.message || t("error")}
            </span>
          )}
        </form>
      )}
    </div>
  );
};

export default BulkGenerateReportCardsPanel;
