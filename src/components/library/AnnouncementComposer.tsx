"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ANNOUNCEMENT_TYPES, MAX_PICKED_STUDENTS, type AnnouncementTypeKey } from "@/lib/libraryShared";
import type { LibraryResult } from "@/lib/libraryActions";
import { BTN, FIELD } from "@/components/library/LibraryClient";
import {
  AudiencePicker,
  BookPicker,
  ClassPicker,
  MediaUrlField,
  PhotoMulti,
  StudentPicker,
  type PickBook,
  type PickClass,
  type PickStudent,
} from "@/components/library/LibraryPickers";

type Props = {
  action: (formData: FormData) => Promise<LibraryResult>;
  grades: number[];
  classes: PickClass[];
  students: PickStudent[];
  books: PickBook[];
  defaultMonth: string;
  suggestedReaders: { id: string; name: string; sub: string }[];
  suggestedClasses: { id: number; name: string; sub: string }[];
};

const Step = ({ n, title, children }: { n: number; title: string; children: React.ReactNode }) => (
  <section className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-gray-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/40">
    <h3 className="flex items-center gap-2 text-sm font-bold text-gray-800 dark:text-blue-100">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs text-white">{n}</span>
      {title}
    </h3>
    {children}
  </section>
);

// The admin's announcement writer: pick a type, then the picker that type needs,
// add photos / video / audio, and publish.
export default function AnnouncementComposer(props: Props) {
  const t = useTranslations("Library.studio");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<LibraryResult | null>(null);
  const [nonce, setNonce] = useState(0);

  const [type, setType] = useState<AnnouncementTypeKey>("READER_OF_MONTH");
  const picker = ANNOUNCEMENT_TYPES.find((x) => x.key === type)!.picker;

  const [studentIds, setStudentIds] = useState<string[]>([]);
  const [classIds, setClassIds] = useState<number[]>([]);
  const [gradeLevels, setGradeLevels] = useState<number[]>([]);
  const [bookIds, setBookIds] = useState<number[]>([]);
  const [audience, setAudience] = useState("ALL");

  const changeType = (next: AnnouncementTypeKey) => {
    setType(next);
    setStudentIds([]);
    setClassIds([]);
    setGradeLevels([]);
    setBookIds([]);
    setAudience(next === "GRADE_CHALLENGE" ? "GRADES" : "ALL");
    setResult(null);
  };

  return (
    <form
      key={nonce}
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(async () => {
          const res = await props.action(data);
          setResult(res);
          if (res.ok) {
            setNonce((n) => n + 1);
            setStudentIds([]);
            setClassIds([]);
            setGradeLevels([]);
            setBookIds([]);
            router.refresh();
          }
        });
      }}
    >
      <input type="hidden" name="type" value={type} />

      <Step n={1} title={t("step1")}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ANNOUNCEMENT_TYPES.map((x) => (
            <button
              key={x.key}
              type="button"
              onClick={() => changeType(x.key)}
              className={
                "flex flex-col items-start gap-1 rounded-xl p-3 text-left transition " +
                (type === x.key
                  ? "bg-gradient-to-br from-blue-600 to-blue-500 text-white shadow-lg"
                  : "bg-white ring-1 ring-gray-200 hover:ring-blue-300 dark:bg-slate-900 dark:ring-slate-700")
              }
            >
              <span className="text-2xl">{x.emoji}</span>
              <span className="text-sm font-bold">{t("types." + x.key + ".name")}</span>
              <span className={"text-xs " + (type === x.key ? "text-blue-50" : "text-gray-500 dark:text-slate-400")}>
                {t("types." + x.key + ".hint")}
              </span>
            </button>
          ))}
        </div>
      </Step>

      <Step n={2} title={t("step2." + picker)}>
        {picker === "student" && (
          <StudentPicker
            grades={props.grades}
            classes={props.classes}
            students={props.students}
            value={studentIds}
            onChange={setStudentIds}
            multi={false}
            max={1}
            suggestions={props.suggestedReaders}
          />
        )}
        {picker === "students" && (
          <StudentPicker
            grades={props.grades}
            classes={props.classes}
            students={props.students}
            value={studentIds}
            onChange={setStudentIds}
            multi
            max={MAX_PICKED_STUDENTS}
            suggestions={props.suggestedReaders}
          />
        )}
        {picker === "class" && (
          <>
            {props.suggestedClasses.length > 0 && (
              <div className="rounded-xl bg-amber-50 p-3 dark:bg-amber-900/20">
                <div className="mb-2 text-xs font-semibold text-amber-800 dark:text-amber-200">{t("suggestionsClass")}</div>
                <div className="flex flex-wrap gap-2">
                  {props.suggestedClasses.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setClassIds([c.id])}
                      className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 ring-1 ring-amber-200 hover:bg-amber-100 dark:bg-slate-900 dark:text-slate-200"
                    >
                      {c.name} <span className="opacity-60">· {c.sub}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <ClassPicker grades={props.grades} classes={props.classes} value={classIds} onChange={setClassIds} multi={false} />
          </>
        )}
        {picker === "books" && <BookPicker books={props.books} value={bookIds} onChange={setBookIds} />}
        {picker === "audience" && (
          <AudiencePicker
            grades={props.grades}
            classes={props.classes}
            audience={audience}
            onAudience={setAudience}
            gradeLevels={gradeLevels}
            onGradeLevels={setGradeLevels}
            classIds={classIds}
            onClassIds={setClassIds}
          />
        )}
      </Step>

      <Step n={3} title={t("step3")}>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-500 dark:text-slate-400 md:col-span-2">
            {t("fTitle")}
            <input className={FIELD} name="title" required maxLength={140} placeholder={t("titlePlaceholder." + type)} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-500 dark:text-slate-400 md:col-span-2">
            {t("fBody")}
            <textarea className={FIELD} name="body" required rows={4} maxLength={3000} placeholder={t("bodyPlaceholder")} />
          </label>
          {(type === "READER_OF_MONTH" || type === "CLASS_CHAMPION") && (
            <label className="flex flex-col gap-1 text-xs font-medium text-gray-500 dark:text-slate-400">
              {t("fMonth")}
              <input className={FIELD} type="month" name="month" defaultValue={props.defaultMonth} />
            </label>
          )}
          {type === "EVENT" && (
            <label className="flex flex-col gap-1 text-xs font-medium text-gray-500 dark:text-slate-400">
              {t("fEvent")}
              <input className={FIELD} type="datetime-local" name="eventAt" required />
            </label>
          )}
        </div>
      </Step>

      <Step n={4} title={t("step4")}>
        <div className="flex flex-col gap-4">
          <div>
            <div className="mb-2 text-xs font-semibold text-gray-600 dark:text-slate-300">📸 {t("photos")}</div>
            <PhotoMulti />
          </div>
          <MediaUrlField name="videoUrl" kind="video" label={"🎬 " + t("video")} hint={t("videoHint")} />
          <div className="grid gap-3 md:grid-cols-2">
            <MediaUrlField name="audioUrl" kind="audio" label={"🔊 " + t("audio")} hint={t("audioHint")} />
            <label className="flex flex-col gap-1 text-xs font-medium text-gray-500 dark:text-slate-400">
              {t("audioTitle")}
              <input className={FIELD} name="audioTitle" maxLength={120} />
            </label>
          </div>
        </div>
      </Step>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-700 dark:text-slate-200">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="pinned" /> 📌 {t("pinned")}
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="notify" /> 🔔 {t("notify")}
        </label>
      </div>

      {result && (
        <p
          role="status"
          className={
            "rounded-lg px-3 py-2 text-sm " +
            (result.ok
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
              : "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300")
          }
        >
          {result.ok ? result.message : result.error}
        </p>
      )}

      <div>
        <button type="submit" className={BTN} disabled={pending}>
          {pending ? "…" : t("publish")}
        </button>
      </div>
    </form>
  );
}
