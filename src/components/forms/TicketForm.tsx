"use client";

import { useForm } from "react-hook-form";
import { useFormState } from "react-dom";
import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createTicket } from "@/lib/masterModuleActions";
import { TicketSchema } from "@/lib/masterModuleSchemas";

type StudentOption = { id: string; name: string; surname: string };

type ReportFormValues = {
  itemTitle: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  studentId?: string;
};

const TicketForm = ({
  setOpen,
  role,
  students,
  selfStudentId,
}: {
  setOpen: Dispatch<SetStateAction<boolean>>;
  role: string;
  // Full student picker for staff, or a parent's own children. Omitted
  // entirely for the "student" role, who can only report as themselves.
  students?: StudentOption[];
  // Set when role === "student": their own Student.id, submitted silently.
  selfStudentId?: string;
}) => {
  const t = useTranslations("Tickets.form");
  const tPriority = useTranslations("Tickets.board.priorities");
  const [reportType, setReportType] = useState<"lost" | "found">("lost");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ReportFormValues>({
    defaultValues: { priority: "MEDIUM" },
  });

  const [state, formAction] = useFormState(createTicket, {
    success: false,
    error: false,
  });

  const onSubmit = handleSubmit((values) => {
    // The "Lost: " / "Found: " prefix is stored data that TicketBoard parses,
    // so it stays in English regardless of the UI language.
    const label = reportType === "found" ? "Found" : "Lost";
    const payload: TicketSchema = {
      title: `${label}: ${values.itemTitle.trim()}`,
      description: values.description.trim(),
      category: "LOST_ITEM",
      priority: values.priority,
      studentId: selfStudentId ?? values.studentId ?? "",
    };
    formAction(payload);
  });

  const router = useRouter();

  useEffect(() => {
    if (state.success) {
      toast(reportType === "found" ? t("toastFound") : t("toastLost"));
      setOpen(false);
      router.refresh();
    }
  }, [state, router, setOpen, reportType, t]);

  return (
    <form className="flex flex-col gap-6" onSubmit={onSubmit}>
      <h1 className="text-xl font-semibold text-blue-900 dark:text-blue-100">
        {t("title")}
      </h1>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setReportType("lost")}
          className={`flex-1 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
            reportType === "lost"
              ? "bg-red-500 text-white border-red-500"
              : "bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-gray-300 dark:border-slate-700"
          }`}
        >
          {t("lostBtn")}
        </button>
        <button
          type="button"
          onClick={() => setReportType("found")}
          className={`flex-1 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
            reportType === "found"
              ? "bg-emerald-500 text-white border-emerald-500"
              : "bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-gray-300 dark:border-slate-700"
          }`}
        >
          {t("foundBtn")}
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs text-gray-500 dark:text-slate-400">
          {reportType === "found" ? t("itemLabelFound") : t("itemLabelLost")}
        </label>
        <input
          type="text"
          placeholder={t("itemPlaceholder")}
          className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2 rounded-md text-sm w-full"
          {...register("itemTitle", { required: t("itemRequired") })}
        />
        {errors.itemTitle?.message && (
          <p className="text-xs text-red-400">{errors.itemTitle.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs text-gray-500 dark:text-slate-400">
          {reportType === "found" ? t("detailsFound") : t("detailsLost")}
        </label>
        <textarea
          rows={3}
          placeholder={t("descPlaceholder")}
          className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2 rounded-md text-sm w-full"
          {...register("description", { required: t("descRequired") })}
        />
        {errors.description?.message && (
          <p className="text-xs text-red-400">{errors.description.message}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="flex flex-col gap-2 w-full md:w-1/3">
          <label className="text-xs text-gray-500 dark:text-slate-400">{t("priority")}</label>
          <select
            className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2 rounded-md text-sm w-full"
            {...register("priority")}
          >
            <option value="LOW">{tPriority("LOW")}</option>
            <option value="MEDIUM">{tPriority("MEDIUM")}</option>
            <option value="HIGH">{tPriority("HIGH")}</option>
            <option value="URGENT">{t("priorityUrgent")}</option>
          </select>
        </div>

        {!selfStudentId && students && students.length > 0 && (
          <div className="flex flex-col gap-2 w-full md:w-1/2">
            <label className="text-xs text-gray-500 dark:text-slate-400">
              {role === "parent" ? t("studentParent") : t("studentOptional")}
            </label>
            <select
              className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2 rounded-md text-sm w-full"
              {...register("studentId")}
            >
              <option value="">{role === "parent" ? t("selectChild") : t("notLinked")}</option>
              {students.map((s) => (
                <option value={s.id} key={s.id}>
                  {s.name} {s.surname}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {state.error && (
        <span className="text-red-500 text-sm">
          {state.message || t("error")}
        </span>
      )}
      <button className="bg-blue-500 hover:bg-blue-600 transition-colors text-white p-2 rounded-md font-medium">
        {t("submit")}
      </button>
    </form>
  );
};

export default TicketForm;
