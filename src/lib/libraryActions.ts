"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { getTranslations } from "next-intl/server";
import prisma from "@/lib/prisma";
import { getUserRole } from "@/lib/auth";
import { notifyUser } from "@/lib/notify";
import { canManageLibrary, ensureLibrary } from "@/lib/library";
import { BOOK_CATEGORIES, LOAN_DAYS, clamp } from "@/lib/libraryShared";

export type LibraryResult = { ok: boolean; error?: string; message?: string };

type TFn = (key: string, values?: Record<string, string | number>) => string;

const refresh = () => revalidatePath("/dashboard/list/library", "layout");

async function context() {
  const t = (await getTranslations("Library")) as unknown as TFn;
  const { userId, sessionClaims } = await auth();
  const role = getUserRole(sessionClaims);
  return { t, userId: userId ?? null, role };
}

// Runs `fn` only for a signed-in librarian (admin or the chosen librarian teacher).
async function asLibrarian(
  fn: (ctx: { t: TFn; userId: string }) => Promise<LibraryResult>
): Promise<LibraryResult> {
  const { t, userId, role } = await context();
  if (!userId) return { ok: false, error: t("errors.notSignedIn") };
  if (!(await ensureLibrary())) return { ok: false, error: t("errors.notReady") };
  if (!(await canManageLibrary(userId, role))) return { ok: false, error: t("errors.notAllowed") };
  try {
    return await fn({ t, userId });
  } catch (error) {
    console.error("[library] action failed", error);
    return { ok: false, error: t("errors.generic") };
  }
}

// Runs `fn` only for a signed-in student.
async function asStudent(
  fn: (ctx: { t: TFn; userId: string }) => Promise<LibraryResult>
): Promise<LibraryResult> {
  const { t, userId, role } = await context();
  if (!userId) return { ok: false, error: t("errors.notSignedIn") };
  if (role !== "student") return { ok: false, error: t("errors.studentsOnly") };
  if (!(await ensureLibrary())) return { ok: false, error: t("errors.notReady") };
  try {
    return await fn({ t, userId });
  } catch (error) {
    console.error("[library] action failed", error);
    return { ok: false, error: t("errors.generic") };
  }
}

const num = (v: FormDataEntryValue | null) => {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : NaN;
};

// ---------------------------------------------------------------- books

export async function saveBook(formData: FormData): Promise<LibraryResult> {
  return asLibrarian(async ({ t }) => {
    const id = num(formData.get("id"));
    const title = clamp(String(formData.get("title") ?? ""), 200);
    const author = clamp(String(formData.get("author") ?? ""), 200);
    const category = String(formData.get("category") ?? "FICTION");
    const copies = num(formData.get("copies"));
    if (!title || !author || !(BOOK_CATEGORIES as readonly string[]).includes(category)) {
      return { ok: false, error: t("errors.invalid") };
    }
    const data = {
      title,
      author,
      category,
      copies: Number.isFinite(copies) ? Math.min(Math.max(copies, 1), 500) : 1,
      gradeLevel: clamp(String(formData.get("gradeLevel") ?? ""), 40) || null,
      language: clamp(String(formData.get("language") ?? ""), 40) || null,
      description: clamp(String(formData.get("description") ?? ""), 1500) || null,
      coverUrl: clamp(String(formData.get("coverUrl") ?? ""), 500) || null,
      shelf: clamp(String(formData.get("shelf") ?? ""), 60) || null,
    };
    if (Number.isFinite(id)) {
      await prisma.libraryBook.update({ where: { id }, data });
    } else {
      await prisma.libraryBook.create({ data });
    }
    refresh();
    return { ok: true, message: t("desk.saved") };
  });
}

export async function deleteBook(id: number): Promise<LibraryResult> {
  return asLibrarian(async ({ t }) => {
    const active = await prisma.libraryLoan.count({ where: { bookId: id, returnedAt: null } });
    if (active > 0) return { ok: false, error: t("errors.bookOnLoan") };
    await prisma.libraryBook.delete({ where: { id } });
    refresh();
    return { ok: true };
  });
}

// ---------------------------------------------------------------- loans

export async function lendBook(formData: FormData): Promise<LibraryResult> {
  return asLibrarian(async ({ t, userId }) => {
    const bookId = num(formData.get("bookId"));
    const studentId = String(formData.get("studentId") ?? "");
    const days = num(formData.get("days"));
    if (!Number.isFinite(bookId) || !studentId) return { ok: false, error: t("errors.invalid") };

    const [book, student, out, same] = await Promise.all([
      prisma.libraryBook.findUnique({ where: { id: bookId }, select: { copies: true, title: true } }),
      prisma.student.findUnique({ where: { id: studentId }, select: { id: true } }),
      prisma.libraryLoan.count({ where: { bookId, returnedAt: null } }),
      prisma.libraryLoan.count({ where: { bookId, studentId, returnedAt: null } }),
    ]);
    if (!book || !student) return { ok: false, error: t("errors.notFound") };
    if (same > 0) return { ok: false, error: t("errors.alreadyBorrowed") };
    if (out >= book.copies) return { ok: false, error: t("errors.noCopies") };

    const period = Number.isFinite(days) ? Math.min(Math.max(days, 1), 60) : LOAN_DAYS;
    const dueAt = new Date(Date.now() + period * 24 * 60 * 60 * 1000);
    await prisma.libraryLoan.create({ data: { bookId, studentId, dueAt, recordedBy: userId } });
    refresh();
    return { ok: true, message: t("desk.lent", { title: book.title }) };
  });
}

export async function returnLoan(loanId: number): Promise<LibraryResult> {
  return asLibrarian(async ({ t }) => {
    const loan = await prisma.libraryLoan.findUnique({
      where: { id: loanId },
      select: { returnedAt: true, studentId: true, book: { select: { title: true, category: true } } },
    });
    if (!loan) return { ok: false, error: t("errors.notFound") };
    if (loan.returnedAt) return { ok: true };
    await prisma.libraryLoan.update({ where: { id: loanId }, data: { returnedAt: new Date() } });
    if (loan.book.category !== "TEXTBOOK") {
      notifyUser(loan.studentId, {
        title: t("notify.returnedTitle"),
        body: t("notify.returnedBody", { title: loan.book.title }),
        url: "/dashboard/list/library",
      }).catch(() => undefined);
    }
    refresh();
    return { ok: true, message: t("desk.returned") };
  });
}

// ---------------------------------------------------------------- reviews

export async function submitReview(formData: FormData): Promise<LibraryResult> {
  return asStudent(async ({ t, userId }) => {
    const bookId = num(formData.get("bookId"));
    const rating = num(formData.get("rating"));
    const text = clamp(String(formData.get("text") ?? ""), 600);
    if (!Number.isFinite(bookId) || !(rating >= 1 && rating <= 5) || text.length < 5) {
      return { ok: false, error: t("errors.invalid") };
    }
    const borrowed = await prisma.libraryLoan.count({ where: { studentId: userId, bookId } });
    if (borrowed === 0) return { ok: false, error: t("errors.notBorrowed") };
    const existing = await prisma.libraryReview.count({ where: { studentId: userId, bookId } });
    if (existing > 0) return { ok: false, error: t("errors.alreadyReviewed") };
    await prisma.libraryReview.create({ data: { bookId, studentId: userId, rating, text } });
    refresh();
    return { ok: true, message: t("community.pendingNote") };
  });
}

export async function moderateReview(id: number, status: "APPROVED" | "REJECTED"): Promise<LibraryResult> {
  return asLibrarian(async () => {
    await prisma.libraryReview.update({ where: { id }, data: { status } });
    refresh();
    return { ok: true };
  });
}

export async function deleteReview(id: number): Promise<LibraryResult> {
  return asLibrarian(async () => {
    await prisma.libraryReview.delete({ where: { id } });
    refresh();
    return { ok: true };
  });
}

// ---------------------------------------------------------------- "let's find a book together"

export async function askForBook(formData: FormData): Promise<LibraryResult> {
  return asStudent(async ({ t, userId }) => {
    const message = clamp(String(formData.get("message") ?? ""), 400);
    if (message.length < 5) return { ok: false, error: t("errors.invalid") };
    const open = await prisma.libraryRequest.count({ where: { studentId: userId, status: "OPEN" } });
    if (open >= 3) return { ok: false, error: t("errors.tooManyRequests") };
    await prisma.libraryRequest.create({ data: { studentId: userId, message } });
    refresh();
    return { ok: true, message: t("community.requestSent") };
  });
}

export async function answerRequest(formData: FormData): Promise<LibraryResult> {
  return asLibrarian(async ({ t }) => {
    const id = num(formData.get("id"));
    const reply = clamp(String(formData.get("reply") ?? ""), 500);
    const bookId = num(formData.get("bookId"));
    if (!Number.isFinite(id) || reply.length < 2) return { ok: false, error: t("errors.invalid") };
    const request = await prisma.libraryRequest.update({
      where: { id },
      data: {
        reply,
        suggestedBookId: Number.isFinite(bookId) ? bookId : null,
        status: "ANSWERED",
        repliedAt: new Date(),
      },
      select: { studentId: true },
    });
    notifyUser(request.studentId, {
      title: t("notify.answerTitle"),
      body: reply,
      url: "/dashboard/list/library/community",
    }).catch(() => undefined);
    refresh();
    return { ok: true, message: t("desk.saved") };
  });
}

// ---------------------------------------------------------------- news / today / photos

export async function savePost(formData: FormData): Promise<LibraryResult> {
  return asLibrarian(async ({ t, userId }) => {
    const kind = String(formData.get("kind") ?? "NEWS") === "TODAY" ? "TODAY" : "NEWS";
    const title = clamp(String(formData.get("title") ?? ""), 140);
    const body = clamp(String(formData.get("body") ?? ""), 2000);
    if (!title || !body) return { ok: false, error: t("errors.invalid") };
    await prisma.libraryPost.create({
      data: {
        kind,
        title,
        body,
        imageUrl: clamp(String(formData.get("imageUrl") ?? ""), 500) || null,
        authorId: userId,
      },
    });
    refresh();
    return { ok: true, message: t("desk.published") };
  });
}

export async function deletePost(id: number): Promise<LibraryResult> {
  return asLibrarian(async () => {
    await prisma.libraryPost.delete({ where: { id } });
    refresh();
    return { ok: true };
  });
}

export async function addPhoto(formData: FormData): Promise<LibraryResult> {
  return asLibrarian(async ({ t }) => {
    const url = clamp(String(formData.get("url") ?? ""), 500);
    if (!url) return { ok: false, error: t("errors.photoRequired") };
    await prisma.libraryPhoto.create({
      data: { url, caption: clamp(String(formData.get("caption") ?? ""), 200) || null },
    });
    refresh();
    return { ok: true, message: t("desk.published") };
  });
}

export async function deletePhoto(id: number): Promise<LibraryResult> {
  return asLibrarian(async () => {
    await prisma.libraryPhoto.delete({ where: { id } });
    refresh();
    return { ok: true };
  });
}

// ---------------------------------------------------------------- settings & Book of the Week

export async function saveSettings(formData: FormData): Promise<LibraryResult> {
  const { role } = await context();
  return asLibrarian(async ({ t }) => {
    const data: Record<string, string | null> = {
      librarianName: clamp(String(formData.get("librarianName") ?? ""), 120) || null,
      librarianImg: clamp(String(formData.get("librarianImg") ?? ""), 500) || null,
      intro: clamp(String(formData.get("intro") ?? ""), 1500) || null,
      goals: clamp(String(formData.get("goals") ?? ""), 1500) || null,
      hours: clamp(String(formData.get("hours") ?? ""), 200) || null,
    };
    // Only an admin may hand the librarian role to a teacher.
    if (role === "admin" && formData.has("librarianTeacherId")) {
      data.librarianTeacherId = clamp(String(formData.get("librarianTeacherId") ?? ""), 100) || null;
    }
    await prisma.librarySettings.upsert({
      where: { id: 1 },
      update: data,
      create: { id: 1, ...data },
    });
    refresh();
    return { ok: true, message: t("desk.saved") };
  });
}

export async function setFeaturedBook(formData: FormData): Promise<LibraryResult> {
  return asLibrarian(async ({ t }) => {
    const bookId = num(formData.get("bookId"));
    if (!Number.isFinite(bookId)) return { ok: false, error: t("errors.invalid") };
    const note = clamp(String(formData.get("note") ?? ""), 400) || null;
    const data = { featuredBookId: bookId, featuredNote: note, featuredSetAt: new Date() };
    await prisma.librarySettings.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
    refresh();
    return { ok: true, message: t("desk.saved") };
  });
}
