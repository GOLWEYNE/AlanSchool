"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Image from "next/image";

type StudentResult = {
  id: string;
  name: string;
  surname: string;
  username: string;
  class: { name: string };
};

type TicketResult = {
  id: number;
  title: string;
  status: string;
  priority: string;
  category: string;
};

type MessageResult = {
  id: number;
  content: string;
  studentId: string | null;
  createdAt: string;
  student: { name: string; surname: string } | null;
};

type SearchResponse = {
  students: StudentResult[];
  tickets: TicketResult[];
  messages: MessageResult[];
};

type FlatResult = {
  key: string;
  group: "students" | "tickets" | "messages";
  primary: string;
  secondary: string;
  href: string;
};

const EMPTY: SearchResponse = { students: [], tickets: [], messages: [] };

// Global ⌘K / Ctrl+K search palette. Opens via the keyboard shortcut from
// anywhere in the dashboard, or via the "open-command-palette" window event
// (dispatched by the Navbar search trigger and the mobile search button).
const CommandPalette = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResponse>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const t = useTranslations("CommandPalette");

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults(EMPTY);
    setActiveIndex(0);
  }, []);

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      const isShortcut = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (isShortcut) {
        e.preventDefault();
        setOpen((prev) => !prev);
        return;
      }
      if (e.key === "Escape" && open) {
        close();
      }
    };
    const handleOpenEvent = () => setOpen(true);

    window.addEventListener("keydown", handleKeydown);
    window.addEventListener("open-command-palette", handleOpenEvent);
    return () => {
      window.removeEventListener("keydown", handleKeydown);
      window.removeEventListener("open-command-palette", handleOpenEvent);
    };
  }, [open, close]);

  useEffect(() => {
    if (open) {
      // Focus after the panel mounts.
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (query.trim().length < 2) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }

    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data: SearchResponse = await res.json();
          setResults(data);
          setActiveIndex(0);
        }
      } catch {
        // Silently ignore — the palette just shows no results.
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(handle);
  }, [query, open]);

  const flatResults: FlatResult[] = [
    ...results.students.map((s) => ({
      key: `student-${s.id}`,
      group: "students" as const,
      primary: `${s.name} ${s.surname}`,
      secondary: `@${s.username} · ${s.class.name}`,
      href: `/dashboard/list/students/${s.id}`,
    })),
    ...results.tickets.map((tk) => ({
      key: `ticket-${tk.id}`,
      group: "tickets" as const,
      primary: tk.title,
      secondary: `${tk.status.replace("_", " ")} · ${tk.priority}`,
      href: `/dashboard/list/tickets/${tk.id}`,
    })),
    ...results.messages.map((m) => ({
      key: `message-${m.id}`,
      group: "messages" as const,
      primary: m.content.length > 80 ? `${m.content.slice(0, 80)}…` : m.content,
      secondary: m.student ? `${m.student.name} ${m.student.surname}` : t("noStudentContext"),
      href: `/dashboard/list/students/${m.studentId}`,
    })),
  ];

  const goTo = (href: string) => {
    close();
    router.push(href);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (flatResults.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % flatResults.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + flatResults.length) % flatResults.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = flatResults[activeIndex];
      if (target) goTo(target.href);
    }
  };

  if (!open) return null;

  const groups: { key: FlatResult["group"]; label: string; icon: string }[] = [
    { key: "students", label: t("groupStudents"), icon: "/student.png" },
    { key: "tickets", label: t("groupTickets"), icon: "/announcement.png" },
    { key: "messages", label: t("groupMessages"), icon: "/message.png" },
  ];

  let runningIndex = -1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4 bg-blue-950/40 backdrop-blur-sm"
      onClick={close}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-blue-100 bg-white shadow-2xl shadow-blue-900/20 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-blue-100 px-4 py-3">
          <Image src="/search.png" alt="" width={16} height={16} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("placeholder")}
            className="flex-1 bg-transparent outline-none text-sm text-blue-900 placeholder:text-blue-400"
          />
          <kbd className="text-[10px] font-semibold text-blue-400 border border-blue-200 rounded px-1.5 py-0.5">
            ESC
          </kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {query.trim().length < 2 ? (
            <p className="px-4 py-6 text-sm text-gray-400 text-center">{t("prompt")}</p>
          ) : loading ? (
            <p className="px-4 py-6 text-sm text-gray-400 text-center">{t("searching")}</p>
          ) : flatResults.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-400 text-center">{t("noResults")}</p>
          ) : (
            groups.map((group) => {
              const items = flatResults.filter((r) => r.group === group.key);
              if (items.length === 0) return null;
              return (
                <div key={group.key} className="py-2">
                  <p className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-wide text-blue-400">
                    {group.label}
                  </p>
                  {items.map((item) => {
                    runningIndex += 1;
                    const isActive = runningIndex === activeIndex;
                    return (
                      <button
                        key={item.key}
                        onMouseEnter={() => setActiveIndex(runningIndex)}
                        onClick={() => goTo(item.href)}
                        className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                          isActive ? "bg-blue-50" : "hover:bg-blue-50/60"
                        }`}
                      >
                        <Image src={group.icon} alt="" width={16} height={16} />
                        <span className="flex flex-col overflow-hidden">
                          <span className="text-sm font-medium text-blue-900 truncate">
                            {item.primary}
                          </span>
                          <span className="text-xs text-gray-400 truncate">{item.secondary}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
