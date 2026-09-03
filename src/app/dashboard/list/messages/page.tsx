import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { Inbox, Plus, ShieldAlert } from "lucide-react";
import { getUserRole } from "@/lib/auth";
import PageHero from "@/components/PageHero";
import MessageComposeForm from "@/components/forms/MessageComposeForm";
import {
  getThreadsForUser,
  getThreadMessages,
  markThreadRead,
  getMessageableContacts,
  getRelevantStudents,
  resolveContactLabel,
} from "@/lib/messaging";

const threadKey = (peerId: string, peerRole: string, studentId: string | null) =>
  `${peerId}|${peerRole}|${studentId ?? ""}`;

const initials = (label: string) =>
  label
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

const MessagesPage = async ({
  searchParams,
}: {
  searchParams: { peer?: string; role?: string; student?: string; new?: string };
}) => {
  const { userId, sessionClaims } = auth();
  const role = getUserRole(sessionClaims);

  if (!userId || !role) {
    return (
      <div className="flex-1 p-4">
        <div className="panel-card p-8 rounded-2xl flex flex-col items-center text-center gap-3 max-w-md mx-auto mt-12">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20">
            <ShieldAlert size={26} className="text-rose-500 dark:text-rose-300" />
          </div>
          <h1 className="text-lg font-bold text-gray-800 dark:text-blue-100">Access Restricted</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Please sign in to view your messages.
          </p>
        </div>
      </div>
    );
  }

  const threads = await getThreadsForUser(userId);
  const composingNew = searchParams.new === "1";
  const selectedPeer = searchParams.peer;
  const selectedRole = searchParams.role;
  const selectedStudent = searchParams.student ?? null;

  const activeKey = selectedPeer && selectedRole ? threadKey(selectedPeer, selectedRole, selectedStudent) : null;
  const unreadTotal = threads.reduce((sum, t) => sum + t.unreadCount, 0);

  let panel: React.ReactNode;

  if (composingNew) {
    const [contacts, studentOptions] = await Promise.all([
      getMessageableContacts(role, userId),
      getRelevantStudents(role, userId),
    ]);
    panel = (
      <div className="panel-card p-5 md:p-6 rounded-2xl shine-hover">
        <h2 className="text-base font-bold text-gray-800 dark:text-blue-100 mb-4">New Message</h2>
        <MessageComposeForm mode="new" contacts={contacts} studentOptions={studentOptions} />
      </div>
    );
  } else if (selectedPeer && selectedRole) {
    await markThreadRead(userId, selectedPeer, selectedStudent);
    const [messages, peerLabel, studentLabel] = await Promise.all([
      getThreadMessages(userId, selectedPeer, selectedRole, selectedStudent),
      resolveContactLabel(selectedPeer, selectedRole),
      selectedStudent ? resolveContactLabel(selectedStudent, "student") : Promise.resolve(null),
    ]);

    panel = (
      <div className="panel-card rounded-2xl shine-hover flex flex-col h-[70vh]">
        <div className="p-4 md:p-5 border-b border-gray-100 dark:border-slate-800 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-200 text-sm font-bold">
            {initials(peerLabel)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-800 dark:text-blue-100 truncate">{peerLabel}</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 capitalize">
              {selectedRole}
              {studentLabel ? ` · About ${studentLabel}` : ""}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-5 flex flex-col gap-3">
          {messages.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-slate-500 text-center my-auto">
              No messages yet - say hello.
            </p>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`flex ${m.fromMe ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                    m.fromMe
                      ? "bg-blue-600 text-white rounded-br-sm"
                      : "bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-100 rounded-bl-sm"
                  }`}
                >
                  {m.content}
                  <p
                    className={`text-[10px] mt-1 ${
                      m.fromMe ? "text-blue-100" : "text-gray-400 dark:text-slate-500"
                    }`}
                  >
                    {m.createdAt.toLocaleString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 md:p-5 border-t border-gray-100 dark:border-slate-800">
          <MessageComposeForm
            mode="reply"
            peerId={selectedPeer}
            peerRole={selectedRole}
            studentId={selectedStudent}
          />
        </div>
      </div>
    );
  } else if (threads.length > 0) {
    // No thread selected but conversations exist - land on the most
    // recent one instead of showing a blank pane.
    const first = threads[0];
    const qs = `peer=${first.peerId}&role=${first.peerRole}${
      first.studentId ? `&student=${first.studentId}` : ""
    }`;
    panel = (
      <div className="panel-card rounded-2xl shine-hover h-[70vh] flex items-center justify-center">
        <Link href={`/dashboard/list/messages?${qs}`} className="text-sm text-blue-600 hover:underline">
          Open your most recent conversation with {first.peerLabel} →
        </Link>
      </div>
    );
  } else {
    panel = (
      <div className="panel-card rounded-2xl shine-hover h-[70vh] flex flex-col items-center justify-center text-center gap-3 px-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20">
          <Inbox size={24} className="text-blue-400 dark:text-blue-300" />
        </div>
        <p className="text-sm font-semibold text-gray-600 dark:text-slate-300">No conversations yet.</p>
        <p className="text-xs text-gray-400 dark:text-slate-500 max-w-xs">
          Start a conversation with a teacher, parent, or the front office.
        </p>
        <Link
          href="/dashboard/list/messages?new=1"
          className="mt-1 flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 transition-colors text-white px-4 py-2 rounded-lg text-xs font-semibold shine-hover"
        >
          <Plus size={14} /> New Message
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-4 max-w-6xl">
      <PageHero
        title="Messages"
        subtitle="Direct conversations between staff, parents, and students - scoped to the people you actually work with."
        emoji="💬"
        stats={[
          { label: "Conversations", value: threads.length },
          { label: "Unread", value: unreadTotal },
        ]}
      />

      <div className="flex flex-col md:flex-row gap-4">
        <div className="w-full md:w-72 shrink-0 panel-card rounded-2xl p-3 flex flex-col gap-1 h-fit">
          <Link
            href="/dashboard/list/messages?new=1"
            className={`flex items-center gap-1.5 justify-center mb-2 bg-blue-600 hover:bg-blue-700 transition-colors text-white px-3 py-2 rounded-lg text-xs font-semibold shine-hover ${
              composingNew ? "ring-2 ring-blue-300" : ""
            }`}
          >
            <Plus size={14} /> New Message
          </Link>

          {threads.length === 0 && (
            <p className="text-xs text-gray-400 dark:text-slate-500 text-center py-4">
              Nothing here yet.
            </p>
          )}

          {threads.map((t) => {
            const key = threadKey(t.peerId, t.peerRole, t.studentId);
            const isActive = key === activeKey;
            const qs = `peer=${t.peerId}&role=${t.peerRole}${t.studentId ? `&student=${t.studentId}` : ""}`;
            return (
              <Link
                key={key}
                href={`/dashboard/list/messages?${qs}`}
                className={`flex items-start gap-2.5 rounded-xl px-2.5 py-2 transition-colors ${
                  isActive
                    ? "bg-blue-50 dark:bg-blue-500/10"
                    : "hover:bg-gray-50 dark:hover:bg-slate-800/60"
                }`}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-200 text-xs font-bold">
                  {initials(t.peerLabel)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-xs font-semibold text-gray-800 dark:text-blue-100 truncate">
                      {t.peerLabel}
                    </p>
                    {t.unreadCount > 0 && (
                      <span className="shrink-0 min-w-4 h-4 px-1 flex items-center justify-center bg-blue-600 text-white rounded-full text-[10px]">
                        {t.unreadCount}
                      </span>
                    )}
                  </div>
                  {t.studentLabel && (
                    <p className="text-[10px] text-blue-400 dark:text-blue-500 truncate">
                      Re: {t.studentLabel}
                    </p>
                  )}
                  <p className="text-[11px] text-gray-400 dark:text-slate-500 truncate">
                    {t.lastFromMe ? "You: " : ""}
                    {t.lastMessage}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="flex-1 min-w-0">{panel}</div>
      </div>
    </div>
  );
};

export default MessagesPage;
