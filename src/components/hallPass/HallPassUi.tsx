import Link from "next/link";

export const CARD =
  "rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900";

export function Hero({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-amber-400 p-5 text-white max-md:rounded-3xl">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-1 text-sm opacity-90">{subtitle}</p>
    </div>
  );
}

export type NavKey = "live" | "history" | "settings";

// Small tab bar linking the three staff screens (admins get Settings too).
export function StaffNav({
  active,
  role,
  labels,
}: {
  active: NavKey;
  role: string;
  labels: Record<NavKey, string>;
}) {
  const tabs: { key: NavKey; href: string }[] = [
    { key: "live", href: "/dashboard/list/hall-pass" },
    { key: "history", href: "/dashboard/list/hall-pass/history" },
  ];
  if (role === "admin") tabs.push({ key: "settings", href: "/dashboard/list/hall-pass/settings" });

  return (
    <nav className="flex flex-wrap gap-2 max-md:-mx-4 max-md:flex-nowrap max-md:overflow-x-auto max-md:px-4 max-md:pb-1" style={{ scrollbarWidth: "none" }}>
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={
            "rounded-lg px-4 py-2 text-sm font-semibold transition max-md:flex max-md:min-h-11 max-md:shrink-0 max-md:items-center max-md:rounded-full " +
            (tab.key === active
              ? "bg-blue-600 text-white"
              : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800")
          }
        >
          {labels[tab.key]}
        </Link>
      ))}
    </nav>
  );
}
