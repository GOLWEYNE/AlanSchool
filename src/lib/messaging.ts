import prisma from "@/lib/prisma";

// Shared server-side helpers for the Direct Messaging inbox
// (/dashboard/list/messages). The `Message` model only stores plain
// Clerk user ids + a role string per side, with no foreign key - so
// "who is this" always means a small lookup into whichever role table
// the id/role pair points at. Kept in one place so the inbox page, the
// thread view, and the compose picker all agree on the same shape.

export type Contact = { id: string; role: string; label: string };

export type ThreadSummary = {
  peerId: string;
  peerRole: string;
  studentId: string | null;
  peerLabel: string;
  studentLabel: string | null;
  lastMessage: string;
  lastAt: Date;
  lastFromMe: boolean;
  unreadCount: number;
};

export type ThreadMessage = {
  id: number;
  senderId: string;
  senderRole: string;
  content: string;
  createdAt: Date;
  readAt: Date | null;
  fromMe: boolean;
};

// Admins only have a username (no name/surname on that model), so their
// display label falls back to that; every other role gets "First Last".
const resolveLabels = async (
  idsByRole: Record<string, Set<string>>
): Promise<Map<string, string>> => {
  const labels = new Map<string, string>();

  const [teachers, parents, students, admins] = await Promise.all([
    idsByRole.teacher?.size
      ? prisma.teacher.findMany({
          where: { id: { in: Array.from(idsByRole.teacher) } },
          select: { id: true, name: true, surname: true },
        })
      : Promise.resolve([]),
    idsByRole.parent?.size
      ? prisma.parent.findMany({
          where: { id: { in: Array.from(idsByRole.parent) } },
          select: { id: true, name: true, surname: true },
        })
      : Promise.resolve([]),
    idsByRole.student?.size
      ? prisma.student.findMany({
          where: { id: { in: Array.from(idsByRole.student) } },
          select: { id: true, name: true, surname: true },
        })
      : Promise.resolve([]),
    idsByRole.admin?.size
      ? prisma.admin.findMany({
          where: { id: { in: Array.from(idsByRole.admin) } },
          select: { id: true, username: true },
        })
      : Promise.resolve([]),
  ]);

  teachers.forEach((t) => labels.set(`teacher:${t.id}`, `${t.name} ${t.surname}`));
  parents.forEach((p) => labels.set(`parent:${p.id}`, `${p.name} ${p.surname}`));
  students.forEach((s) => labels.set(`student:${s.id}`, `${s.name} ${s.surname}`));
  admins.forEach((a) => labels.set(`admin:${a.id}`, a.username));

  return labels;
};

// All conversations involving `userId`, grouped by (peer, peer role,
// optional student context) and sorted most-recently-active first.
export const getThreadsForUser = async (userId: string): Promise<ThreadSummary[]> => {
  const messages = await prisma.message.findMany({
    where: { OR: [{ senderId: userId }, { receiverId: userId }] },
    orderBy: { createdAt: "asc" },
  });

  type Bucket = {
    peerId: string;
    peerRole: string;
    studentId: string | null;
    lastMessage: string;
    lastAt: Date;
    lastFromMe: boolean;
    unreadCount: number;
  };
  const buckets = new Map<string, Bucket>();

  for (const m of messages) {
    const fromMe = m.senderId === userId;
    const peerId = fromMe ? m.receiverId : m.senderId;
    const peerRole = fromMe ? m.receiverRole : m.senderRole;
    const key = `${peerId}|${peerRole}|${m.studentId ?? ""}`;
    const unreadBump = !fromMe && !m.readAt ? 1 : 0;

    const existing = buckets.get(key);
    if (existing) {
      existing.lastMessage = m.content;
      existing.lastAt = m.createdAt;
      existing.lastFromMe = fromMe;
      existing.unreadCount += unreadBump;
    } else {
      buckets.set(key, {
        peerId,
        peerRole,
        studentId: m.studentId,
        lastMessage: m.content,
        lastAt: m.createdAt,
        lastFromMe: fromMe,
        unreadCount: unreadBump,
      });
    }
  }

  const bucketList = Array.from(buckets.values());
  const idsByRole: Record<string, Set<string>> = {};
  const studentIds = new Set<string>();
  for (const b of bucketList) {
    (idsByRole[b.peerRole] ??= new Set()).add(b.peerId);
    if (b.studentId) studentIds.add(b.studentId);
  }
  if (studentIds.size) {
    const existing = idsByRole.student ?? new Set<string>();
    studentIds.forEach((id) => existing.add(id));
    idsByRole.student = existing;
  }

  const labels = await resolveLabels(idsByRole);

  return bucketList
    .map((b) => ({
      peerId: b.peerId,
      peerRole: b.peerRole,
      studentId: b.studentId,
      peerLabel: labels.get(`${b.peerRole}:${b.peerId}`) ?? "Unknown",
      studentLabel: b.studentId ? labels.get(`student:${b.studentId}`) ?? null : null,
      lastMessage: b.lastMessage,
      lastAt: b.lastAt,
      lastFromMe: b.lastFromMe,
      unreadCount: b.unreadCount,
    }))
    .sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());
};

// Full message history for one specific (me, peer, student) thread,
// oldest first, plus a resolved display name for the header.
export const getThreadMessages = async (
  userId: string,
  peerId: string,
  peerRole: string,
  studentId: string | null
): Promise<ThreadMessage[]> => {
  const rows = await prisma.message.findMany({
    where: {
      studentId: studentId ?? null,
      OR: [
        { senderId: userId, receiverId: peerId },
        { senderId: peerId, receiverId: userId },
      ],
    },
    orderBy: { createdAt: "asc" },
  });

  return rows.map((m) => ({
    id: m.id,
    senderId: m.senderId,
    senderRole: m.senderRole,
    content: m.content,
    createdAt: m.createdAt,
    readAt: m.readAt,
    fromMe: m.senderId === userId,
  }));
};

// Marks every unread message from `peerId` to `userId` in this thread as
// read. Best-effort - called on thread open, not user-facing.
export const markThreadRead = async (
  userId: string,
  peerId: string,
  studentId: string | null
) => {
  try {
    await prisma.message.updateMany({
      where: {
        senderId: peerId,
        receiverId: userId,
        studentId: studentId ?? null,
        readAt: null,
      },
      data: { readAt: new Date() },
    });
  } catch (err) {
    console.log(err);
  }
};

// Resolves one specific (id, role) pair to a display label - used for
// the thread header when a brand-new conversation has no messages yet
// (so it isn't already covered by getThreadsForUser's batch resolve).
export const resolveContactLabel = async (id: string, role: string): Promise<string> => {
  if (role === "teacher") {
    const t = await prisma.teacher.findUnique({ where: { id }, select: { name: true, surname: true } });
    return t ? `${t.name} ${t.surname}` : "Unknown";
  }
  if (role === "parent") {
    const p = await prisma.parent.findUnique({ where: { id }, select: { name: true, surname: true } });
    return p ? `${p.name} ${p.surname}` : "Unknown";
  }
  if (role === "student") {
    const s = await prisma.student.findUnique({ where: { id }, select: { name: true, surname: true } });
    return s ? `${s.name} ${s.surname}` : "Unknown";
  }
  if (role === "admin") {
    const a = await prisma.admin.findUnique({ where: { id }, select: { username: true } });
    return a ? a.username : "Unknown";
  }
  return "Unknown";
};

// The "about which student" options offered when composing a new
// message: a parent's own children, or the students a teacher actually
// teaches. Empty for admin/student (admin's reach is broad enough that
// per-student scoping isn't useful; a student's messages are already
// implicitly about themselves).
export const getRelevantStudents = async (
  role: string,
  userId: string
): Promise<{ id: string; label: string }[]> => {
  if (role === "parent") {
    const rows = await prisma.student.findMany({
      where: { parentId: userId },
      select: { id: true, name: true, surname: true },
      orderBy: { name: "asc" },
    });
    return rows.map((s) => ({ id: s.id, label: `${s.name} ${s.surname}` }));
  }
  if (role === "teacher") {
    const classes = await prisma.class.findMany({
      where: { OR: [{ supervisorId: userId }, { lessons: { some: { teacherId: userId } } }] },
      select: { id: true },
    });
    const classIds = classes.map((c) => c.id);
    if (!classIds.length) return [];
    const rows = await prisma.student.findMany({
      where: { classId: { in: classIds } },
      select: { id: true, name: true, surname: true },
      orderBy: { name: "asc" },
    });
    return rows.map((s) => ({ id: s.id, label: `${s.name} ${s.surname}` }));
  }
  return [];
};

// Role-appropriate "who can I start a new conversation with" list, kept
// deliberately scoped rather than "everyone in the school": parents only
// see their own children's teachers, teachers only see parents of
// students they actually teach, students only see their own teachers -
// admin can reach any teacher or parent directly. Everyone can reach the
// front office (Admin).
export const getMessageableContacts = async (
  role: string,
  userId: string
): Promise<{ teachers: Contact[]; parents: Contact[]; admins: Contact[] }> => {
  const adminRows = await prisma.admin.findMany({
    select: { id: true, username: true },
    orderBy: { username: "asc" },
  });
  const admins: Contact[] = adminRows
    .filter((a) => a.id !== userId)
    .map((a) => ({ id: a.id, role: "admin", label: `${a.username} (Front Office)` }));

  if (role === "admin") {
    const [teacherRows, parentRows] = await Promise.all([
      prisma.teacher.findMany({
        select: { id: true, name: true, surname: true },
        orderBy: { name: "asc" },
      }),
      prisma.parent.findMany({
        select: { id: true, name: true, surname: true },
        orderBy: { name: "asc" },
      }),
    ]);
    return {
      teachers: teacherRows.map((t) => ({ id: t.id, role: "teacher", label: `${t.name} ${t.surname}` })),
      parents: parentRows.map((p) => ({ id: p.id, role: "parent", label: `${p.name} ${p.surname}` })),
      admins,
    };
  }

  if (role === "teacher") {
    const classes = await prisma.class.findMany({
      where: { OR: [{ supervisorId: userId }, { lessons: { some: { teacherId: userId } } }] },
      select: { id: true },
    });
    const classIds = classes.map((c) => c.id);
    const students = classIds.length
      ? await prisma.student.findMany({
          where: { classId: { in: classIds } },
          select: { parent: { select: { id: true, name: true, surname: true } } },
          distinct: ["parentId"],
        })
      : [];
    const seen = new Set<string>();
    const parents: Contact[] = [];
    for (const s of students) {
      if (seen.has(s.parent.id)) continue;
      seen.add(s.parent.id);
      parents.push({ id: s.parent.id, role: "parent", label: `${s.parent.name} ${s.parent.surname}` });
    }
    return { teachers: [], parents, admins };
  }

  if (role === "parent") {
    const children = await prisma.student.findMany({
      where: { parentId: userId },
      select: { classId: true },
    });
    const classIds = Array.from(new Set(children.map((c) => c.classId)));
    const teacherRows = classIds.length
      ? await prisma.teacher.findMany({
          where: {
            OR: [{ classes: { some: { id: { in: classIds } } } }, { lessons: { some: { classId: { in: classIds } } } }],
          },
          select: { id: true, name: true, surname: true },
          distinct: ["id"],
        })
      : [];
    return {
      teachers: teacherRows.map((t) => ({ id: t.id, role: "teacher", label: `${t.name} ${t.surname}` })),
      parents: [],
      admins,
    };
  }

  if (role === "student") {
    const me = await prisma.student.findUnique({ where: { id: userId }, select: { classId: true } });
    const teacherRows = me
      ? await prisma.teacher.findMany({
          where: {
            OR: [{ classes: { some: { id: me.classId } } }, { lessons: { some: { classId: me.classId } } }],
          },
          select: { id: true, name: true, surname: true },
          distinct: ["id"],
        })
      : [];
    return {
      teachers: teacherRows.map((t) => ({ id: t.id, role: "teacher", label: `${t.name} ${t.surname}` })),
      parents: [],
      admins,
    };
  }

  return { teachers: [], parents: [], admins };
};
