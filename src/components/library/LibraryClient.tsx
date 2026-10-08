"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useMemo, useRef, useState, useTransition } from "react";
import { CldUploadWidget } from "next-cloudinary";
import type { LibraryResult } from "@/lib/libraryActions";

export const FIELD =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-blue-900";
export const BTN =
  "inline-flex items-center justify-center gap-1 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-blue-700 hover:to-blue-600 disabled:cursor-not-allowed disabled:opacity-60";
export const BTN_GHOST =
  "inline-flex items-center justify-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800";

type Tab = { href: string; label: string };

// Tab bar shared by every library page.
export function LibraryNav({ tabs }: { tabs: Tab[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Library">
      {tabs.map((tab, index) => {
        const active =
          index === 0 ? pathname === tab.href : pathname === tab.href || pathname.startsWith(tab.href + "/");
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={
              "rounded-full px-4 py-2 text-sm font-semibold transition " +
              (active
                ? "bg-blue-600 text-white shadow"
                : "bg-white text-blue-700 ring-1 ring-blue-100 hover:bg-blue-50 dark:bg-slate-900 dark:text-blue-300 dark:ring-slate-700 dark:hover:bg-slate-800")
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Feedback({ result }: { result: LibraryResult | null }) {
  if (!result) return null;
  return (
    <p
      role="status"
      className={
        "rounded-lg px-3 py-2 text-sm " +
        (result.ok
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
          : "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300")
      }
    >
      {result.ok ? result.message ?? "✓" : result.error}
    </p>
  );
}

// A form that submits to a server action and shows the result inline.
export function ActionForm({
  action,
  children,
  submitLabel,
  className = "flex flex-col gap-3",
  resetOnSuccess = true,
}: {
  action: (formData: FormData) => Promise<LibraryResult>;
  children: ReactNode;
  submitLabel: string;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<LibraryResult | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  return (
    <form
      ref={formRef}
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(async () => {
          const res = await action(data);
          setResult(res);
          if (res.ok) {
            if (resetOnSuccess) formRef.current?.reset();
            router.refresh();
          }
        });
      }}
    >
      {children}
      <Feedback result={result} />
      <div>
        <button type="submit" className={BTN} disabled={pending}>
          {pending ? "…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

// A one-click server action (return a book, approve a review, delete ...).
export function ActionButton({
  action,
  label,
  className = BTN_GHOST,
  confirmText,
}: {
  action: () => Promise<LibraryResult>;
  label: string;
  className?: string;
  confirmText?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        className={className}
        disabled={pending}
        onClick={() => {
          if (confirmText && !window.confirm(confirmText)) return;
          startTransition(async () => {
            const res = await action();
            setError(res.ok ? null : res.error ?? "Error");
            if (res.ok) router.refresh();
          });
        }}
      >
        {pending ? "…" : label}
      </button>
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </span>
  );
}

// Cloudinary upload (same preset the rest of the app uses) with a preview.
export function ImageField({
  name,
  label,
  uploadLabel,
  initial,
}: {
  name: string;
  label: string;
  uploadLabel: string;
  initial?: string | null;
}) {
  const [url, setUrl] = useState(initial ?? "");
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-500 dark:text-slate-400">{label}</span>
      <input type="hidden" name={name} value={url} />
      <div className="flex items-center gap-3">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-14 w-14 rounded-lg object-cover ring-1 ring-gray-200 dark:ring-slate-700" />
        ) : null}
        <CldUploadWidget
          uploadPreset="school"
          onSuccess={(result, { widget }) => {
            const info = result.info as { secure_url?: string } | undefined;
            if (info?.secure_url) setUrl(info.secure_url);
            widget.close();
          }}
        >
          {({ open }) => (
            <button type="button" className={BTN_GHOST} onClick={() => open()}>
              <Image src="/upload.png" alt="" width={16} height={16} className="dark:invert" />
              {uploadLabel}
            </button>
          )}
        </CldUploadWidget>
        {url && (
          <button type="button" className="text-xs text-rose-600 underline" onClick={() => setUrl("")}>
            ×
          </button>
        )}
      </div>
    </div>
  );
}

// Class -> student -> book pickers for recording a loan.
export function LendFields({
  classes,
  students,
  books,
  labels,
}: {
  classes: { id: number; name: string }[];
  students: { id: string; name: string; classId: number }[];
  books: { id: number; title: string; available: number }[];
  labels: { class: string; student: string; book: string; days: string; choose: string; search: string };
}) {
  const [classId, setClassId] = useState<number | "">("");
  const [q, setQ] = useState("");
  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return students.filter(
      (s) => (classId === "" || s.classId === classId) && (!needle || s.name.toLowerCase().includes(needle))
    );
  }, [students, classId, q]);

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <label className="flex flex-col gap-1 text-xs font-medium text-gray-500 dark:text-slate-400">
        {labels.class}
        <select
          className={FIELD}
          value={classId}
          onChange={(e) => setClassId(e.target.value ? Number(e.target.value) : "")}
        >
          <option value="">{labels.choose}</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-gray-500 dark:text-slate-400">
        {labels.search}
        <input className={FIELD} value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-gray-500 dark:text-slate-400">
        {labels.student}
        <select className={FIELD} name="studentId" required defaultValue="">
          <option value="" disabled>
            {labels.choose}
          </option>
          {visible.slice(0, 300).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-gray-500 dark:text-slate-400">
        {labels.book}
        <select className={FIELD} name="bookId" required defaultValue="">
          <option value="" disabled>
            {labels.choose}
          </option>
          {books.map((b) => (
            <option key={b.id} value={b.id} disabled={b.available <= 0}>
              {b.title} ({b.available})
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-gray-500 dark:text-slate-400">
        {labels.days}
        <input className={FIELD} type="number" name="days" min={1} max={60} defaultValue={14} />
      </label>
    </div>
  );
}
