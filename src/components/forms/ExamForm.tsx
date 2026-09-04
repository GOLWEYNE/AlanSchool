"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import InputField from "../InputField";
import { examSchema, ExamSchema } from "@/lib/formValidationSchemas";
import { createExam, updateExam } from "@/lib/actions";
import { useFormState } from "react-dom";
import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import WorkFileUpload from "./WorkFileUpload";
import WorkTargetPicker from "./WorkTargetPicker";
import WorkQuizBuilder, { QuizQuestionDraft } from "./WorkQuizBuilder";

const ExamForm = ({
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
  } = useForm<ExamSchema>({
    resolver: zodResolver(examSchema),
    defaultValues: {
      description: data?.description ?? "",
      totalMarks: data?.totalMarks ?? undefined,
      durationMinutes: data?.durationMinutes ?? undefined,
      instructionsFileUrl: data?.instructionsFileUrl ?? "",
      instructionsFileName: data?.instructionsFileName ?? "",
      questions: (data?.questions as QuizQuestionDraft[] | undefined) ?? [],
      targetStudentIds: data?.targetStudentIds ?? [],
    },
  });

  const [state, formAction] = useFormState(
    type === "create" ? createExam : updateExam,
    {
      success: false,
      error: false,
    }
  );

  const onSubmit = handleSubmit((data) => {
    formAction(data);
  });

  const router = useRouter();

  useEffect(() => {
    if (state.success) {
      toast(type === "create" ? t("exam.toastCreated") : t("exam.toastUpdated"));
      setOpen(false);
      router.refresh();
    }
  }, [state, router, type, setOpen]);

  const { lessons, students = [], classes = [] } = relatedData;

  // The "Class" picker below isn't a form field of its own - it's a
  // client-side filter that narrows which lessons show up in the Lesson
  // dropdown, since a school can have far more lessons than fit in one
  // unfiltered list. Initialize it from the lesson being edited, if any.
  const [selectedClassId, setSelectedClassId] = useState<string>(() => {
    const initialLesson = lessons.find(
      (l: { id: number; classId: number }) => l.id === data?.lessonId
    );
    return initialLesson ? String(initialLesson.classId) : "";
  });

  // If the picked class has no lessons yet (e.g. one just created, or one
  // that hasn't been scheduled), fall back to the full lesson list instead
  // of leaving the dropdown empty - the class list intentionally includes
  // every class in the school, not just ones that already have a lesson.
  const classLessons = selectedClassId
    ? lessons.filter(
        (l: { classId: number }) => String(l.classId) === selectedClassId
      )
    : lessons;
  const filteredLessons = classLessons.length > 0 ? classLessons : lessons;

  const selectedLessonId = watch("lessonId") ?? data?.lessonId;

  // Keep the selected lesson in sync with the class filter: if the class
  // changes and the currently-picked lesson no longer belongs to it, fall
  // back to the first lesson the new class actually has.
  useEffect(() => {
    const stillValid = filteredLessons.some(
      (l: { id: number }) => String(l.id) === String(selectedLessonId)
    );
    if (!stillValid && filteredLessons.length > 0) {
      setValue("lessonId", filteredLessons[0].id, { shouldValidate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClassId]);

  return (
    <form className="flex flex-col gap-8" onSubmit={onSubmit}>
      <h1 className="text-xl font-semibold dark:text-blue-100">
        {type === "create" ? t("exam.createTitle") : t("exam.updateTitle")}
      </h1>

      <div className="flex justify-between flex-wrap gap-4">
        <InputField
          label={t("exam.examTitle")}
          name="title"
          defaultValue={data?.title}
          register={register}
          error={errors?.title}
        />
        <InputField
          label={t("exam.startDate")}
          name="startTime"
          defaultValue={
            data?.startTime
              ? new Date(data.startTime).toISOString().slice(0, 16)
              : undefined
          }
          register={register}
          error={errors?.startTime}
          type="datetime-local"
        />
        <InputField
          label={t("exam.endDate")}
          name="endTime"
          defaultValue={
            data?.endTime
              ? new Date(data.endTime).toISOString().slice(0, 16)
              : undefined
          }
          register={register}
          error={errors?.endTime}
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
          <label className="text-xs text-gray-500 dark:text-slate-400">Class</label>
          <select
            className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2 rounded-md text-sm w-full"
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
          >
            <option value="">All classes</option>
            {classes.map((c: { id: number; name: string }) => (
              <option value={c.id} key={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2 w-full md:w-1/4">
          <label className="text-xs text-gray-500 dark:text-slate-400">{t("exam.lesson")}</label>
          <select
            className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2 rounded-md text-sm w-full"
            {...register("lessonId")}
            defaultValue={data?.lessonId}
          >
            {filteredLessons.map((lesson: { id: number; name: string }) => (
              <option value={lesson.id} key={lesson.id}>
                {lesson.name}
              </option>
            ))}
          </select>
          {errors.lessonId?.message && (
            <p className="text-xs text-red-400">{errors.lessonId.message.toString()}</p>
          )}
          {selectedClassId && classLessons.length === 0 && (
            <p className="text-xs text-amber-500">
              This class has no lessons yet - showing every lesson instead.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2 w-full md:w-[47%]">
          <label className="text-xs text-gray-500 dark:text-slate-400">
            Description / instructions (optional)
          </label>
          <textarea
            {...register("description")}
            rows={3}
            placeholder="What the exam covers, how it's marked, anything students should know..."
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
        <div className="flex flex-col gap-2 w-full md:w-[22%]">
          <label className="text-xs text-gray-500 dark:text-slate-400">Duration, minutes (optional)</label>
          <input
            type="number"
            min={1}
            {...register("durationMinutes")}
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

export default ExamForm;
