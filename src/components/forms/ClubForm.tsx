"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import InputField from "../InputField";
import { clubCategories, clubSchema, ClubSchema } from "@/lib/formValidationSchemas";
import { createClub, updateClub } from "@/lib/actions";
import { useFormState } from "react-dom";
import { Dispatch, SetStateAction, useEffect } from "react";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useValidationMessage } from "@/hooks/useValidationMessage";

const ClubForm = ({
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
  const t = useTranslations("Forms.club");
  const tv = useValidationMessage();
  const tCommon = useTranslations("Forms.common");
  const tCat = useTranslations("List.clubs.categories");
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ClubSchema>({
    resolver: zodResolver(clubSchema),
  });

  // AFTER REACT 19 IT'LL BE USEACTIONSTATE

  const [state, formAction] = useFormState(
    type === "create" ? createClub : updateClub,
    {
      success: false,
      error: false,
    }
  );

  const onSubmit = handleSubmit((formData) => {
    formAction(formData);
  });

  const router = useRouter();

  useEffect(() => {
    if (state.success) {
      toast(type === "create" ? t("created") : t("updated"));
      setOpen(false);
      router.refresh();
    }
  }, [state, router, type, setOpen, t]);

  const teachers: { id: string; name: string; surname: string }[] =
    relatedData?.teachers ?? [];

  return (
    <form className="flex flex-col gap-8" onSubmit={onSubmit}>
      <h1 className="text-xl font-semibold dark:text-blue-100">
        {type === "create" ? t("createTitle") : t("updateTitle")}
      </h1>

      <div className="flex justify-between flex-wrap gap-4">
        <InputField
          label={t("name")}
          name="name"
          defaultValue={data?.name}
          register={register}
          error={errors?.name}
        />
        <InputField
          label={tCommon("capacity")}
          name="capacity"
          defaultValue={data?.capacity}
          register={register}
          error={errors?.capacity}
        />
        <InputField
          label={t("schedule")}
          name="schedule"
          defaultValue={data?.schedule}
          register={register}
          error={errors?.schedule}
        />
        <InputField
          label={t("location")}
          name="location"
          defaultValue={data?.location}
          register={register}
          error={errors?.location}
        />
        <InputField
          label={tCommon("description")}
          name="description"
          defaultValue={data?.description}
          register={register}
          error={errors?.description}
        />
        {data && (
          <InputField
            label="Id"
            name="id"
            defaultValue={data?.id}
            register={register}
            error={errors?.id}
            hidden
          />
        )}
        <div className="flex flex-col gap-2 w-full md:w-1/4">
          <label className="text-xs text-gray-500 dark:text-slate-400">{t("category")}</label>
          <select
            className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2 rounded-md text-sm w-full"
            {...register("category")}
            defaultValue={data?.category}
          >
            {clubCategories.map((cat) => (
              <option value={cat} key={cat} selected={data && cat === data.category}>
                {tCat.has(cat) ? tCat(cat) : cat}
              </option>
            ))}
          </select>
          {errors.category?.message && (
            <p className="text-xs text-red-400">{tv(errors.category.message)}</p>
          )}
        </div>
        <div className="flex flex-col gap-2 w-full md:w-1/4">
          <label className="text-xs text-gray-500 dark:text-slate-400">{t("instructorOptional")}</label>
          <select
            className="ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2 rounded-md text-sm w-full"
            {...register("instructorId")}
            defaultValue={data?.instructorId ?? ""}
          >
            <option value="">{t("unassigned")}</option>
            {teachers.map((teacher) => (
              <option
                value={teacher.id}
                key={teacher.id}
                selected={data && teacher.id === data.instructorId}
              >
                {teacher.name + " " + teacher.surname}
              </option>
            ))}
          </select>
          {errors.instructorId?.message && (
            <p className="text-xs text-red-400">{tv(errors.instructorId.message)}</p>
          )}
        </div>
      </div>

      {state.error && <span className="text-red-500">{tCommon("somethingWrong")}</span>}
      <button className="bg-blue-400 text-white p-2 rounded-md">
        {type === "create" ? tCommon("create") : tCommon("update")}
      </button>
    </form>
  );
};

export default ClubForm;
