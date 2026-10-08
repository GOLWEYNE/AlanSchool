"use client";

import { ReactNode, useMemo, useState } from "react";
import { CldUploadWidget } from "next-cloudinary";
import { useTranslations } from "next-intl";
import { BTN_GHOST, FIELD } from "@/components/library/LibraryClient";

export type PickClass = { id: number; name: string; grade: number; students: number };
export type PickStudent = { id: string; name: string; classId: number; img: string | null };
export type PickBook = { id: number; title: string; author: string };

const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

const Chip = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    className={
      "rounded-full px-3 py-1.5 text-sm font-semibold transition " +
      (active
        ? "bg-blue-600 text-white shadow"
        : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-blue-50 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800")
    }
  >
    {children}
  </button>
);

const Initials = ({ name, img }: { name: string; img?: string | null }) =>
  img ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={img} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
  ) : (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-amber-400 text-xs font-bold text-white">
      {name
        .split(" ")
        .map((p) => p[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase()}
    </span>
  );

// ------------------------------------------------------------------ grade picker

export function GradePicker({
  grades,
  value,
  onChange,
  name = "gradeLevels",
}: {
  grades: number[];
  value: number[];
  onChange: (v: number[]) => void;
  name?: string;
}) {
  const t = useTranslations("Library.studio");
  return (
    <div className="flex flex-wrap gap-2">
      {value.map((g) => (
        <input key={g} type="hidden" name={name} value={g} />
      ))}
      {grades.map((g) => (
        <Chip key={g} active={value.includes(g)} onClick={() => onChange(toggle(value, g))}>
          {t("gradeLabel", { n: g })}
        </Chip>
      ))}
      {grades.length > 1 && (
        <button
          type="button"
          className="text-xs font-semibold text-blue-600 underline dark:text-blue-300"
          onClick={() => onChange(value.length === grades.length ? [] : grades)}
        >
          {value.length === grades.length ? t("clearAll") : t("selectAll")}
        </button>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ class picker (grade -> classes)

export function ClassPicker({
  grades,
  classes,
  value,
  onChange,
  multi,
}: {
  grades: number[];
  classes: PickClass[];
  value: number[];
  onChange: (v: number[]) => void;
  multi: boolean;
}) {
  const t = useTranslations("Library.studio");
  const [grade, setGrade] = useState<number | "">("");
  const visible = classes.filter((c) => grade === "" || c.grade === grade);
  return (
    <div className="flex flex-col gap-3">
      {value.map((id) => (
        <input key={id} type="hidden" name="classIds" value={id} />
      ))}
      <label className="flex max-w-xs flex-col gap-1 text-xs font-medium text-gray-500 dark:text-slate-400">
        {t("gradePicker")}
        <select className={FIELD} value={grade} onChange={(e) => setGrade(e.target.value ? Number(e.target.value) : "")}>
          <option value="">{t("allGrades")}</option>
          {grades.map((g) => (
            <option key={g} value={g}>
              {t("gradeLabel", { n: g })}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap gap-2">
        {visible.map((c) => (
          <Chip
            key={c.id}
            active={value.includes(c.id)}
            onClick={() => onChange(multi ? toggle(value, c.id) : value.includes(c.id) ? [] : [c.id])}
          >
            {c.name} <span className="opacity-60">({c.students})</span>
          </Chip>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ student picker (grade -> class -> students)

export function StudentPicker({
  grades,
  classes,
  students,
  value,
  onChange,
  multi,
  max,
  suggestions,
}: {
  grades: number[];
  classes: PickClass[];
  students: PickStudent[];
  value: string[];
  onChange: (v: string[]) => void;
  multi: boolean;
  max: number;
  suggestions?: { id: string; name: string; sub: string }[];
}) {
  const t = useTranslations("Library.studio");
  const [grade, setGrade] = useState<number | "">("");
  const [classId, setClassId] = useState<number | "">("");
  const [q, setQ] = useState("");

  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);
  const byId = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const classOptions = classes.filter((c) => grade === "" || c.grade === grade);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return students
      .filter((s) => {
        const cls = classMap.get(s.classId);
        if (!cls) return false;
        if (grade !== "" && cls.grade !== grade) return false;
        if (classId !== "" && s.classId !== classId) return false;
        return !needle || s.name.toLowerCase().includes(needle);
      })
      .slice(0, 200);
  }, [students, classMap, grade, classId, q]);

  const pick = (id: string) => {
    if (!multi) return onChange(value.includes(id) ? [] : [id]);
    if (value.includes(id)) return onChange(value.filter((x) => x !== id));
    if (value.length >= max) return;
    onChange([...value, id]);
  };

  return (
    <div className="flex flex-col gap-3">
      {value.map((id) => (
        <input key={id} type="hidden" name="studentIds" value={id} />
      ))}

      {suggestions && suggestions.length > 0 && (
        <div className="rounded-xl bg-amber-50 p-3 dark:bg-amber-900/20">
          <div className="mb-2 text-xs font-semibold text-amber-800 dark:text-amber-200">{t("suggestions")}</div>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => pick(s.id)}
                className={
                  "rounded-full px-3 py-1.5 text-sm font-semibold ring-1 transition " +
                  (value.includes(s.id)
                    ? "bg-amber-400 text-blue-950 ring-amber-500"
                    : "bg-white text-gray-700 ring-amber-200 hover:bg-amber-100 dark:bg-slate-900 dark:text-slate-200")
                }
              >
                {s.name} <span className="opacity-60">· {s.sub}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-500 dark:text-slate-400">
          {t("gradePicker")}
          <select
            className={FIELD}
            value={grade}
            onChange={(e) => {
              setGrade(e.target.value ? Number(e.target.value) : "");
              setClassId("");
            }}
          >
            <option value="">{t("allGrades")}</option>
            {grades.map((g) => (
              <option key={g} value={g}>
                {t("gradeLabel", { n: g })}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-500 dark:text-slate-400">
          {t("classPicker")}
          <select
            className={FIELD}
            value={classId}
            onChange={(e) => setClassId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">{t("allClasses")}</option>
            {classOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-500 dark:text-slate-400">
          {t("searchStudent")}
          <input className={FIELD} value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>

      <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-200 dark:border-slate-700">
        {visible.length === 0 ? (
          <p className="p-4 text-center text-sm text-gray-500 dark:text-slate-400">{t("noStudents")}</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-slate-800">
            {visible.map((s) => {
              const on = value.includes(s.id);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => pick(s.id)}
                    className={
                      "flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition " +
                      (on ? "bg-blue-50 dark:bg-blue-950/40" : "hover:bg-gray-50 dark:hover:bg-slate-800/60")
                    }
                  >
                    <Initials name={s.name} img={s.img} />
                    <span className="flex-1 truncate font-medium text-gray-800 dark:text-slate-100">{s.name}</span>
                    <span className="text-xs text-gray-500 dark:text-slate-400">{classMap.get(s.classId)?.name}</span>
                    <span className={"text-lg " + (on ? "text-blue-600" : "text-gray-300")}>{on ? "✓" : "○"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">
          {t("pickedCount", { count: value.length, max: multi ? max : 1 })}
        </span>
        {value.map((id) => {
          const s = byId.get(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => pick(id)}
              className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800 hover:bg-rose-100 hover:text-rose-700 dark:bg-blue-900/40 dark:text-blue-200"
              title={t("remove")}
            >
              {s?.name ?? id} ×
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ book picker

export function BookPicker({
  books,
  value,
  onChange,
}: {
  books: PickBook[];
  value: number[];
  onChange: (v: number[]) => void;
}) {
  const t = useTranslations("Library.studio");
  const [q, setQ] = useState("");
  const visible = books.filter((b) => !q.trim() || (b.title + " " + b.author).toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="flex flex-col gap-3">
      {value.map((id) => (
        <input key={id} type="hidden" name="bookIds" value={id} />
      ))}
      <input className={FIELD} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchBook")} />
      <div className="max-h-56 overflow-y-auto rounded-xl border border-gray-200 dark:border-slate-700">
        {visible.length === 0 ? (
          <p className="p-4 text-center text-sm text-gray-500 dark:text-slate-400">{t("noBooks")}</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-slate-800">
            {visible.slice(0, 200).map((b) => {
              const on = value.includes(b.id);
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => onChange(toggle(value, b.id))}
                    className={
                      "flex w-full items-center gap-3 px-3 py-2 text-left text-sm " +
                      (on ? "bg-blue-50 dark:bg-blue-950/40" : "hover:bg-gray-50 dark:hover:bg-slate-800/60")
                    }
                  >
                    <span className="text-lg">📖</span>
                    <span className="flex-1 truncate font-medium text-gray-800 dark:text-slate-100">{b.title}</span>
                    <span className="truncate text-xs text-gray-500 dark:text-slate-400">{b.author}</span>
                    <span className={"text-lg " + (on ? "text-blue-600" : "text-gray-300")}>{on ? "✓" : "○"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">
        {t("booksPicked", { count: value.length })}
      </span>
    </div>
  );
}

// ------------------------------------------------------------------ audience picker (everyone / grades / classes)

export function AudiencePicker({
  grades,
  classes,
  audience,
  onAudience,
  gradeLevels,
  onGradeLevels,
  classIds,
  onClassIds,
}: {
  grades: number[];
  classes: PickClass[];
  audience: string;
  onAudience: (v: string) => void;
  gradeLevels: number[];
  onGradeLevels: (v: number[]) => void;
  classIds: number[];
  onClassIds: (v: number[]) => void;
}) {
  const t = useTranslations("Library.studio");
  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name="audience" value={audience} />
      <div className="flex flex-wrap gap-2">
        {(["ALL", "GRADES", "CLASSES"] as const).map((a) => (
          <Chip key={a} active={audience === a} onClick={() => onAudience(a)}>
            {t("audience." + a)}
          </Chip>
        ))}
      </div>
      {audience === "GRADES" && <GradePicker grades={grades} value={gradeLevels} onChange={onGradeLevels} />}
      {audience === "CLASSES" && (
        <ClassPicker grades={grades} classes={classes} value={classIds} onChange={onClassIds} multi />
      )}
      {audience === "ALL" && <p className="text-xs text-gray-500 dark:text-slate-400">{t("audienceAllHint")}</p>}
    </div>
  );
}

// ------------------------------------------------------------------ uploads

type MediaKind = "image" | "video" | "audio";

function UploadButton({
  kind,
  multiple,
  label,
  onUploaded,
}: {
  kind: MediaKind;
  multiple?: boolean;
  label: string;
  onUploaded: (url: string) => void;
}) {
  const options =
    kind === "image"
      ? { sources: ["local", "camera"] as ("local" | "camera")[], multiple: !!multiple, maxFiles: 12, clientAllowedFormats: ["jpg", "jpeg", "png", "webp", "gif"], maxFileSize: 15728640 }
      : kind === "video"
        ? { resourceType: "video", sources: ["local"] as "local"[], clientAllowedFormats: ["mp4", "mov", "webm", "mkv", "avi", "m4v"], maxFileSize: 209715200 }
        : { resourceType: "video", sources: ["local"] as "local"[], clientAllowedFormats: ["mp3", "wav", "m4a", "ogg", "aac"], maxFileSize: 104857600 };
  return (
    <CldUploadWidget
      uploadPreset="school"
      options={options}
      onSuccess={(result, { widget }) => {
        const info = result?.info as { secure_url?: string } | undefined;
        if (info?.secure_url) onUploaded(info.secure_url);
        if (!multiple) widget.close();
      }}
    >
      {({ open }) => (
        <button type="button" className={BTN_GHOST} onClick={() => open()}>
          ⬆ {label}
        </button>
      )}
    </CldUploadWidget>
  );
}

// Several photos, shown as removable thumbnails (field name: photoUrls).
export function PhotoMulti({ name = "photoUrls", max = 12 }: { name?: string; max?: number }) {
  const t = useTranslations("Library.studio");
  const [urls, setUrls] = useState<string[]>([]);
  return (
    <div className="flex flex-col gap-2">
      {urls.map((u) => (
        <input key={u} type="hidden" name={name} value={u} />
      ))}
      <div className="flex flex-wrap items-center gap-3">
        {urls.map((u) => (
          <div key={u} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt="" className="h-20 w-20 rounded-lg object-cover ring-1 ring-gray-200 dark:ring-slate-700" />
            <button
              type="button"
              onClick={() => setUrls((cur) => cur.filter((x) => x !== u))}
              className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-rose-600 text-xs font-bold text-white shadow"
              aria-label={t("remove")}
            >
              ×
            </button>
          </div>
        ))}
        {urls.length < max && (
          <UploadButton
            kind="image"
            multiple
            label={t("addPhotos")}
            onUploaded={(u) => setUrls((cur) => (cur.includes(u) || cur.length >= max ? cur : [...cur, u]))}
          />
        )}
      </div>
      <span className="text-xs text-gray-500 dark:text-slate-400">{t("photosHint", { max })}</span>
    </div>
  );
}

// A link field with an "upload a file" shortcut (video or audio).
export function MediaUrlField({
  name,
  kind,
  label,
  hint,
  initial,
}: {
  name: string;
  kind: "video" | "audio";
  label: string;
  hint: string;
  initial?: string | null;
}) {
  const t = useTranslations("Library.studio");
  const [url, setUrl] = useState(initial ?? "");
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-500 dark:text-slate-400">{label}</span>
      <div className="flex flex-wrap items-center gap-2">
        <input
          className={FIELD + " min-w-[220px] flex-1"}
          name={name}
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://"
        />
        <UploadButton kind={kind} label={kind === "video" ? t("uploadVideo") : t("uploadAudio")} onUploaded={setUrl} />
        {url && (
          <button type="button" className="text-xs text-rose-600 underline" onClick={() => setUrl("")}>
            {t("remove")}
          </button>
        )}
      </div>
      <span className="text-xs text-gray-400">{hint}</span>
    </div>
  );
}
