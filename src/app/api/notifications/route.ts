import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserRole } from "@/lib/auth";
import prisma from "@/lib/prisma";

// Powers the navbar notification bell: unread messages, ticket updates,
// and permission slip updates relevant to whoever is signed in. Polled
// from the client every 30s (see components/NotificationBell.tsx) since
// the project has no websocket/push infrastructure yet.
export const dynamic = "force-dynamic";

type SlipNotification = {
  id: number;
  title: string;
  eventDate: Date | null;
  createdAt: Date;
  pendingCount: number | null;
};

export async function GET() {
  const { userId, sessionClaims } = auth();
  const role = getUserRole(sessionClaims);

  if (!userId || !role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isStaff = role === "admin" || role === "teacher";

  const messagesQuery = prisma.message.findMany({
    where: { receiverId: userId, readAt: null },
    select: {
      id: true,
      senderRole: true,
      content: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  // Staff see open work: tickets a teacher is assigned to (or unassigned
  // ones anyone could pick up), or every open ticket for admin. Everyone
  // else sees the live status of tickets they personally raised.
  const ticketsQuery = prisma.ticket.findMany({
    where: isStaff
      ? {
          status: { in: ["OPEN", "IN_PROGRESS"] },
          ...(role === "teacher"
            ? { OR: [{ assignedToId: userId }, { assignedToId: null }] }
            : {}),
        }
      : { createdById: userId, status: { not: "CLOSED" } },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 10,
  });

  // Parents see permission slips still awaiting their signature; staff
  // who authored a slip see how many responses are still outstanding.
  let slipsQuery;
  if (role === "parent") {
    slipsQuery = prisma.permissionResponse
      .findMany({
        where: { parentId: userId, status: "PENDING" },
        select: {
          id: true,
          createdAt: true,
          permissionSlip: { select: { title: true, eventDate: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      })
      .then((rows) =>
        rows.map((r) => ({
          id: r.id,
          title: r.permissionSlip.title,
          eventDate: r.permissionSlip.eventDate,
          createdAt: r.createdAt,
          pendingCount: null,
        }))
      );
  } else if (isStaff) {
    slipsQuery = prisma.permissionSlip
      .findMany({
        where: { createdById: userId },
        select: {
          id: true,
          title: true,
          eventDate: true,
          createdAt: true,
          _count: { select: { responses: { where: { status: "PENDING" } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      })
      .then((rows) =>
        rows
          .filter((r) => r._count.responses > 0)
          .map((r) => ({
            id: r.id,
            title: r.title,
            eventDate: r.eventDate,
            createdAt: r.createdAt,
            pendingCount: r._count.responses,
          }))
      );
  } else {
    slipsQuery = Promise.resolve([]);
  }

  const [messages, tickets, slips] = await Promise.all([
    messagesQuery,
    ticketsQuery,
    slipsQuery,
  ]);

  return NextResponse.json({
    counts: {
      messages: messages.length,
      tickets: tickets.length,
      slips: slips.length,
    },
    messages,
    tickets,
    slips,
  });
}

