"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import InputField from "../InputField";
import { behaviorLogSchema, BehaviorLogSchema } from "@/lib/masterModuleSchemas";
import { createBehaviorLog, updateBehaviorLog } from "@/lib/masterModuleActions";
import { useFormState } from "react-dom";
import { Dispatch, SetStateAction, useEffect } from "react";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

// A merit/incident entry against a student - admin/teacher log these,
// parents (and the student themselves) see the ones marked visible to
// them. Backed by the existing (until now page-less) BehaviorLog model
// and createBehaviorLog/updateBehaviorLog/deleteBehaviorLog actions.
const BehaviorLogForm = ({
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
    formState: { errors },
  } = useForm<BehaviorLogSchema>({
    resolver: zodResolver(behaviorLogSchema),
  });

  const [state, formAction] = useFormState(
    type === "create" ? createBehaviorLog : updateBehaviorLog,
    {
      success: false,
      error: false,
    }
  );

  const onSubmit = handleSubmit((values) => {
    formAction(values);
  });

  const router = useRouter();

  useEffect(() => {
    if (state.success) {
      toast(type === "create" ? t("behaviorLog.toastCreated") : t("behaviorLog.toastUpdated"));
      setOpen(false);
      router.refresh();
    }
  }, [state, router, type, setOpen]);

  const { students } = relatedData;

  const TYPE_OPTIONS: { value: "POSITIVE" | "CONCERN" | "INCIDENT"; label: string }[] = [
    { value: "POSITIVE", label: t("behaviorLog.typePositive") },
    { value: "CONCERN", label: t("behaviorLog.typeConcern") },
    { value: "INCIDENT", label: t("behaviorLog.typeIncident") },
  ];

  return (
    <form className="flex flex-col gap-8" onSubmit={onSubmit}>
      <h1 className="text-xl font-semibold dark:text-blue-100">
        {type === "create" ? t("behaviorLog.createTitle") : t("behaviorLog.updateTitle")}
      </h1>

      <div className="flex justify-between flex-wrap gap-4">
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
        <div className="flex flex-col gap-2 w-full md:w-1/3">
          <label className="text-xs text-gray-500 dark:text-slate-400">{t("behaviorLog.student")}</label>
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
        <div className="flex flex-col gap-2 w-full md:w-1/3">
          <label className="text-xs text-gray-500 dark:text-slate-400">{t("behaviorLog.type")}</label>
          <select
            className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2 rounded-md text-sm w-full"
            {...register("type")}
            defaultValue={data?.type ?? "POSITIVE"}
          >
            {TYPE_OPTIONS.map((opt) => (
              <option value={opt.value} key={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {errors.type?.message && (
            <p className="text-xs text-red-400">{errors.type.message.toString()}</p>
          )}
        </div>
        <InputField
          label={t("behaviorLog.title")}
          name="title"
          defaultValue={data?.title}
          register={register}
          error={errors?.title}
        />
        <div className="flex flex-col gap-2 w-full">
          <label className="text-xs text-gray-500 dark:text-slate-400">
            {t("behaviorLog.description")}
          </label>
          <textarea
            {...register("description")}
            rows={3}
            defaultValue={data?.description}
            className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2 rounded-md text-sm w-full"
          />
          {errors.description?.message && (
            <p className="text-xs text-red-400">{errors.description.message.toString()}</p>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-300">
          <input
            type="checkbox"
            {...register("visibleToParent")}
            defaultChecked={data?.visibleToParent ?? true}
            className="h-4 w-4 rounded ring-1 ring-gray-300 dark:ring-slate-700"
          />
          {t("behaviorLog.visibleToParent")}
        </label>
      </div>

      {state.error && <span className="text-red-500">{state.message || t("common.somethingWrong")}</span>}
      <button className="bg-blue-400 text-white p-2 rounded-md">
        {type === "create" ? t("common.create") : t("common.update")}
      </button>
    </form>
  );
};

export default BehaviorLogForm;
