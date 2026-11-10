"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronDown } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useMobileSidebar } from "@/context/MobileSidebarContext";

type MenuItem = {
  icon: string;
  label: string;
  href: string;
  visible: string[];
};

type MenuSection = {
  title: string;
  items: MenuItem[];
};

type MenuContentProps = {
  items: MenuSection[];
  role: string;
};

const MenuContent = ({ items, role }: MenuContentProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const { close } = useMobileSidebar();

  const isActiveLink = (href: string) => {
    if (href === "/dashboard") {
      // Home is only "current" on the dashboard landing pages, not on every
      // page underneath /dashboard.
      return /^\/dashboard(\/(admin|teacher|student|parent))?\/?$/.test(pathname);
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  };

  // Phones only: each section folds up like an iOS Settings group so a long
  // menu (teachers have over 30 items) opens as a short list of headings. The
  // section holding the current page starts open. Tablets and desktops always
  // show every section, exactly as before.
  const sections = items
    .map((section) => ({ ...section, items: section.items.filter((item) => item.visible.includes(role)) }))
    .filter((section) => section.items.length > 0);
  const currentSection =
    sections.find((section) => section.items.some((item) => item.href !== "/dashboard" && isActiveLink(item.href)))
      ?.title ?? sections[0]?.title;
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const isOpen = (title: string) => openMap[title] ?? title === currentSection;

  return (
    <div className="mt-4 text-sm">
      {sections.map((section) => (
        <div className="flex flex-col gap-1" key={section.title}>
          <span className="max-md:hidden md:hidden lg:block text-blue-500 font-semibold my-3 uppercase tracking-[0.18em] text-[10px] dark:text-blue-400">
            {section.title}
          </span>
          <button
            type="button"
            aria-expanded={isOpen(section.title)}
            onClick={() => setOpenMap((prev) => ({ ...prev, [section.title]: !isOpen(section.title) }))}
            className="flex min-h-11 w-full items-center justify-between rounded-xl px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-500 active:bg-blue-50/60 md:hidden dark:text-blue-400 dark:active:bg-slate-800/60"
          >
            <span>{section.title}</span>
            <span className="flex items-center gap-2 normal-case tracking-normal">
              <span className="text-xs font-medium text-blue-400">{section.items.length}</span>
              <ChevronDown
                size={16}
                aria-hidden="true"
                className={`transition-transform duration-200 ${isOpen(section.title) ? "rotate-180" : ""}`}
              />
            </span>
          </button>
          <div className={`flex flex-col gap-1 ${isOpen(section.title) ? "" : "max-md:hidden"}`}>
          {section.items.map((item) => {

            const active = isActiveLink(item.href);

            return (
              <button
                type="button"
                key={item.label}
                onClick={() => {
                  router.push(item.href);
                  close();
                }}
                className={`glass-nav-item ${active ? "is-active" : ""} flex w-full items-center justify-start md:justify-center lg:justify-start gap-4 rounded-xl px-2 py-2.5 transition-all shine-hover ${
                  active
                    ? "bg-gradient-to-r from-blue-100 to-yellow-100 text-blue-900 shadow-md dark:from-blue-950/70 dark:to-yellow-950/40 dark:text-blue-100"
                    : "text-blue-700 hover:bg-gradient-to-r hover:from-blue-50 hover:to-yellow-50 hover:text-blue-900 dark:text-blue-300 dark:hover:from-blue-950/50 dark:hover:to-yellow-950/30 dark:hover:text-blue-100"
                }`}
              >
                <div className={`glass-nav-icon flex h-8 w-8 items-center justify-center rounded-full ${active ? "bg-white/90 border border-blue-200 dark:bg-slate-900/80 dark:border-blue-800" : "bg-blue-50 border border-blue-100 dark:bg-slate-900/60 dark:border-slate-800"}`}>
                  <Image src={item.icon} alt="" width={18} height={18} />
                </div>
                <span className="block md:hidden lg:block font-medium">{item.label}</span>
              </button>
            );
          })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default MenuContent;
