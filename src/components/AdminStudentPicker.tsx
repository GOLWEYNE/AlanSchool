"use client";

import { useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

type PickableStudent = { id: string; name: string; surname: string };

// Lets an admin pick which student to act as/for on an assignment page -
// switching the selection updates the ?studentId= query param, which the
// server component re-reads to load that student's submission.
const AdminStudentPicker = ({
  students,
  selectedStudentId,
}: {
  students: PickableStudent[];
  selectedStudentId: string | null;
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("Assessments.work");

  return (
    <div className="mb-4">
      <label className="text-xs text-gray-500 dark:text-slate-400 block mb-1">
        {t("selectStudentLabel")}
      </label>
      <select
        value={selectedStudentId ?? ""}
        onChange={(e) => {
          const value = e.target.value;
          router.push(value ? `${pathname}?studentId=${value}` : pathname);
        }}
        className="w-full sm:w-72 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-700 dark:text-slate-200"
      >
        <option value="">{t("chooseStudentPlaceholder")}</option>
        {students.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} {s.surname}
          </option>
        ))}
      </select>
    </div>
  );
};

export default AdminStudentPicker;
