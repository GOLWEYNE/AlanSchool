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
    admin: { label: "Admins", href: "/admin" },
    teacher: { label: "Teachers", href: "/list/teachers" },
    student: { label: "Students", href: "/list/students" },
    parent: { label: "Parents", href: "/list/parents" },
  };

  const { label, href } = config[type];

  return (
    <Link
      href={href}
      className="rounded-2xl p-4 flex-1 min-w-[140px] shadow-sm border border-white/40 hover:-translate-y-1 hover:shadow-md transition-all odd:bg-lamaPurple even:bg-lamaYellow"
    >
      <div className="flex justify-between items-center">
        <span className="text-[10px] bg-white px-2 py-1 rounded-full text-green-600">
          2024/25
        </span>
        <Image src="/more.png" alt="" width={20} height={20} />
      </div>
      <h1 className="text-2xl font-semibold my-4">{data}</h1>
      <h2 className="text-sm font-medium text-gray-700">{label}</h2>
    </Link>
  );
};

export default UserCard;