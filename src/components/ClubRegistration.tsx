"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { registerStudentsInClub, removeStudentsFromClub } from "@/lib/clubSupervisionActions";

export type RegistrationStudent = {
  id: string;
  name: string;
  surname: string;
  classId: number;
  className: string;
  gradeId: number;
  gradeLevel: number;
  status: "ACTIVE" | "WAITLISTED" | null;
};

export type RegistrationGrade = { id: number; level: number };
export type RegistrationClass = { id: number; name: string; gradeId: number };

type View = "all" | "notIn" | "in";

const FIELD =
  "ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2 rounded-md text-sm";

// Registration picker for one club: choose a grade, then a class (or leave
// both on "all"), tick any students from the whole school, and register them
// in one click. Admins and the club's supervisors use it.
export default function ClubRegistration({
  clubId,
  capacity,
  grades,
  classes,
  students,
}: {
  clubId: number;
  capacity: number;
  grades: RegistrationGrade[];
  classes: RegistrationClass[];
  students: RegistrationStudent[];
}) {
  const t = useTranslations("List.clubRegister");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [gradeId, setGradeId] = useState<string>("");
  const [classId, setClassId] = useState<string>("");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const visibleClasses = useMemo(
    () => classes.filter((c) => !gradeId || c.gradeId === Number(gradeId)),
    [classes, gradeId]
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((s) => {
      if (gradeId && s.gradeId !== Number(gradeId)) return false;
      if (classId && s.classId !== Number(classId)) return false;
      if (view === "notIn" && s.status) return false;
      if (view === "in" && !s.status) return false;
      if (q && !`${s.name} ${s.surname} ${s.className}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [students, gradeId, classId, query, view]);

  const activeCount = students.filter((s) => s.status === "ACTIVE").length;
  const waitlistCount = students.filter((s) => s.status === "WAITLISTED").length;
  const selectedList = Array.from(selected);
  const selectedNew = selectedList.filter((id) => !students.find((s) => s.id === id)?.status);
  const selectedIn = selectedList.filter((id) => !!students.find((s) => s.id === id)?.status);
  const allShownSelected = shown.length > 0 && shown.every((s) => selected.has(s.id));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleShown = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allShownSelected) shown.forEach((s) => next.delete(s.id));
      else shown.forEach((s) => next.add(s.id));
      return next;
    });

  const register = () => {
    startTransition(async () => {
      const res = await registerStudentsInClub(clubId, selectedNew);
      if (!res.ok) {
        toast.error(res.error ?? t("errors.failed"));
        return;
      }
      toast(t("registered", { added: res.added ?? 0, waitlisted: res.waitlisted ?? 0 }));
      setSelected(new Set());
      router.refresh();
    });
  };

  const remove = () => {
    startTransition(async () => {
      const res = await removeStudentsFromClub(clubId, selectedIn);
      if (!res.ok) {
        toast.error(res.error ?? t("errors.failed"));
        return;
      }
      toast(t("removed", { count: res.removed ?? 0 }));
      setSelected(new Set());
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 dark:text-slate-400">{t("gradeLabel")}</label>
          <select
            className={FIELD}
            value={gradeId}
            onChange={(e) => {
              setGradeId(e.target.value);
              setClassId("");
            }}
          >
            <option value="">{t("allGrades")}</option>
            {grades.map((g) => (
              <option key={g.id} value={g.id}>
                {t("gradeName", { level: g.level })}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 dark:text-slate-400">{t("classLabel")}</label>
          <select className={FIELD} value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">{t("allClasses")}</option>
            {visibleClasses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 dark:text-slate-400">{t("showLabel")}</label>
          <select className={FIELD} value={view} onChange={(e) => setView(e.target.value as View)}>
            <option value="all">{t("viewAll")}</option>
            <option value="notIn">{t("viewNotIn")}</option>
            <option value="in">{t("viewIn")}</option>
          </select>
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-[10rem]">
          <label className="text-xs text-gray-500 dark:text-slate-400">{t("searchLabel")}</label>
          <input
            type="search"
            className={FIELD}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 px-3 py-1 font-semibold">
          {t("seats", { active: activeCount, capacity })}
        </span>
        {waitlistCount > 0 && (
          <span className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 px-3 py-1 font-semibold">
            {t("waitlistCount", { count: waitlistCount })}
          </span>
        )}
        <span className="text-gray-500 dark:text-slate-400">
          {t("shownCount", { shown: shown.length, total: students.length })}
        </span>
        <button
          type="button"
          onClick={toggleShown}
          disabled={shown.length === 0}
          className="ml-auto rounded-lg border border-blue-300 px-3 py-1.5 font-medium text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/30 disabled:opacity-50"
        >
          {allShownSelected ? t("unselectShown") : t("selectShown")}
        </button>
      </div>

      <ul className="max-h-[28rem] overflow-y-auto divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
        {shown.length === 0 && (
          <li className="p-4 text-sm text-gray-500 dark:text-slate-400">{t("noStudents")}</li>
        )}
        {shown.map((s) => (
          <li key={s.id}>
            <label className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/60">
              <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} />
              <span className="flex-1 font-medium text-gray-800 dark:text-slate-100">
                {s.name} {s.surname}
              </span>
              <span className="text-xs text-gray-500 dark:text-slate-400">{s.className}</span>
              {s.status === "ACTIVE" && (
                <span className="rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 px-2 py-0.5 text-xs font-semibold">
                  {t("inClub")}
                </span>
              )}
              {s.status === "WAITLISTED" && (
                <span className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 px-2 py-0.5 text-xs font-semibold">
                  {t("onWaitlist")}
                </span>
              )}
            </label>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={register}
          disabled={pending || selectedNew.length === 0}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {t("registerButton", { count: selectedNew.length })}
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={pending || selectedIn.length === 0}
          className="rounded-lg border border-red-300 px-5 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/30 disabled:opacity-60"
        >
          {t("removeButton", { count: selectedIn.length })}
        </button>
        {selected.size > 0 && (
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-sm text-gray-500 underline dark:text-slate-400"
          >
            {t("clearSelection")}
          </button>
        )}
      </div>
    </div>
  );
}
