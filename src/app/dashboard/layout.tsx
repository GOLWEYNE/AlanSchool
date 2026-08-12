import Menu from "@/components/Menu";
import Navbar from "@/components/Navbar";
import Image from "next/image";
import Link from "next/link";
import { MobileSidebarProvider } from "@/context/MobileSidebarContext";
import SidebarShell from "@/components/SidebarShell";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
    </MobileSidebarProvider>
  );
}
