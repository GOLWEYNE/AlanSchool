import type { ReactNode } from "react";
import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { getUserRole } from "@/lib/auth";

// Assessment Hub is the teachers' entry point to quizzes, exams and assignments,
// so it has the same audience as the pages it links to (teacher only).
export default function AssessmentHubLayout({ children }: { children: ReactNode }) {
  const { userId, sessionClaims } = auth();
  const role = getUserRole(sessionClaims);

  if (!userId || role !== "teacher") {
    return notFound();
  }

  return <>{children}</>;
}
