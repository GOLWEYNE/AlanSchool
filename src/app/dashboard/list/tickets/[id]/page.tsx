import prisma from "@/lib/prisma";
import { getUserRole } from "@/lib/auth";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound } from "next/navigation";

const statusStyles: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-800 border-blue-200",
  IN_PROGRESS: "bg-amber-100 text-amber-800 border-amber-200",
  RESOLVED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  CLOSED: "bg-gray-100 text-gray-700 border-gray-200",
};

const priorityStyles: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-700 border-gray-200",
  MEDIUM: "bg-blue-100 text-blue-800 border-blue-200",
  HIGH: "bg-orange-100 text-orange-800 border-orange-200",
  URGENT: "bg-red-100 text-red-800 border-red-200",
};

const SingleTicketPage = async ({
  params: { id },
}: {
  params: { id: string };
}) => {
  const { sessionClaims } = auth();
  const role = getUserRole(sessionClaims);

  const ticketId = parseInt(id, 10);
  if (Number.isNaN(ticketId)) {
    return notFound();
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      student: { select: { id: true, name: true, surname: true } },
      comments: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!ticket) {
    return notFound();
  }

  return (
    <div className="flex-1 p-4 flex flex-col gap-4">
      <div className="panel-card p-5 md:p-6 shine-hover">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-blue-500 font-semibold mb-1">
              Ticket #{ticket.id}
            </p>
            <h1 className="text-xl md:text-2xl font-bold text-blue-900">{ticket.title}</h1>
            {ticket.student && (
              <Link
                href={`/dashboard/list/students/${ticket.student.id}`}
                className="text-sm text-blue-600 hover:underline mt-1 inline-block"
              >
                {ticket.student.name} {ticket.student.surname}
              </Link>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <span
              className={`text-xs font-semibold px-3 py-1 rounded-full border ${
                statusStyles[ticket.status] ?? statusStyles.OPEN
              }`}
            >
              {ticket.status.replace("_", " ")}
            </span>
            <span
              className={`text-xs font-semibold px-3 py-1 rounded-full border ${
                priorityStyles[ticket.priority] ?? priorityStyles.MEDIUM
              }`}
            >
              {ticket.priority}
            </span>
            <span className="text-xs font-semibold px-3 py-1 rounded-full border bg-white text-blue-700 border-blue-200">
              {ticket.category.replace("_", " ")}
            </span>
          </div>
        </div>
        <p className="text-sm text-gray-700 mt-4 whitespace-pre-wrap">{ticket.description}</p>
        <p className="text-xs text-gray-400 mt-4">
          Opened {ticket.createdAt.toLocaleString()}
          {ticket.resolvedAt ? ` · Resolved ${ticket.resolvedAt.toLocaleString()}` : ""}
        </p>
      </div>

      <div className="panel-card p-5 md:p-6">
        <h2 className="text-sm font-semibold text-blue-900 mb-3">
          Comments ({ticket.comments.length})
        </h2>
        {ticket.comments.length === 0 ? (
          <p className="text-sm text-gray-400">No comments yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {ticket.comments.map((comment) => (
              <li
                key={comment.id}
                className="border border-blue-100 rounded-xl px-4 py-3 bg-blue-50/40"
              >
                <div className="flex items-center justify-between text-xs text-blue-500 mb-1">
                  <span className="font-semibold capitalize">{comment.authorRole}</span>
                  <span>{comment.createdAt.toLocaleString()}</span>
                </div>
                <p className="text-sm text-gray-700">{comment.message}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default SingleTicketPage;
