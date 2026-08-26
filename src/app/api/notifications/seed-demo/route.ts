import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserRole } from "@/lib/auth";
import prisma from "@/lib/prisma";

// Dev/demo helper: lets an admin populate their own account with one
// sample unread Message, one sample open Ticket, and (when a
// student/parent pair exists) one sample pending PermissionSlip
// response, so the navbar notification bell (see
// components/NotificationBell.tsx) has something real to show while
// the school doesn't yet have live messaging, ticketing, or
// permission-slip UI wired up. Admin-only. Safe to call more than
// once - each call just adds another sample notification.
export const dynamic = "force-dynamic";

export async function POST() {
  const { userId, sessionClaims } = auth();
  const role = getUserRole(sessionClaims);

  if (!userId || !role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (role !== "admin") {
    return NextResponse.json(
      { error: "Only admins can seed demo notifications" },
      { status: 403 }
    );
  }

  const message = await prisma.message.create({
    data: {
      senderId: "system",
      senderRole: "admin",
      receiverId: userId,
      receiverRole: role,
      content:
        "Welcome! This is a sample message so you can see how the notification bell looks with unread messages.",
    },
  });

  const ticket = await prisma.ticket.create({
    data: {
      title: "Sample support ticket",
      description:
        "This is a placeholder ticket created to preview the notification bell's ticket updates.",
      category: "OTHER",
      status: "OPEN",
      priority: "MEDIUM",
      createdById: userId,
      createdByRole: role,
    },
  });

  let slip: { id: number } | null = null;
  const student = await prisma.student.findFirst({
    select: { id: true, parentId: true },
  });

  if (student) {
    const createdSlip = await prisma.permissionSlip.create({
      data: {
        title: "Sample field trip permission slip",
        description:
          "This is a placeholder permission slip created to preview the notification bell's slip updates.",
        eventDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdById: userId,
      },
    });

    await prisma.permissionResponse.create({
      data: {
        permissionSlipId: createdSlip.id,
        studentId: student.id,
        parentId: student.parentId,
        status: "PENDING",
      },
    });

    slip = createdSlip;
  }

  return NextResponse.json({
    ok: true,
    created: {
      message: message.id,
      ticket: ticket.id,
      slip: slip ? slip.id : null,
    },
  });
}
