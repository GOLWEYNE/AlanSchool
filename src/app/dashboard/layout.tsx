import Menu from "@/components/Menu";
import Navbar from "@/components/Navbar";
import Image from "next/image";
import Link from "next/link";
import { MobileSidebarProvider } from "@/context/MobileSidebarContext";
import SidebarShell from "@/components/SidebarShell";
import CommandPalette from "@/components/CommandPalette";
import { auth } from "@clerk/nextjs/server";
import { getUserRole } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { sessionClaims } = auth();
  const role = getUserRole(sessionClaims);
  // Mirrors the same admin/teacher scoping as the search API and its Navbar
  // trigger, so the shortcut doesn't open a palette that can't return anything.
  const canSearch = role === "admin" || role === "teacher";

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
        </div>
      </div>
      {canSearch && <CommandPalette />}
    </MobileSidebarProvider>
  );
}
