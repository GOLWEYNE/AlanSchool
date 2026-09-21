"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useFormatter, useTranslations } from "next-intl";
import { updateTicketStatus } from "@/lib/masterModuleActions";

const FormLoading = () => {
  const t = useTranslations("Tickets.board");
  return <p className="p-4 text-sm text-gray-400">{t("loadingForm")}</p>;
};

const TicketForm = dynamic(() => import("./forms/TicketForm"), {
  loading: () => <FormLoading />,
});

export type StudentOption = { id: string; name: string; surname: string };

export type BoardTicket = {
  id: number;
  title: string;
  description: string;
  category: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  createdAt: string;
  resolvedAt: string | null;
  student: { id: string; name: string; surname: string } | null;
  commentCount: number;
};

// Labels and hints come from the Tickets.board.columns.* messages.
const COLUMN_KEYS: BoardTicket["status"][] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

const COLUMN_ACCENT: Record<BoardTicket["status"], string> = {
  OPEN: "border-t-blue-400",
  IN_PROGRESS: "border-t-amber-400",
  RESOLVED: "border-t-emerald-400",
  CLOSED: "border-t-gray-400",
};

const PRIORITY_STYLES: Record<BoardTicket["priority"], string> = {
  LOW: "bg-gray-100 text-gray-700 border-gray-200",
  MEDIUM: "bg-blue-100 text-blue-800 border-blue-200",
  HIGH: "bg-orange-100 text-orange-800 border-orange-200",
  URGENT: "bg-red-100 text-red-800 border-red-200",
};

// Localised "5m ago" style label; falls back to a locale-formatted date
// after a week.
const useTimeAgo = () => {
  const t = useTranslations("Tickets.board");
  const format = useFormatter();
  return (iso: string) => {
    const diffMs = Date.now() - new Date(iso).getTime();
    const minutes = Math.round(diffMs / 60000);
    if (minutes < 1) return t("justNow");
    if (minutes < 60) return t("minutesAgo", { count: minutes });
    const hours = Math.round(minutes / 60);
    if (hours < 24) return t("hoursAgo", { count: hours });
    const days = Math.round(hours / 24);
    if (days < 7) return t("daysAgo", { count: days });
    return format.dateTime(new Date(iso), { dateStyle: "medium" });
  };
};

// A ticket's title is prefixed "Lost: " / "Found: " by TicketForm so the
// board can show a Lost/Found chip without needing a schema change.
const reportKind = (title: string): "lost" | "found" | null => {
  if (/^found:/i.test(title)) return "found";
  if (/^lost:/i.test(title)) return "lost";
  return null;
};

const stripKindPrefix = (title: string) => title.replace(/^(lost|found):\s*/i, "");

const TicketCard = ({
  ticket,
  canManage,
  canLinkStudent,
}: {
  ticket: BoardTicket;
  canManage: boolean;
  canLinkStudent: boolean;
}) => {
  const t = useTranslations("Tickets");
  const timeAgo = useTimeAgo();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const kind = reportKind(ticket.title);

  const handleStatusChange = (status: BoardTicket["status"]) => {
    startTransition(async () => {
      await updateTicketStatus({ success: false, error: false }, { id: ticket.id, status });
      router.refresh();
    });
  };

  return (
    <div className="panel-card p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {kind && (
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${
                kind === "found"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {t(`board.kind.${kind}`)}
            </span>
          )}
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${PRIORITY_STYLES[ticket.priority]}`}
          >
            {t(`board.priorities.${ticket.priority}`)}
          </span>
        </div>
        {ticket.category !== "LOST_ITEM" && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 whitespace-nowrap">
            {t.has(`tabs.${ticket.category}`) ? t(`tabs.${ticket.category}`) : ticket.category}
          </span>
        )}
      </div>

      <Link href={`/dashboard/list/tickets/${ticket.id}`} className="block group">
        <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 group-hover:underline">
          {stripKindPrefix(ticket.title)}
        </p>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 line-clamp-2">
          {ticket.description}
        </p>
      </Link>

      <div className="flex items-center justify-between text-[11px] text-gray-400 dark:text-slate-500 mt-1">
        <span>{timeAgo(ticket.createdAt)}</span>
        <div className="flex items-center gap-2">
          {ticket.commentCount > 0 && <span>💬 {ticket.commentCount}</span>}
          {ticket.student &&
            (canLinkStudent ? (
              <Link
                href={`/dashboard/list/students/${ticket.student.id}`}
                className="text-blue-500 hover:underline"
              >
                {ticket.student.name} {ticket.student.surname}
              </Link>
            ) : (
              <span>
                {ticket.student.name} {ticket.student.surname}
              </span>
            ))}
        </div>
      </div>

      {canManage && (
        <select
          value={ticket.status}
          disabled={isPending}
          onChange={(e) => handleStatusChange(e.target.value as BoardTicket["status"])}
          className="mt-1 text-xs ring-[1.5px] ring-gray-200 dark:ring-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-md px-2 py-1 self-start"
        >
          {COLUMN_KEYS.map((key) => (
            <option key={key} value={key}>
              {t("board.moveTo", { status: t(`board.columns.${key}.label`) })}
            </option>
          ))}
        </select>
      )}
    </div>
  );
};

const TicketBoard = ({
  tickets,
  role,
  canManage,
  students,
  selfStudentId,
}: {
  tickets: BoardTicket[];
  role: string;
  canManage: boolean;
  students?: StudentOption[];
  selfStudentId?: string;
}) => {
  const t = useTranslations("Tickets.board");
  const [open, setOpen] = useState(false);

  const grouped = COLUMN_KEYS.map((key) => ({
    key,
    label: t(`columns.${key}.label`),
    hint: t(`columns.${key}.hint`),
    items: tickets.filter((ticket) => ticket.status === key),
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 bg-lamaYellow hover:shadow-lg transition-shadow text-blue-900 font-semibold text-sm px-4 py-2 rounded-full"
        >
          <span className="text-lg leading-none">＋</span> {t("reportItem")}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {grouped.map((col) => (
          <div
            key={col.key}
            className={`flex flex-col gap-3 rounded-xl border-t-4 ${COLUMN_ACCENT[col.key]} bg-slate-50/60 dark:bg-slate-900/40 p-3 min-h-[200px]`}
          >
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-blue-900 dark:text-blue-100">{col.label}</h3>
                <span className="text-xs font-semibold text-gray-400 bg-white dark:bg-slate-800 rounded-full px-2 py-0.5">
                  {col.items.length}
                </span>
              </div>
              <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">{col.hint}</p>
            </div>

            <div className="flex flex-col gap-3">
              {col.items.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-slate-600 italic py-6 text-center">
                  {t("nothingHere")}
                </p>
              ) : (
                col.items.map((ticket) => (
                  <TicketCard
                    key={ticket.id}
                    ticket={ticket}
                    canManage={canManage}
                    canLinkStudent={role === "admin" || role === "teacher"}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {open && (
        <div className="w-screen h-screen fixed left-0 top-0 bg-black bg-opacity-60 z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-md relative w-[90%] md:w-[70%] lg:w-[60%] xl:w-[45%] max-h-[90vh] overflow-y-auto">
            <TicketForm
              setOpen={setOpen}
              role={role}
              students={students}
              selfStudentId={selfStudentId}
            />
            <div
              className="absolute top-4 right-4 cursor-pointer text-gray-400 hover:text-gray-600"
              onClick={() => setOpen(false)}
            >
              ✕
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketBoard;
