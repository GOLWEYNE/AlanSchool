"use client";

import { useRouter } from "next/navigation";
import StudentForm from "./StudentForm";

// StudentForm expects a real `setOpen` state setter (it's normally rendered
// inside FormModal, a Client Component, which owns that state). The
// standalone edit page is a Server Component and can't hand it a plain
// function, so this thin Client Component supplies one and sends the admin
// back to the student's profile once the update succeeds (StudentForm calls
// setOpen(false) after a successful save). Mirrors TeacherEditForm.
const StudentEditForm = ({
  studentId,
  data,
  relatedData,
}: {
  studentId: string;
  data: any;
  relatedData: any;
}) => {
  const router = useRouter();

  return (
    <StudentForm
      type="update"
      data={data}
      relatedData={relatedData}
      setOpen={(value) => {
        if (value === false) {
          router.push(`/dashboard/list/students/${studentId}`);
        }
      }}
    />
  );
};

export default StudentEditForm;
