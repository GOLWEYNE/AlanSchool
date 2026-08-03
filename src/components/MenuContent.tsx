"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";

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
          <span className="hidden lg:block text-gray-400 font-light my-3 uppercase tracking-wide text-[11px]">
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
                onClick={() => router.push(item.href)}
                className={`flex w-full items-center justify-center lg:justify-start gap-4 rounded-lg px-2 py-2.5 transition-all ${
                  active
                    ? "bg-[#E9F2FF] text-[#2D4D9A] shadow-sm"
                    : "text-gray-600 hover:bg-lamaSkyLight hover:text-gray-800"
                }`}
              >
                <div className={`flex h-8 w-8 items-center justify-center rounded-full ${active ? "bg-[#DDEBFF]" : "bg-gray-100"}`}>
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
