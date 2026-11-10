import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import AnimatedNumber from "./AnimatedNumber";

// Shared glass building blocks for the teacher / student / parent home pages.
// Same look as the admin home and the student profile: frosted cards, blue and
// yellow accents, staggered entrance. Server components, no client state.

type Tone = "blue" | "gold";

const rise = (i: number): CSSProperties => ({ ["--i" as string]: i });

// Wraps an existing widget (its own card inside) so it fades in with the rest.
// `empty:hidden` drops the wrapper when a widget renders nothing.
export const Rise = ({
  i = 0,
  className = "",
  children,
}: {
  i?: number;
  className?: string;
  children: ReactNode;
}) => (
  <div style={rise(i)} className={`glass-rise empty:hidden ${className}`}>
    {children}
  </div>
);

export const HomeHero = ({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle: string;
}) => (
  <section style={rise(0)} className="glass-surface glass-feature glass-rise p-5 md:p-6">
    {eyebrow && <span className="glass-chip glass-chip--gold">{eyebrow}</span>}
    <h1 className="mt-2 text-3xl font-bold tracking-tight text-blue-950 md:text-4xl dark:text-blue-50">
      {title}
    </h1>
    <p className="mt-1 text-sm text-blue-800/80 md:text-base dark:text-blue-200/80">{subtitle}</p>
  </section>
);

export type HomeStat = {
  label: string;
  value: number | string;
  Icon: LucideIcon;
  tone?: Tone;
};

export const HomeStats = ({ stats, start = 1 }: { stats: HomeStat[]; start?: number }) => (
  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
    {stats.map(({ label, value, Icon, tone = "blue" }, k) => (
      <div
        key={label}
        style={rise(start + k)}
        className="glass-surface glass-tile glass-rise glass-lift group flex min-w-0 flex-col gap-3 p-4"
      >
        <span className={`glass-icon glass-icon--${tone}`}>
          <Icon size={20} strokeWidth={2.2} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          {typeof value === "number" ? (
            <AnimatedNumber
              value={value}
              className="block text-3xl font-bold tracking-tight text-blue-950 dark:text-blue-50"
            />
          ) : (
            <span className="block truncate text-3xl font-bold tracking-tight text-blue-950 dark:text-blue-50">
              {value}
            </span>
          )}
          <span className="mt-1 block truncate text-sm font-medium text-blue-800/80 dark:text-blue-200/80">
            {label}
          </span>
        </div>
      </div>
    ))}
  </div>
);

export type HomeShortcut = {
  href: string;
  label: string;
  Icon: LucideIcon;
  tone?: Tone;
};

// iOS home-screen style grid: big rounded icon, short label underneath.
export const HomeShortcuts = ({
  items,
  start = 5,
}: {
  items: HomeShortcut[];
  start?: number;
}) => (
  <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-6">
    {items.map(({ href, label, Icon, tone = "blue" }, k) => (
      <Link
        key={href}
        href={href}
        style={rise(start + k)}
        className="glass-surface glass-lift glass-rise group flex flex-col items-center gap-2 px-2 py-3 text-center active:scale-95"
      >
        <span className={`glass-icon glass-icon--${tone}`}>
          <Icon size={20} strokeWidth={2.2} aria-hidden="true" />
        </span>
        <span className="text-xs font-semibold leading-tight text-blue-900 dark:text-blue-100">
          {label}
        </span>
      </Link>
    ))}
  </div>
);

export const HomeSection = ({
  title,
  Icon,
  action,
  i = 0,
  className = "",
  children,
}: {
  title: string;
  Icon?: LucideIcon;
  action?: ReactNode;
  i?: number;
  className?: string;
  children: ReactNode;
}) => (
  <section style={rise(i)} className={`glass-surface glass-rise p-4 md:p-5 ${className}`}>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-blue-950 dark:text-blue-50">
        {Icon && (
          <span className="glass-icon glass-icon--blue !h-8 !w-8 !rounded-xl">
            <Icon size={16} strokeWidth={2.2} aria-hidden="true" />
          </span>
        )}
        {title}
      </h2>
      {action}
    </div>
    {children}
  </section>
);
