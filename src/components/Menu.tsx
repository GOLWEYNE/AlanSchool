import { auth, currentUser } from "@clerk/nextjs/server";
import { getTranslations } from "next-intl/server";
import MenuContent from "./MenuContent";
import { getUserRole } from "@/lib/auth";

const getMenuItems = (t: Awaited<ReturnType<typeof getTranslations>>, role: string) => {
  const baseItems = [
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
          icon: "/subject.png",
          label: t("clubs"),
          href: "/dashboard/list/clubs",
          visible: ["admin", "teacher", "student", "parent"],
        },
        {
          icon: "/lesson.png",
          label: t("lessons"),
          href: "/dashboard/list/lessons",
          visible: ["admin", "teacher"],
        },
      ],
    },
    {
      title: "Assessments",
      items: [
        {
          icon: "/exam.png",
          label: "Assessment Hub",
          href: "/dashboard/list/assessment-hub",
          visible: ["teacher"],
        },
        {
          icon: "/exam.png",
          label: "Quizzes",
          href: "/dashboard/list/quizzes",
          visible: ["teacher"],
        },
        {
          icon: "/exam.png",
          label: "Exams",
          href: "/dashboard/list/exam-management",
          visible: ["teacher"],
        },
        {
          icon: "/assignment.png",
          label: "Assignments",
          href: "/dashboard/list/assignment-management",
          visible: ["teacher"],
        },
        {
          icon: "/assignment.png",
          label: "Submissions",
          href: "/dashboard/list/student-work",
          visible: ["teacher"],
        },
        {
          icon: "/exam.png",
          label: t("exams"),
          href: "/dashboard/list/exams",
          visible: ["admin", "student", "parent"],
        },
        {
          icon: "/assignment.png",
          label: t("assignments"),
          href: "/dashboard/list/assignments",
          visible: ["admin", "student"],
        },
      ],
    },
    {
      title: "Academics",
      items: [
        {
          icon: "/result.png",
          label: t("results"),
          href: "/dashboard/list/results",
          visible: ["admin", "teacher", "student", "parent"],
        },
        {
          icon: "/attendance.png",
          label: t("attendance"),
          href: "/dashboard/list/attendance",
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
      title: "Communications",
      items: [
        {
          icon: "/calendar.png",
          label: t("events"),
          href: "/dashboard/list/events",
          visible: ["admin", "teacher", "student", "parent"],
        },
        {
          icon: "/message.png",
          label: t("messages"),
          href: "/dashboard/list/messages",
          visible: ["admin", "teacher", "student", "parent"],
        },
        {
          icon: "/announcement.png",
          label: t("announcements"),
          href: "/dashboard/list/announcements",
          visible: ["admin", "teacher", "student"],
        },
      ],
    },
    {
      title: "Resources",
      items: [
        {
          icon: "/search.png",
          label: t("lostFound"),
          href: "/dashboard/list/tickets",
          visible: ["admin", "teacher", "student", "parent"],
        },
        {
          icon: "/announcement.png",
          label: t("featuredVideo"),
          href: "/dashboard/list/featured-video",
          visible: ["admin", "teacher", "student", "parent"],
        },
      ],
    },
  ];

  return baseItems
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => item.visible.includes(role)),
    }))
    .filter((section) => section.items.length > 0);
};

const Menu = async () => {
  const { sessionClaims } = await auth();
  const role = getUserRole(sessionClaims);
  const t = await getTranslations();
  const menuItems = getMenuItems(t, role);

  return <MenuContent items={menuItems} role={role} />;
};

export default Menu;
