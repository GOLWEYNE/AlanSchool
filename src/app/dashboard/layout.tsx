import Menu from "@/components/Menu";
import Navbar from "@/components/Navbar";
import Image from "next/image";
import Link from "next/link";
import { MobileSidebarProvider } from "@/context/MobileSidebarContext";
import SidebarShell from "@/components/SidebarShell";
import CommandPalette from "@/components/CommandPalette";
import { auth } from "@clerk/nextjs/server";
import { getUserRole } from "@/lib/auth";
import { redirect } from "next/navigation";
import { teacherNeedsProfile } from "@/lib/teacherProfile";
import MobileTabBar, { type Tab } from "@/components/MobileTabBar";
import { getTranslations } from "next-intl/server";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { userId, sessionClaims } = auth();
  const role = getUserRole(sessionClaims);

  // Teachers must complete their profile (photo + position) before using the
  // dashboard. The form lives outside this layout so it can't loop.
  if (role === "teacher" && userId && (await teacherNeedsProfile(userId))) {
    redirect("/complete-profile");
  }
  // Mirrors the same admin/teacher scoping as the search API and its Navbar
  // trigger, so the shortcut doesn't open a palette that can't return anything.
  const canSearch = role === "admin" || role === "teacher";

  // Phone bottom tab bar: four shortcuts per role plus "More" (the full menu).
  const tm = await getTranslations("Menu");
  const tabsByRole: Record<string, Tab[]> = {
    admin: [
      { icon: "home", label: tm("home"), href: "/dashboard" },
      { icon: "students", label: tm("students"), href: "/dashboard/list/students" },
      { icon: "classes", label: tm("classes"), href: "/dashboard/list/classes" },
      { icon: "inbox", label: tm("messages"), href: "/dashboard/list/messages" },
    ],
    teacher: [
      { icon: "home", label: tm("home"), href: "/dashboard" },
      { icon: "myClass", label: tm("myClass"), href: "/dashboard/list/my-class" },
      { icon: "lessons", label: tm("lessons"), href: "/dashboard/list/lessons" },
      { icon: "inbox", label: tm("messages"), href: "/dashboard/list/messages" },
    ],
    student: [
      { icon: "home", label: tm("home"), href: "/dashboard" },
      { icon: "assignments", label: tm("assignments"), href: "/dashboard/list/assignments" },
      { icon: "results", label: tm("results"), href: "/dashboard/list/results" },
      { icon: "inbox", label: tm("messages"), href: "/dashboard/list/messages" },
    ],
    parent: [
      { icon: "home", label: tm("home"), href: "/dashboard" },
      { icon: "results", label: tm("results"), href: "/dashboard/list/results" },
      { icon: "events", label: tm("events"), href: "/dashboard/list/events" },
      { icon: "inbox", label: tm("messages"), href: "/dashboard/list/messages" },
    ],
  };
  const tabs = tabsByRole[role ?? ""];

  return (
    <MobileSidebarProvider>
      <div className="h-screen flex app-shell-bg">
        {/* LEFT */}
        <SidebarShell>
          <Link
            href="/"
            className="flex items-center justify-center lg:justify-start gap-2 pb-2 shrink-0"
          >
            <Image src="/Alan.png" alt="logo" width={32} height={32} />
            <span className="hidden lg:block font-bold text-blue-900">AlanSchool</span>
          </Link>
          <div className="flex-1 overflow-y-auto pr-1">
            <Menu />
          </div>
        </SidebarShell>
        {/* RIGHT */}
        <div className="w-full md:w-[92%] lg:w-[84%] xl:w-[86%] overflow-scroll flex flex-col">
          <Navbar />
          {children}
          {/* keeps the last card clear of the phone tab bar */}
          {tabs && <div aria-hidden="true" className="h-24 shrink-0 md:hidden" />}
        </div>
      </div>
      {tabs && <MobileTabBar tabs={[...tabs, { icon: "more", label: tm("more") }]} menuLabel={tm("menuTitle")} />}
      {canSearch && <CommandPalette />}
    </MobileSidebarProvider>
  );
}
