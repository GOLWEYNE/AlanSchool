"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  Home,
  Menu as MenuIcon,
  MessageSquare,
  School,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { useMobileSidebar } from "@/context/MobileSidebarContext";

export type TabIconName =
  | "home"
  | "students"
  | "classes"
  | "myClass"
  | "lessons"
  | "assignments"
  | "results"
  | "events"
  | "inbox"
  | "more";

export type Tab = { icon: TabIconName; label: string; href?: string };

const ICONS: Record<TabIconName, LucideIcon> = {
  home: Home,
  students: GraduationCap,
  classes: School,
  myClass: School,
  lessons: BookOpen,
  assignments: ClipboardList,
  results: Trophy,
  events: CalendarDays,
  inbox: MessageSquare,
  more: MenuIcon,
};

// iOS-style bottom tab bar. Phones only (md:hidden): on tablets and desktops
// the sidebar is always visible, so nothing changes there. The last tab, "More",
// opens the full menu drawer so every page stays one tap away.
// The tabs themselves are defined per role in src/app/dashboard/layout.tsx.
export default function MobileTabBar({ tabs, menuLabel }: { tabs: Tab[]; menuLabel: string }) {
  const pathname = usePathname();
  const { open } = useMobileSidebar();

  const isActive = (href?: string) => {
    if (!href) return false;
    if (href === "/dashboard") {
      return /^\/dashboard(\/(admin|teacher|student|parent))?\/?$/.test(pathname);
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const buzz = () => {
    try {
      navigator.vibrate?.(8);
    } catch {
      /* haptics are optional */
    }
  };

  return (
    <nav aria-label={menuLabel} className="glass-tabbar md:hidden">
      <ul className="grid grid-cols-5 gap-1">
        {tabs.map(({ icon, label, href }) => {
          const Icon = ICONS[icon];
          const active = isActive(href);
          const inner = (
            <>
              <Icon size={22} strokeWidth={active ? 2.5 : 2} aria-hidden="true" />
              <span className="glass-tab__label">{label}</span>
            </>
          );
          return (
            <li key={icon}>
              {href ? (
                <Link
                  href={href}
                  onClick={buzz}
                  aria-current={active ? "page" : undefined}
                  className={`glass-tab ${active ? "is-active" : ""}`}
                >
                  {inner}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    buzz();
                    open();
                  }}
                  className="glass-tab w-full"
                >
                  {inner}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
