"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import InputField from "../InputField";
import { resultSchema, ResultSchema } from "@/lib/formValidationSchemas";
import { createResult, updateResult } from "@/lib/actions";
import { useFormState } from "react-dom";
import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

const ResultForm = ({
  type,
  data,
  setOpen,
  relatedData,
}: {
  type: "create" | "update";
  data?: any;
  setOpen: Dispatch<SetStateAction<boolean>>;
  relatedData?: any;
}) => {
  const t = useTranslations("Forms");
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ResultSchema>({
    resolver: zodResolver(resultSchema),
  });

  const [assessmentType, setAssessmentType] = useState<"exam" | "assignment">(
    data?.examId ? "exam" : "assignment"
  );

  const [state, formAction] = useFormState(
    type === "create" ? createResult : updateResult,
    {
      success: false,
      error: false,
    }
  );

  const onSubmit = handleSubmit((values) => {
    if (assessmentType === "exam") {
      setValue("assignmentId", undefined);
      values.assignmentId = undefined;
    } else {
      setValue("examId", undefined);
      values.examId = undefined;
    }

    formAction(values);
  });

  const router = useRouter();

  useEffect(() => {
    if (state.success) {
      toast(type === "create" ? t("result.toastCreated") : t("result.toastUpdated"));
      setOpen(false);
      router.refresh();
    }
  }, [state, router, type, setOpen]);

  const { students, exams, assignments } = relatedData;

  return (
    <form className="flex flex-col gap-8" onSubmit={onSubmit}>
      <h1 className="text-xl font-semibold dark:text-blue-100">
        {type === "create" ? t("result.createTitle") : t("result.updateTitle")}
      </h1>

      <div className="flex justify-between flex-wrap gap-4">
        <InputField
          label={t("result.score")}
          name="score"
          defaultValue={data?.score}
          register={register}
          error={errors?.score}
          type="number"
          inputProps={{ min: 0 }}
        />
        {data && (
          <InputField
            label={t("common.id")}
            name="id"
            defaultValue={data?.id}
            register={register}
            error={errors?.id}
            hidden
          />
        )}
        <div className="flex flex-col gap-2 w-full md:w-1/4">
          <label className="text-xs text-gray-500 dark:text-slate-400">{t("result.student")}</label>
          <select
            className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2 rounded-md text-sm w-full"
            {...register("studentId")}
            defaultValue={data?.studentId}
          >
            {students.map((student: { id: string; name: string; surname: string }) => (
              <option value={student.id} key={student.id}>
                {student.name} {student.surname}
              </option>
            ))}
          </select>
          {errors.studentId?.message && (
            <p className="text-xs text-red-400">{errors.studentId.message.toString()}</p>
          )}
        </div>
        <div className="flex flex-col gap-2 w-full md:w-1/4">
          <label className="text-xs text-gray-500 dark:text-slate-400">{t("result.assessmentType")}</label>
          <select
            className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2 rounded-md text-sm w-full"
            value={assessmentType}
            onChange={(e) => {
              if (e.target.value === "exam") {
                setAssessmentType("exam");
                setValue("assignmentId", undefined);
              } else {
                setAssessmentType("assignment");
                setValue("examId", undefined);
              }
            }}
          >
            <option value="exam">{t("result.exam")}</option>
            <option value="assignment">{t("result.assignment")}</option>
          </select>
        </div>
        {assessmentType === "exam" ? (
          <div className="flex flex-col gap-2 w-full md:w-1/4">
            <label className="text-xs text-gray-500 dark:text-slate-400">{t("result.exam")}</label>
            <select
              className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2 rounded-md text-sm w-full"
              {...register("examId")}
              defaultValue={data?.examId}
            >
              {exams.map((exam: { id: number; title: string }) => (
                <option value={exam.id} key={exam.id}>
                  {exam.title}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex flex-col gap-2 w-full md:w-1/4">
            <label className="text-xs text-gray-500 dark:text-slate-400">{t("result.assignment")}</label>
            <select
              className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2 rounded-md text-sm w-full"
              {...register("assignmentId")}
              defaultValue={data?.assignmentId}
            >
              {assignments.map((assignment: { id: number; title: string }) => (
                <option value={assignment.id} key={assignment.id}>
                  {assignment.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {state.error && <span className="text-red-500">{t("common.somethingWrong")}</span>}
      <button className="bg-blue-400 text-white p-2 rounded-md">
        {type === "create" ? t("common.create") : t("common.update")}
      </button>
    </form>
  );
};

export default ResultForm;
