"use client";

import { useRouter } from "next/navigation";
import TeacherForm from "./TeacherForm";

// TeacherForm expects a real `setOpen` state setter (it's normally rendered
// inside FormModal, a Client Component, which owns that state). The
// standalone edit page (a Server Component) can't hand it a plain function -
// Next.js rejects passing functions across the server/client boundary
// unless they're Server Actions - so this thin Client Component supplies
// one instead, and sends the teacher back to their profile once the update
// succeeds (TeacherForm calls setOpen(false) after a successful save).
const TeacherEditForm = ({
  teacherId,
  data,
  relatedData,
}: {
  teacherId: string;
  data: any;
  relatedData: any;
}) => {
  const router = useRouter();

  return (
    <TeacherForm
      type="update"
      data={data}
      relatedData={relatedData}
      setOpen={(value) => {
        if (value === false) {
          router.push(`/dashboard/list/teachers/${teacherId}`);
        }
      }}
    />
  );
};

export default TeacherEditForm;
