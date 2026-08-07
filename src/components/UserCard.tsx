import prisma from "@/lib/prisma";
import Image from "next/image";
import Link from "next/link";

const UserCard = async ({
  type,
}: {
  type: "admin" | "teacher" | "student" | "parent";
}) => {
  const modelMap: Record<typeof type, any> = {
    admin: prisma.admin,
    teacher: prisma.teacher,
    student: prisma.student,
    parent: prisma.parent,
  };

  const data = await modelMap[type].count();
  const config = {
    admin: { label: "Admins", href: "/dashboard/admin" },
    teacher: { label: "Teachers", href: "/dashboard/list/teachers" },
    student: { label: "Students", href: "/dashboard/list/students" },
    parent: { label: "Parents", href: "/dashboard/list/parents" },
  };

  const { label, href } = config[type];

  return (
    <Link
      href={href}
      className="rounded-2xl p-4 flex-1 min-w-[140px] shadow-sm border border-white/40 hover:-translate-y-1 hover:shadow-md transition-all shine-hover bg-gradient-to-br from-blue-500 via-blue-400 to-yellow-300 text-white"
    >
      <div className="flex justify-between items-center">
        <span className="text-[10px] bg-white/90 px-2 py-1 rounded-full text-blue-700 font-semibold">
          2024/25
        </span>
        <Image src="/more.png" alt="" width={20} height={20} />
      </div>
      <h1 className="text-2xl font-semibold my-4">{data}</h1>
      <h2 className="text-sm font-medium text-white/95">{label}</h2>
    </Link>
  );
};

export default UserCard;