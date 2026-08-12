"use client";

import Image from "next/image";
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
      return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <div className="mt-4 text-sm">
      {items.map((section) => (
        <div className="flex flex-col gap-1" key={section.title}>
          <span className="hidden lg:block text-blue-500 font-semibold my-3 uppercase tracking-[0.18em] text-[10px]">
            {section.title}
          </span>
          {section.items.map((item) => {
            if (!item.visible.includes(role)) {
              return null;
            }

            const active = isActiveLink(item.href);

            return (
              <button
                type="button"
                key={item.label}
                onClick={() => {
                  router.push(item.href);
                  close();
                }}
                className={`flex w-full items-center justify-center lg:justify-start gap-4 rounded-xl px-2 py-2.5 transition-all shine-hover ${
                  active
                    ? "bg-gradient-to-r from-blue-100 to-yellow-100 text-blue-900 shadow-md"
                    : "text-blue-700 hover:bg-gradient-to-r hover:from-blue-50 hover:to-yellow-50 hover:text-blue-900"
                }`}
              >
                <div className={`flex h-8 w-8 items-center justify-center rounded-full ${active ? "bg-white/90 border border-blue-200" : "bg-blue-50 border border-blue-100"}`}>
                  <Image src={item.icon} alt="" width={18} height={18} />
                </div>
                <span className="hidden lg:block font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default MenuContent;
