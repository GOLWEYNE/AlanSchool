"use client";

import { useForm } from "react-hook-form";
import { useFormState } from "react-dom";
import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
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
      toast(
        reportType === "found"
          ? "Found item posted to the board!"
          : "Lost item reported — we'll keep an eye out!"
      );
      setOpen(false);
      router.refresh();
    }
  }, [state, router, setOpen, reportType]);

  return (
    <form className="flex flex-col gap-6" onSubmit={onSubmit}>
      <h1 className="text-xl font-semibold text-blue-900 dark:text-blue-100">
        Report an item
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
          🔴 I lost something
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
          🟢 I found something
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs text-gray-500 dark:text-slate-400">
          Item {reportType === "found" ? "you found" : "you lost"}
        </label>
        <input
          type="text"
          placeholder="e.g. Blue backpack, silver water bottle, student ID card"
          className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2 rounded-md text-sm w-full"
          {...register("itemTitle", { required: "Item name is required!" })}
        />
        {errors.itemTitle?.message && (
          <p className="text-xs text-red-400">{errors.itemTitle.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs text-gray-500 dark:text-slate-400">
          Details — where{reportType === "found" ? " you found it and where it can be claimed" : " and when you last had it"}
        </label>
        <textarea
          rows={3}
          placeholder="Add any details that will help match this item, e.g. location, color, distinguishing marks..."
          className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2 rounded-md text-sm w-full"
          {...register("description", { required: "A short description is required!" })}
        />
        {errors.description?.message && (
          <p className="text-xs text-red-400">{errors.description.message}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="flex flex-col gap-2 w-full md:w-1/3">
          <label className="text-xs text-gray-500 dark:text-slate-400">Priority</label>
          <select
            className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2 rounded-md text-sm w-full"
            {...register("priority")}
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent (e.g. ID, keys, wallet)</option>
          </select>
        </div>

        {!selfStudentId && students && students.length > 0 && (
          <div className="flex flex-col gap-2 w-full md:w-1/2">
            <label className="text-xs text-gray-500 dark:text-slate-400">
              {role === "parent" ? "Which of your children is this for?" : "Student (optional)"}
            </label>
            <select
              className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2 rounded-md text-sm w-full"
              {...register("studentId")}
            >
              <option value="">{role === "parent" ? "Select a child..." : "Not linked to a student"}</option>
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
          {state.message || "Something went wrong, please try again."}
        </span>
      )}
      <button className="bg-blue-500 hover:bg-blue-600 transition-colors text-white p-2 rounded-md font-medium">
        Post to the board
      </button>
    </form>
  );
};

export default TicketForm;
