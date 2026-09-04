"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import InputField from "../InputField";
import { assignmentSchema, AssignmentSchema } from "@/lib/formValidationSchemas";
import { createAssignment, updateAssignment } from "@/lib/actions";
import { useFormState } from "react-dom";
import { Dispatch, SetStateAction, useEffect } from "react";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import WorkFileUpload from "./WorkFileUpload";
import WorkTargetPicker from "./WorkTargetPicker";
import WorkQuizBuilder, { QuizQuestionDraft } from "./WorkQuizBuilder";

const AssignmentForm = ({
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
    watch,
    formState: { errors },
  } = useForm<AssignmentSchema>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: {
      description: data?.description ?? "",
      totalMarks: data?.totalMarks ?? undefined,
      instructionsFileUrl: data?.instructionsFileUrl ?? "",
      instructionsFileName: data?.instructionsFileName ?? "",
      questions: (data?.questions as QuizQuestionDraft[] | undefined) ?? [],
      targetStudentIds: data?.targetStudentIds ?? [],
    },
  });

  const [state, formAction] = useFormState(
    type === "create" ? createAssignment : updateAssignment,
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
      toast(
        type === "create" ? t("assignment.toastCreated") : t("assignment.toastUpdated")
      );
      setOpen(false);
      router.refresh();
    }
  }, [state, router, type, setOpen]);

  const { lessons, students = [] } = relatedData;
  const selectedLessonId = watch("lessonId") ?? data?.lessonId;

  return (
    <form className="flex flex-col gap-8" onSubmit={onSubmit}>
      <h1 className="text-xl font-semibold dark:text-blue-100">
        {type === "create" ? t("assignment.createTitle") : t("assignment.updateTitle")}
      </h1>

      <div className="flex justify-between flex-wrap gap-4">
        <InputField
          label={t("common.title")}
          name="title"
          defaultValue={data?.title}
          register={register}
          error={errors?.title}
        />
        <InputField
          label={t("assignment.startDate")}
          name="startDate"
          defaultValue={
            data?.startDate
              ? new Date(data.startDate).toISOString().slice(0, 16)
              : undefined
          }
          register={register}
          error={errors?.startDate}
          type="datetime-local"
        />
        <InputField
          label={t("assignment.dueDate")}
          name="dueDate"
          defaultValue={
            data?.dueDate
              ? new Date(data.dueDate).toISOString().slice(0, 16)
              : undefined
          }
          register={register}
          error={errors?.dueDate}
          type="datetime-local"
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
          <label className="text-xs text-gray-500 dark:text-slate-400">{t("assignment.lesson")}</label>
          <select
            className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2 rounded-md text-sm w-full"
            {...register("lessonId")}
            defaultValue={data?.lessonId}
          >
            {lessons.map((lesson: { id: number; name: string }) => (
              <option value={lesson.id} key={lesson.id}>
                {lesson.name}
              </option>
            ))}
          </select>
          {errors.lessonId?.message && (
            <p className="text-xs text-red-400">{errors.lessonId.message.toString()}</p>
          )}
        </div>
        <div className="flex flex-col gap-2 w-full md:w-[47%]">
          <label className="text-xs text-gray-500 dark:text-slate-400">
            Description / instructions (optional)
          </label>
          <textarea
            {...register("description")}
            rows={3}
            placeholder="What the assignment covers, how it's marked, anything students should know..."
            className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2 rounded-md text-sm w-full"
          />
        </div>
        <div className="flex flex-col gap-2 w-full md:w-[22%]">
          <label className="text-xs text-gray-500 dark:text-slate-400">Total marks (optional)</label>
          <input
            type="number"
            min={1}
            {...register("totalMarks")}
            className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2 rounded-md text-sm w-full"
          />
        </div>

        <input type="hidden" {...register("instructionsFileUrl")} />
        <input type="hidden" {...register("instructionsFileName")} />
        <input type="hidden" {...register("questions")} />
        <WorkFileUpload
          defaultFileUrl={data?.instructionsFileUrl}
          defaultFileName={data?.instructionsFileName}
          onChange={(url, name) => {
            setValue("instructionsFileUrl", url, { shouldValidate: true });
            setValue("instructionsFileName", name);
          }}
        />

        <WorkTargetPicker
          lessons={lessons}
          students={students}
          selectedLessonId={selectedLessonId}
          register={register}
          defaultTargetIds={data?.targetStudentIds}
        />

        <WorkQuizBuilder
          defaultQuestions={data?.questions}
          onChange={(questions) => setValue("questions", questions as any)}
        />
      </div>

      {state.error && <span className="text-red-500">{t("common.somethingWrong")}</span>}
      <button className="bg-blue-400 text-white p-2 rounded-md">
        {type === "create" ? t("common.create") : t("common.update")}
      </button>
    </form>
  );
};

export default AssignmentForm;
