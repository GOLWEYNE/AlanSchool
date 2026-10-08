import { ReactNode } from "react";

// Small presentational pieces shared by the library pages (server-safe).

export const CARD =
  "rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900";

export function Section({
  title,
  emoji,
  action,
  children,
  className = "",
}: {
  title: string;
  emoji?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={CARD + " " + className}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-gray-800 dark:text-blue-100">
          {emoji ? <span className="mr-2">{emoji}</span> : null}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500 dark:border-slate-700 dark:text-slate-400">
      {children}
    </p>
  );
}

export function Avatar({ src, name, size = 40 }: { src?: string | null; name: string; size?: number }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className="shrink-0 rounded-full object-cover ring-2 ring-white dark:ring-slate-800"
    />
  ) : (
    <span
      style={{ width: size, height: size, fontSize: size / 2.6 }}
      className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-amber-400 font-bold text-white"
    >
      {initials}
    </span>
  );
}

export function Stars({ value, size = "text-base" }: { value: number; size?: string }) {
  const full = Math.round(value);
  return (
    <span className={size + " tracking-tight"} aria-label={`${value.toFixed(1)} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= full ? "text-amber-400" : "text-gray-300 dark:text-slate-600"}>
          ★
        </span>
      ))}
    </span>
  );
}

export function BookCover({
  src,
  title,
  emoji,
  className = "h-32 w-24",
}: {
  src?: string | null;
  title: string;
  emoji: string;
  className?: string;
}) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={title} className={className + " shrink-0 rounded-lg object-cover shadow-md"} />
  ) : (
    <div
      className={
        className +
        " flex shrink-0 flex-col items-center justify-center gap-1 rounded-lg bg-gradient-to-br from-blue-500 via-blue-400 to-amber-300 p-2 text-center text-white shadow-md"
      }
    >
      <span className="text-3xl">{emoji}</span>
      <span className="line-clamp-3 text-[10px] font-semibold leading-tight">{title}</span>
    </div>
  );
}

export function StatTile({ label, value, emoji }: { label: string; value: string | number; emoji: string }) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-blue-400 p-4 text-white shadow-sm">
      <div className="text-2xl">{emoji}</div>
      <div className="mt-1 text-3xl font-bold">{value}</div>
      <div className="text-sm opacity-90">{label}</div>
    </div>
  );
}
