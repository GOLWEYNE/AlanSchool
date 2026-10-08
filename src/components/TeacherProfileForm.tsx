"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { saveTeacherProfile } from "@/lib/teacherProfileActions";
import {
  OBJECTIVE_STATUSES,
  POSITIONS,
  TERMS,
  type ObjectiveStatus,
  type PositionKey,
} from "@/lib/teacherProfileConstants";

export type ProfileFormData = {
  position: PositionKey | "";
  department: string;
  yearJoined: string;
  yearsExperience: string;
  about: string;
  education: string;
  previousSchools: string;
  certificates: string;
  achievements: { title: string; year: string; note: string }[];
  vision: string;
  objectives: { term: number; text: string; status: ObjectiveStatus }[];
};

const FIELD =
  "w-full ring-[1.5px] ring-gray-300 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2 rounded-md text-sm";
const CARD = "rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900";
const LABEL = "text-xs font-medium text-gray-600 dark:text-slate-300";

// The teacher's profile form. Photo and position are required; everything else
// can be filled in now or later from the profile page.
export default function TeacherProfileForm({
  initial,
  supervises,
  firstTime,
}: {
  initial: ProfileFormData;
  // What the system already knows (classes / clubs this teacher supervises).
  supervises: { classes: string[]; clubs: string[] };
  firstTime: boolean;
}) {
  const t = useTranslations("TeacherProfile");
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [data, setData] = useState<ProfileFormData>(initial);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const hasPhoto = !!user?.hasImage;
  const set = <K extends keyof ProfileFormData>(key: K, value: ProfileFormData[K]) =>
    setData((prev) => ({ ...prev, [key]: value }));

  const uploadPhoto = async (file: File | undefined) => {
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      toast.error(t("photo.notImage"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("photo.tooBig"));
      return;
    }
    setUploading(true);
    try {
      await user.setProfileImage({ file });
      await user.reload();
      toast(t("photo.updated"));
    } catch {
      toast.error(t("photo.failed"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const updateAchievement = (i: number, patch: Partial<ProfileFormData["achievements"][number]>) =>
    set(
      "achievements",
      data.achievements.map((a, idx) => (idx === i ? { ...a, ...patch } : a))
    );

  const updateObjective = (i: number, patch: Partial<ProfileFormData["objectives"][number]>) =>
    set(
      "objectives",
      data.objectives.map((o, idx) => (idx === i ? { ...o, ...patch } : o))
    );

  // Progress: required photo + position, then the optional sections.
  const steps = [
    hasPhoto,
    !!data.position,
    !!data.about.trim(),
    !!(data.education.trim() || data.previousSchools.trim() || data.certificates.trim() || data.yearsExperience),
    data.achievements.some((a) => a.title.trim()),
    !!data.vision.trim(),
    data.objectives.some((o) => o.text.trim()),
  ];
  const done = steps.filter(Boolean).length;
  const percent = Math.round((done / steps.length) * 100);

  const submit = () => {
    startTransition(async () => {
      const res = await saveTeacherProfile({
        position: data.position || null,
        department: data.department,
        yearJoined: data.yearJoined,
        yearsExperience: data.yearsExperience,
        about: data.about,
        education: data.education,
        previousSchools: data.previousSchools,
        certificates: data.certificates,
        achievements: data.achievements.map((a) => ({ title: a.title, year: a.year, note: a.note })),
        vision: data.vision,
        objectives: data.objectives,
      });
      if (!res.ok) {
        toast.error(t(`errors.${res.error ?? "failed"}`));
        return;
      }
      if (!res.complete) {
        const items = (res.missing ?? []).map((m) => t(`required.${m}`)).join(", ");
        toast.error(t("errors.missingRequired", { items }));
        return;
      }
      toast(t("saved"));
      router.push("/dashboard/teacher");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className={CARD}>
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-semibold text-gray-800 dark:text-slate-100">
            {t("progress", { done, total: steps.length })}
          </span>
          <span className="text-gray-500 dark:text-slate-400">{percent}%</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-slate-800">
          <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${percent}%` }} />
        </div>
        {firstTime && <p className="mt-3 text-sm text-gray-600 dark:text-slate-300">{t("requiredNote")}</p>}
      </div>

      {/* 1. Photo + position (required) */}
      <section className={CARD}>
        <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-100">{t("identity.title")}</h2>
        <div className="mt-4 flex flex-col gap-5 md:flex-row">
          <div className="flex flex-col items-center gap-3 md:w-56">
            {isLoaded && hasPhoto && user ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.imageUrl}
                alt=""
                className="h-36 w-36 rounded-full object-cover ring-4 ring-blue-100 dark:ring-slate-700"
              />
            ) : (
              <div className="flex h-36 w-36 items-center justify-center rounded-full bg-gray-100 text-center text-xs text-gray-500 ring-4 ring-amber-200 dark:bg-slate-800 dark:text-slate-400">
                {t("photo.none")}
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => uploadPhoto(e.target.files?.[0])}
            />
            <button
              type="button"
              disabled={uploading || !isLoaded}
              onClick={() => fileRef.current?.click()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {uploading ? t("photo.uploading") : hasPhoto ? t("photo.change") : t("photo.upload")}
            </button>
            <p className="text-center text-xs text-gray-500 dark:text-slate-400">{t("photo.hint")}</p>
          </div>

          <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1 md:col-span-2">
              <span className={LABEL}>{t("identity.position")} *</span>
              <select
                className={FIELD}
                value={data.position}
                onChange={(e) => set("position", e.target.value as PositionKey | "")}
              >
                <option value="">{t("identity.choose")}</option>
                {POSITIONS.map((p) => (
                  <option key={p} value={p}>
                    {t(`positions.${p}`)}
                  </option>
                ))}
              </select>
            </label>
            {(supervises.classes.length > 0 || supervises.clubs.length > 0) && (
              <p className="rounded-lg bg-blue-50 p-3 text-xs text-blue-900 dark:bg-slate-800 dark:text-blue-100 md:col-span-2">
                {supervises.classes.length > 0 && (
                  <span className="block">{t("identity.supervisesClasses", { names: supervises.classes.join(", ") })}</span>
                )}
                {supervises.clubs.length > 0 && (
                  <span className="block">{t("identity.supervisesClubs", { names: supervises.clubs.join(", ") })}</span>
                )}
              </p>
            )}
            <label className="flex flex-col gap-1">
              <span className={LABEL}>{t("identity.department")}</span>
              <input
                className={FIELD}
                maxLength={80}
                value={data.department}
                onChange={(e) => set("department", e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={LABEL}>{t("identity.yearJoined")}</span>
              <input
                className={FIELD}
                inputMode="numeric"
                maxLength={4}
                value={data.yearJoined}
                onChange={(e) => set("yearJoined", e.target.value.replace(/\D/g, ""))}
              />
            </label>
            <label className="flex flex-col gap-1 md:col-span-2">
              <span className={LABEL}>{t("identity.about")}</span>
              <textarea
                className={FIELD}
                rows={3}
                maxLength={500}
                value={data.about}
                onChange={(e) => set("about", e.target.value)}
                placeholder={t("identity.aboutPlaceholder")}
              />
            </label>
          </div>
        </div>
      </section>

      {/* 2. Background */}
      <section className={CARD}>
        <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-100">{t("background.title")}</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className={LABEL}>{t("background.education")}</span>
            <textarea
              className={FIELD}
              rows={3}
              maxLength={500}
              value={data.education}
              onChange={(e) => set("education", e.target.value)}
              placeholder={t("background.educationPlaceholder")}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={LABEL}>{t("background.previousSchools")}</span>
            <textarea
              className={FIELD}
              rows={3}
              maxLength={500}
              value={data.previousSchools}
              onChange={(e) => set("previousSchools", e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={LABEL}>{t("background.yearsExperience")}</span>
            <input
              className={FIELD}
              inputMode="numeric"
              maxLength={2}
              value={data.yearsExperience}
              onChange={(e) => set("yearsExperience", e.target.value.replace(/\D/g, ""))}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={LABEL}>{t("background.certificates")}</span>
            <textarea
              className={FIELD}
              rows={2}
              maxLength={500}
              value={data.certificates}
              onChange={(e) => set("certificates", e.target.value)}
            />
          </label>
        </div>
      </section>

      {/* 3. Achievements */}
      <section className={CARD}>
        <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-100">{t("achievements.title")}</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">{t("achievements.hint")}</p>
        <div className="mt-4 flex flex-col gap-3">
          {data.achievements.map((a, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 rounded-xl border border-gray-100 p-3 dark:border-slate-800 md:grid-cols-[1fr_6rem_1fr_auto]">
              <input
                className={FIELD}
                maxLength={120}
                value={a.title}
                onChange={(e) => updateAchievement(i, { title: e.target.value })}
                placeholder={t("achievements.titlePlaceholder")}
              />
              <input
                className={FIELD}
                inputMode="numeric"
                maxLength={4}
                value={a.year}
                onChange={(e) => updateAchievement(i, { year: e.target.value.replace(/\D/g, "") })}
                placeholder={t("achievements.year")}
              />
              <input
                className={FIELD}
                maxLength={200}
                value={a.note}
                onChange={(e) => updateAchievement(i, { note: e.target.value })}
                placeholder={t("achievements.note")}
              />
              <button
                type="button"
                onClick={() => set("achievements", data.achievements.filter((_, idx) => idx !== i))}
                className="text-sm font-semibold text-red-600 hover:underline"
              >
                {t("remove")}
              </button>
            </div>
          ))}
          {data.achievements.length < 5 && (
            <button
              type="button"
              onClick={() => set("achievements", [...data.achievements, { title: "", year: "", note: "" }])}
              className="self-start rounded-lg border border-blue-300 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/30"
            >
              + {t("achievements.add")}
            </button>
          )}
        </div>
      </section>

      {/* 4. Vision + objectives */}
      <section className={CARD}>
        <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-100">{t("goals.title")}</h2>
        <label className="mt-4 flex flex-col gap-1">
          <span className={LABEL}>{t("goals.vision")}</span>
          <textarea
            className={FIELD}
            rows={4}
            maxLength={1000}
            value={data.vision}
            onChange={(e) => set("vision", e.target.value)}
            placeholder={t("goals.visionPlaceholder")}
          />
        </label>
        <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">{t("goals.visibility")}</p>

        <h3 className="mt-6 text-base font-semibold text-gray-800 dark:text-slate-100">{t("goals.objectivesTitle")}</h3>
        <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {TERMS.map((term) => {
            const rows = data.objectives
              .map((o, index) => ({ o, index }))
              .filter(({ o }) => o.term === term);
            return (
              <div key={term} className="rounded-xl border border-gray-100 p-3 dark:border-slate-800">
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">{t("goals.term", { term })}</p>
                <div className="mt-2 flex flex-col gap-2">
                  {rows.map(({ o, index }) => (
                    <div key={index} className="flex flex-col gap-1.5">
                      <input
                        className={FIELD}
                        maxLength={200}
                        value={o.text}
                        onChange={(e) => updateObjective(index, { text: e.target.value })}
                        placeholder={t("goals.objectivePlaceholder")}
                      />
                      <div className="flex items-center gap-2">
                        <select
                          className={FIELD + " !w-auto"}
                          value={o.status}
                          onChange={(e) => updateObjective(index, { status: e.target.value as ObjectiveStatus })}
                        >
                          {OBJECTIVE_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {t(`status.${s}`)}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => set("objectives", data.objectives.filter((_, idx) => idx !== index))}
                          className="text-xs font-semibold text-red-600 hover:underline"
                        >
                          {t("remove")}
                        </button>
                      </div>
                    </div>
                  ))}
                  {rows.length < 4 && (
                    <button
                      type="button"
                      onClick={() =>
                        set("objectives", [...data.objectives, { term, text: "", status: "PLANNED" }])
                      }
                      className="self-start text-sm font-medium text-blue-700 hover:underline dark:text-blue-300"
                    >
                      + {t("goals.addObjective")}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={pending || uploading}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? t("saving") : firstTime ? t("saveAndContinue") : t("save")}
        </button>
        <p className="text-xs text-gray-500 dark:text-slate-400">{t("requiredFooter")}</p>
      </div>
    </div>
  );
}
