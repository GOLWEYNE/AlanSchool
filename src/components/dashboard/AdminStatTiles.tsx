import prisma from "@/lib/prisma";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { currentSchoolYear } from "@/lib/schoolYear";
import { ArrowUpRight, GraduationCap, HeartHandshake, ShieldCheck, Users } from "lucide-react";
import AnimatedNumber from "./AnimatedNumber";

/**
 * Admin headline numbers (admins / teachers / students / parents) as glass tiles.
 * Same data, links and translation keys as the old UserCard row - only the look
 * changed. Counts are fetched in parallel instead of one after another.
 */
const AdminStatTiles = async () => {
  const t = await getTranslations("Widgets.userCard");
  const [admins, teachers, students, parents] = await Promise.all([
    prisma.admin.count(),
    prisma.teacher.count(),
    prisma.student.count(),
    prisma.parent.count(),
  ]);

  const year = currentSchoolYear();
  const tiles = [
    { key: "admin", label: t("admin"), value: admins, href: "/dashboard/admin", Icon: ShieldCheck, tone: "blue" },
    { key: "teacher", label: t("teacher"), value: teachers, href: "/dashboard/list/teachers", Icon: Users, tone: "gold" },
    { key: "student", label: t("student"), value: students, href: "/dashboard/list/students", Icon: GraduationCap, tone: "blue" },
    { key: "parent", label: t("parent"), value: parents, href: "/dashboard/list/parents", Icon: HeartHandshake, tone: "gold" },
  ] as const;

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
      {tiles.map(({ key, label, value, href, Icon, tone }, i) => (
        <Link
          key={key}
          href={href}
          style={{ ["--i" as string]: i }}
          className="glass glass-rise glass-lift group relative flex flex-col gap-4 p-4 min-w-0"
        >
          <div className="flex items-center justify-between">
            <span className={`glass-icon glass-icon--${tone}`}>
              <Icon size={20} strokeWidth={2.2} />
            </span>
            <span className="glass-chip">{year}</span>
          </div>
          <div className="min-w-0">
            <AnimatedNumber
              value={value}
              className="block text-3xl font-bold tracking-tight text-blue-950 dark:text-blue-50"
            />
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium text-blue-800/80 dark:text-blue-200/80">{label}</span>
              <ArrowUpRight
                size={16}
                className="shrink-0 translate-y-1 opacity-0 transition duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100 text-blue-600 dark:text-yellow-300"
              />
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
};

export default AdminStatTiles;
