import Menu from "@/components/Menu";
import Navbar from "@/components/Navbar";
import Image from "next/image";
import Link from "next/link";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="h-screen flex app-shell-bg">
      {/* LEFT */}
      <div className="w-[14%] md:w-[8%] lg:w-[16%] xl:w-[14%] p-4">
        <div className="panel-card shine-hover h-full p-3 lg:p-4 flex flex-col overflow-hidden">
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
        </div>
      </div>
      {/* RIGHT */}
      <div className="w-[86%] md:w-[92%] lg:w-[84%] xl:w-[86%] overflow-scroll flex flex-col">
        <Navbar />
        {children}
      </div>
    </div>
  );
}