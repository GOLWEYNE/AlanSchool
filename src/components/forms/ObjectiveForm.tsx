"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import InputField from "../InputField";
import { curriculumObjectiveSchema, CurriculumObjectiveSchema } from "@/lib/formValidationSchemas";
import { createCurriculumObjective, updateCurriculumObjective } from "@/lib/actions";
import { useFormState } from "react-dom";
import { Dispatch, SetStateAction, useEffect } from "react";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

// One entry in a subject's curriculum-objective bank (e.g. the Grade 1-2
// science curriculum's objectives). Admin-managed, same as Subjects -
// teachers tag Lessons/Exams against this list but don't edit it.
const ObjectiveForm = ({
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
  } = useForm<CurriculumObjectiveSchema>({
    resolver: zodResolver(curriculumObjectiveSchema),
  });

  const [state, formAction] = useFormState(
    type === "create" ? createCurriculumObjective : updateCurriculumObjective,
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
      toast(type === "create" ? t("objective.toastCreated") : t("objective.toastUpdated"));
      setOpen(false);
      router.refresh();
    }
  }, [state, router, type, setOpen]);

  const { subjects, grades } = relatedData;

  return (
    <form className="flex flex-col gap-8" onSubmit={onSubmit}>
      <h1 className="text-xl font-semibold dark:text-blue-100">
        {type === "create" ? t("objective.createTitle") : t("objective.updateTitle")}
      </h1>

      <div className="flex justify-between flex-wrap gap-4">
        <InputField
          label={t("objective.code")}
          name="code"
          defaultValue={data?.code}
          register={register}
          error={errors?.code}
        />
        <InputField
          label={t("objective.title")}
          name="title"
          defaultValue={data?.title}
          register={register}
          error={errors?.title}
        />
        <InputField
          label={t("objective.strand")}
          name="strand"
          defaultValue={data?.strand}
          register={register}
          error={errors?.strand}
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
          <label className="text-xs text-gray-500 dark:text-slate-400">{t("objective.subject")}</label>
          <select
            className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2 rounded-md text-sm w-full"
            {...register("subjectId")}
            defaultValue={data?.subjectId}
          >
            {subjects.map((subject: { id: number; name: string }) => (
              <option value={subject.id} key={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
          {errors.subjectId?.message && (
            <p className="text-xs text-red-400">{errors.subjectId.message.toString()}</p>
          )}
        </div>
        <div className="flex flex-col gap-2 w-full md:w-1/4">
          <label className="text-xs text-gray-500 dark:text-slate-400">{t("objective.grade")}</label>
          <select
            className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2 rounded-md text-sm w-full"
            {...register("gradeId")}
            defaultValue={data?.gradeId ?? ""}
          >
            <option value="">{t("objective.allGrades")}</option>
            {grades.map((grade: { id: number; level: number }) => (
              <option value={grade.id} key={grade.id}>
                {grade.level}
              </option>
            ))}
          </select>
          {errors.gradeId?.message && (
            <p className="text-xs text-red-400">{errors.gradeId.message.toString()}</p>
          )}
        </div>
        <div className="flex flex-col gap-2 w-full">
          <label className="text-xs text-gray-500 dark:text-slate-400">{t("objective.description")}</label>
          <textarea
            {...register("description")}
            rows={2}
            defaultValue={data?.description}
            className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2 rounded-md text-sm w-full"
          />
        </div>
      </div>

      {state.error && <span className="text-red-500">{t("common.somethingWrong")}</span>}
      <button className="bg-blue-400 text-white p-2 rounded-md">
        {type === "create" ? t("common.create") : t("common.update")}
      </button>
    </form>
  );
};

export default ObjectiveForm;
