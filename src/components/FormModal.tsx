"use client";

import {
  deleteAnnouncement,
  deleteAssignment,
  deleteClass,
  deleteClub,
  deleteCurriculumObjective,
  deleteExam,
  deleteEvent,
  deleteLesson,
  deleteParent,
  deleteResult,
  deleteStudent,
  deleteSubject,
  deleteTeacher,
} from "@/lib/actions";
import { deleteBehaviorLog } from "@/lib/masterModuleActions";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { FormContainerProps } from "./FormContainer";

type TableName = FormContainerProps["table"];
type DeleteAction = typeof deleteSubject;
type FormRenderer = (
  setOpen: Dispatch<SetStateAction<boolean>>,
  type: "create" | "update",
  data?: any,
  relatedData?: any
) => JSX.Element;

const deleteActionMap: Partial<Record<TableName, DeleteAction>> = {
  subject: deleteSubject,
  class: deleteClass,
  teacher: deleteTeacher,
  student: deleteStudent,
  exam: deleteExam,
  parent: deleteParent,
  assignment: deleteAssignment,
  result: deleteResult,
  event: deleteEvent,
  announcement: deleteAnnouncement,
  lesson: deleteLesson,
  club: deleteClub,
  objective: deleteCurriculumObjective,
  behaviorLog: deleteBehaviorLog,
};

// Lazy-loaded forms show this while their chunk downloads; it's a component
// (not an inline string) so it can read the active locale.
const FormLoading = () => {
  const t = useTranslations("Modal");
  return <h1>{t("loading")}</h1>;
};

// USE LAZY LOADING

// import TeacherForm from "./forms/TeacherForm";
// import StudentForm from "./forms/StudentForm";

const TeacherForm = dynamic(() => import("./forms/TeacherForm"), {
  loading: () => <FormLoading />,
});
const StudentForm = dynamic(() => import("./forms/StudentForm"), {
  loading: () => <FormLoading />,
});
const SubjectForm = dynamic(() => import("./forms/SubjectForm"), {
  loading: () => <FormLoading />,
});
const ClassForm = dynamic(() => import("./forms/ClassForm"), {
  loading: () => <FormLoading />,
});
const LessonForm = dynamic(() => import("./forms/LessonForm"), {
  loading: () => <FormLoading />,
});
const ExamForm = dynamic(() => import("./forms/ExamForm"), {
  loading: () => <FormLoading />,
});
const ParentForm = dynamic(() => import("./forms/ParentForm"), {
  loading: () => <FormLoading />,
});
const AssignmentForm = dynamic(() => import("./forms/AssignmentForm"), {
  loading: () => <FormLoading />,
});
const ResultForm = dynamic(() => import("./forms/ResultForm"), {
  loading: () => <FormLoading />,
});
const EventForm = dynamic(() => import("./forms/EventForm"), {
  loading: () => <FormLoading />,
});
const AnnouncementForm = dynamic(() => import("./forms/AnnouncementForm"), {
  loading: () => <FormLoading />,
});
const ClubForm = dynamic(() => import("./forms/ClubForm"), {
  loading: () => <FormLoading />,
});
const ObjectiveForm = dynamic(() => import("./forms/ObjectiveForm"), {
  loading: () => <FormLoading />,
});
const BehaviorLogForm = dynamic(() => import("./forms/BehaviorLogForm"), {
  loading: () => <FormLoading />,
});

const forms: Partial<Record<TableName, FormRenderer>> = {
  subject: (setOpen, type, data, relatedData) => (
    <SubjectForm
      type={type}
      data={data}
      setOpen={setOpen}
      relatedData={relatedData}
    />
  ),
  class: (setOpen, type, data, relatedData) => (
    <ClassForm
      type={type}
      data={data}
      setOpen={setOpen}
      relatedData={relatedData}
    />
    ),
  lesson: (setOpen, type, data, relatedData) => (
    <LessonForm
      type={type}
      data={data}
      setOpen={setOpen}
      relatedData={relatedData}
      />
    ),
  teacher: (setOpen, type, data, relatedData) => (
    <TeacherForm
      type={type}
      data={data}
      setOpen={setOpen}
      relatedData={relatedData}
    />
  ),
  student: (setOpen, type, data, relatedData) => (
    <StudentForm
      type={type}
      data={data}
      setOpen={setOpen}
      relatedData={relatedData}
    />
  ),
  exam: (setOpen, type, data, relatedData) => (
    <ExamForm
      type={type}
      data={data}
      setOpen={setOpen}
      relatedData={relatedData}
    />
  ),
  parent: (setOpen, type, data) => (
    <ParentForm type={type} data={data} setOpen={setOpen} />
  ),
  assignment: (setOpen, type, data, relatedData) => (
    <AssignmentForm
      type={type}
      data={data}
      setOpen={setOpen}
      relatedData={relatedData}
    />
  ),
  result: (setOpen, type, data, relatedData) => (
    <ResultForm
      type={type}
      data={data}
      setOpen={setOpen}
      relatedData={relatedData}
    />
  ),
  event: (setOpen, type, data, relatedData) => (
    <EventForm
      type={type}
      data={data}
      setOpen={setOpen}
      relatedData={relatedData}
    />
  ),
  announcement: (setOpen, type, data, relatedData) => (
    <AnnouncementForm
      type={type}
      data={data}
      setOpen={setOpen}
      relatedData={relatedData}
    />
  ),
  club: (setOpen, type, data, relatedData) => (
    <ClubForm
      type={type}
      data={data}
      setOpen={setOpen}
      relatedData={relatedData}
    />
  ),
  objective: (setOpen, type, data, relatedData) => (
    <ObjectiveForm
      type={type}
      data={data}
      setOpen={setOpen}
      relatedData={relatedData}
    />
  ),
  behaviorLog: (setOpen, type, data, relatedData) => (
    <BehaviorLogForm
      type={type}
      data={data}
      setOpen={setOpen}
      relatedData={relatedData}
    />
  ),
};

const FormModal = ({
  table,
  type,
  data,
  id,
  relatedData,
}: FormContainerProps & { relatedData?: any }) => {
  const t = useTranslations("Modal");
  const [open, setOpen] = useState(false);

  // Falls back to the raw table key for any table without an entity label.
  const entityName = t.has(`entities.${table}`) ? t(`entities.${table}`) : table;

  const size = type === "create" ? "w-8 h-8" : "w-7 h-7";
  const bgColor =
    type === "create"
      ? "bg-lamaYellow"
      : type === "update"
      ? "bg-lamaSky"
      : "bg-lamaPurple";
  const deleteAction = deleteActionMap[table];
  const selectedForm = forms[table];

  const hasForm = type === "delete" ? !!deleteAction : !!selectedForm;

  const Form = () => {
    const [state, formAction] = useFormState(deleteAction || deleteSubject, {
      success: false,
      error: false,
    });

    const router = useRouter();

    useEffect(() => {
      if (state.success) {
        toast(t("deleted", { entity: entityName }));
        setOpen(false);
        router.refresh();
      }
    }, [state, router]);

    return type === "delete" && id ? (
      <form action={formAction} className="p-4 flex flex-col gap-4">
        <input type="text | number" name="id" value={id} hidden />
        <span className="text-center font-medium">
          {t("deleteConfirm", { entity: entityName })}
        </span>
        <button className="bg-red-700 text-white py-2 px-4 rounded-md border-none w-max self-center">
          {t("delete")}
        </button>
      </form>
    ) : type === "create" || type === "update" ? (
      selectedForm ? selectedForm(setOpen, type, data, relatedData) : t("formNotFound")
    ) : (
      t("formNotFound")
    );
  };

  return (
    <>
      <button
        disabled={!hasForm}
        className={`${size} flex items-center justify-center rounded-full ${bgColor} hover:shadow-lg transition-shadow`}
        onClick={() => setOpen(true)}
        title={type === "create" ? t("createNew") : type === "update" ? t("update") : t("delete")}
      >
        {type === "create" ? (
          <span className="text-white font-bold text-lg">+</span>
        ) : (
          <Image src={`/${type}.png`} alt="" width={16} height={16} />
        )}
      </button>
      {open && (
        <div className="w-screen h-screen absolute left-0 top-0 bg-black bg-opacity-60 z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-md relative w-[90%] md:w-[70%] lg:w-[60%] xl:w-[50%] 2xl:w-[40%] max-h-[90vh] overflow-y-auto">
            <Form />
            <div
              className="absolute top-4 right-4 cursor-pointer"
              onClick={() => setOpen(false)}
            >
              <Image src="/close.png" alt="" width={14} height={14} className="dark:invert dark:opacity-70" />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FormModal;
