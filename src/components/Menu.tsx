import { auth, currentUser } from "@clerk/nextjs/server";
import { getTranslations } from "next-intl/server";
import MenuContent from "./MenuContent";
import { getUserRole } from "@/lib/auth";

const getMenuItems = (t: Awaited<ReturnType<typeof getTranslations>>) => [
  {
    title: t("menuTitle"),
    items: [
      {
        icon: "/home.png",
        label: t("home"),
        href: "/dashboard",
        visible: ["admin", "teacher", "student", "parent"],
      },
      {
        icon: "/teacher.png",
        label: t("teachers"),
        href: "/dashboard/list/teachers",
        visible: ["admin", "teacher"],
      },
      {
        icon: "/student.png",
        label: t("students"),
        href: "/dashboard/list/students",
        visible: ["admin", "teacher"],
      },
      {
        icon: "/parent.png",
        label: t("parents"),
        href: "/dashboard/list/parents",
        visible: ["admin", "teacher"],
      },
      {
        icon: "/subject.png",
        label: t("subjects"),
        href: "/dashboard/list/subjects",
        visible: ["admin"],
      },
      {
        icon: "/class.png",
        label: t("classes"),
        href: "/dashboard/list/classes",
        visible: ["admin", "teacher"],
      },
      {
        icon: "/lesson.png",
        label: t("lessons"),
        href: "/dashboard/list/lessons",
        visible: ["admin", "teacher"],
      },
      {
        icon: "/exam.png",
        label: t("exams"),
        href: "/dashboard/list/exams",
        visible: ["admin", "teacher", "student", "parent"],
      },
      {
        icon: "/assignment.png",
        label: t("assignments"),
        href: "/dashboard/list/assignments",
        visible: ["admin", "teacher", "student"],
      },
      {
        icon: "/result.png",
        label: t("results"),
        href: "/dashboard/list/results",
        visible: ["admin", "teacher", "student", "parent"],
      },
      {
        icon: "/attendance.png",
        label: t("attendance"),
        href: "/dashboard/list/students",
        visible: ["admin", "teacher", "student"],
      },
      {
        icon: "/calendar.png",
        label: t("events"),
        href: "/dashboard/list/events",
        visible: ["admin", "teacher", "student", "parent"],
      },
      {
        icon: "/message.png",
        label: t("messages"),
        href: "/dashboard/list/announcements",
        visible: ["admin", "teacher", "student"],
      },
      {
        icon: "/announcement.png",
        label: t("announcements"),
        href: "/dashboard/list/announcements",
        visible: ["admin", "teacher", "student"],
      },
      {
        icon: "/result.png",
        label: t("reportCards"),
        href: "/dashboard/list/report-cards",
        visible: ["admin", "teacher"],
      },
    ],
  },
  {
    title: t("otherTitle"),
    items: [
      {
        icon: "/profile.png",
        label: t("profile"),
        href: "/dashboard/profile",
        visible: ["admin", "teacher", "student", "parent"],
      },
      {
        icon: "/setting.png",
        label: t("settings"),
        href: "/dashboard/settings",
        visible: ["admin", "teacher", "student", "parent"],
      },
      {
        icon: "/logout.png",
        label: t("logout"),
        href: "/dashboard/logout",
        visible: ["admin", "teacher", "student", "parent"],
      },
    ],
  },
];

const Menu = async () => {
  const user = await currentUser();
  const { sessionClaims } = auth();
  const t = await getTranslations("Menu");

  const role = getUserRole(
    sessionClaims as { role?: string; metadata?: { role?: string }; publicMetadata?: { role?: string } },
    ((user?.publicMetadata as { role?: string } | undefined)?.role ?? "") as string
  );

  return <MenuContent items={getMenuItems(t)} role={role} />;
};

export default Menu;
