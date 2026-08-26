"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { markMessageRead } from "@/lib/masterModuleActions";

type MessageItem = {
  id: number;
  senderRole: string;
  content: string;
  createdAt: string;
};

type TicketItem = {
  id: number;
  title: string;
  status: string;
  priority: string;
  updatedAt: string;
};

type SlipItem = {
  id: number;
  title: string;
  eventDate: string | null;
  createdAt: string;
  pendingCount: number | null;
};

type NotificationsResponse = {
  counts: { messages: number; tickets: number; slips: number };
  messages: MessageItem[];
  tickets: TicketItem[];
  slips: SlipItem[];
};

const EMPTY: NotificationsResponse = {
  counts: { messages: 0, tickets: 0, slips: 0 },
  messages: [],
  tickets: [],
  slips: [],
};

// No websocket/push infrastructure exists yet, so "live" means polling
// this often — cheap enough for a school-sized dashboard.
const POLL_MS = 30000;
const NOOP_STATE = { success: false, error: false };

// Single navbar bell aggregating the three things worth interrupting a
// user for: unread direct messages, ticket status changes, and
// permission slips needing attention.
const NotificationBell = () => {
  const t = useTranslations("Navbar");
  const [data, setData] = useState<NotificationsResponse>(EMPTY);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as NotificationsResponse;
      setData(json);
    } catch {
      // A missed poll isn't worth surfacing — just keep the last known state.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const total = data.counts.messages + data.counts.tickets + data.counts.slips;

  const dismissMessage = async (id: number) => {
    setData((prev) => ({
      ...prev,
      messages: prev.messages.filter((m) => m.id !== id),
      counts: { ...prev.counts, messages: Math.max(0, prev.counts.messages - 1) },
    }));
    try {
      const formData = new FormData();
      formData.set("id", String(id));
      await markMessageRead(NOOP_STATE, formData);
    } catch {
      // Best-effort — the next poll reconciles if this failed.
    }
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="circle-icon-btn cursor-pointer relative"
        aria-label={t("notifications")}
        title={t("notifications")}
      >
        <Image src="/announcement.png" alt="" width={20} height={20} />
        {total > 0 && (
          <div className="absolute -top-3 -right-3 min-w-5 h-5 px-1 flex items-center justify-center bg-blue-600 text-white rounded-full text-xs">
            {total > 9 ? "9+" : total}
          </div>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white border border-blue-200 rounded-md shadow-lg py-2 z-50 dark:bg-slate-900 dark:border-slate-700">
          <div className="px-3 pb-2 mb-1 border-b border-blue-100 dark:border-slate-700 flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-900 dark:text-blue-100">
              {t("notifications")}
            </span>
            {loading && (
              <span className="text-[10px] text-blue-400 dark:text-blue-500">{t("loading")}</span>
            )}
          </div>

          {total === 0 && !loading && (
            <p className="px-3 py-4 text-xs text-center text-blue-400 dark:text-blue-300">
              {t("noNotifications")}
            </p>
          )}

          {data.messages.length > 0 && (
            <div className="mb-1">
              <p className="px-3 py-1 text-[10px] font-semibold uppercase text-blue-400 dark:text-blue-500">
                {t("newMessages")}
              </p>
              {data.messages.map((m) => (
                <button
                  key={`msg-${m.id}`}
                  type="button"
                  onClick={() => dismissMessage(m.id)}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-950/60"
                >
                  <p className="text-xs text-blue-900 dark:text-blue-100 truncate">{m.content}</p>
                  <p className="text-[10px] text-blue-400 dark:text-blue-500">
                    {new Date(m.createdAt).toLocaleString()}
                  </p>
                </button>
              ))}
            </div>
          )}

          {data.tickets.length > 0 && (
            <div className="mb-1">
              <p className="px-3 py-1 text-[10px] font-semibold uppercase text-blue-400 dark:text-blue-500">
                {t("ticketUpdates")}
              </p>
              {data.tickets.map((tk) => (
                <Link
                  key={`ticket-${tk.id}`}
                  href={`/dashboard/list/tickets/${tk.id}`}
                  onClick={() => setOpen(false)}
                  className="block px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-950/60"
                >
                  <p className="text-xs text-blue-900 dark:text-blue-100 truncate">{tk.title}</p>
                  <p className="text-[10px] text-blue-400 dark:text-blue-500 capitalize">
                    {tk.status.toLowerCase().replace("_", " ")} · {tk.priority.toLowerCase()}
                  </p>
                </Link>
              ))}
            </div>
          )}

          {data.slips.length > 0 && (
            <div>
              <p className="px-3 py-1 text-[10px] font-semibold uppercase text-blue-400 dark:text-blue-500">
                {t("slipUpdates")}
              </p>
              {data.slips.map((s) => (
                <Link
                  key={`slip-${s.id}`}
                  href="/dashboard/parent"
                  onClick={() => setOpen(false)}
                  className="block px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-950/60"
                >
                  <p className="text-xs text-blue-900 dark:text-blue-100 truncate">{s.title}</p>
                  <p className="text-[10px] text-blue-400 dark:text-blue-500">
                    {s.pendingCount != null
                      ? t("pendingResponses", { count: s.pendingCount })
                      : t("awaitingYourResponse")}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;

