import PageHero from "@/components/PageHero";
import TableSearch from "@/components/TableSearch";
import TicketBoard, { BoardTicket, StudentOption } from "@/components/TicketBoard";
import prisma from "@/lib/prisma";
import { getUserRole } from "@/lib/auth";
import { Prisma, TicketCategory } from "@/generated/prisma/client";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";

const CATEGORY_TABS: { key: TicketCategory | "ALL"; label: string }[] = [
  { key: "LOST_ITEM", label: "Lost & Found" },
  { key: "TECHNICAL", label: "Technical" },
  { key: "ACADEMIC", label: "Academic" },
  { key: "OTHER", label: "Other" },
  { key: "ALL", label: "All tickets" },
];

const isTicketCategory = (value: string | undefined): value is TicketCategory =>
  !!value && ["TECHNICAL", "LOST_ITEM", "ACADEMIC", "OTHER"].includes(value);

const TicketsBoardPage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {
  const { userId, sessionClaims } = auth();
  const role = getUserRole(sessionClaims);
  const canManage = role === "admin" || role === "teacher";

  // Students and parents only ever see the Lost & Found board — the other
  // ticket categories are internal staff/support tickets that may reference
  // other students, so they stay admin/teacher-only regardless of the
  // ?category= query param.
  const requestedCategory = searchParams.category;
  const category: TicketCategory | "ALL" = canManage
    ? requestedCategory === "ALL"
      ? "ALL"
      : isTicketCategory(requestedCategory)
      ? requestedCategory
      : "LOST_ITEM"
    : "LOST_ITEM";

  const search = searchParams.search?.trim();

  const where: Prisma.TicketWhereInput = {
    ...(category !== "ALL" ? { category } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [tickets, totalCount, openCount, resolvedCount] = await prisma.$transaction([
    prisma.ticket.findMany({
      where,
      include: {
        student: { select: { id: true, name: true, surname: true } },
        _count: { select: { comments: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.ticket.count({ where }),
    prisma.ticket.count({ where: { ...where, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    prisma.ticket.count({ where: { ...where, status: "RESOLVED" } }),
  ]);

  const boardTickets: BoardTicket[] = tickets.map((t: (typeof tickets)[number]) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    category: t.category,
    status: t.status,
    priority: t.priority,
    createdAt: t.createdAt.toISOString(),
    resolvedAt: t.resolvedAt ? t.resolvedAt.toISOString() : null,
    student: t.student,
    commentCount: t._count.comments,
  }));

  let students: StudentOption[] | undefined;
  let selfStudentId: string | undefined;

  if (role === "student") {
    selfStudentId = userId ?? undefined;
  } else if (role === "parent" && userId) {
    students = await prisma.student.findMany({
      where: { parentId: userId },
      select: { id: true, name: true, surname: true },
      orderBy: { name: "asc" },
    });
  } else if (canManage) {
    students = await prisma.student.findMany({
      select: { id: true, name: true, surname: true },
      orderBy: { name: "asc" },
    });
  }

  return (
    <div className="panel-card p-4 md:p-5 flex-1 m-4 mt-0 shine-hover">
      <PageHero
        title="Lost & Found Board"
        subtitle="Report a lost item, post something you found, and track it through to being claimed."
        emoji="🧭"
        stats={[
          { label: "On the board", value: totalCount },
          { label: "Still searching", value: openCount },
          { label: "Claimed", value: resolvedCount },
        ]}
      />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            {CATEGORY_TABS.map((tab) => (
              <Link
                key={tab.key}
                href={`/dashboard/list/tickets?category=${tab.key}`}
                className={`toolbar-chip text-xs font-semibold px-3 py-1.5 ${
                  category === tab.key ? "ring-2 ring-blue-400" : ""
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        ) : (
          <h1 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
            Lost &amp; Found
          </h1>
        )}
        <TableSearch />
      </div>

      <div className="mt-4">
        <TicketBoard
          tickets={boardTickets}
          role={role}
          canManage={canManage}
          students={students}
          selfStudentId={selfStudentId}
        />
      </div>
    </div>
  );
};

export default TicketsBoardPage;
