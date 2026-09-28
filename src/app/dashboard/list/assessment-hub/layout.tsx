import type { ReactNode } from "react";
import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { getUserRole } from "@/lib/auth";
import { routeAccessMap } from "@/lib/settings";

// Assessment Hub is the teachers' entry point to quizzes, exams and assignments,
// so it has the same audience as the pages it links to (teacher only) - the
// A5 audit gap this closes: this layout previously rolled its own role
// list here ("teacher") by hand instead of reading it from the same
// routeAccessMap middleware.ts uses, so the two could silently drift apart.
//
// This uses getUserRole() + routeAccessMap directly rather than
// requireRole(), because a hidden hub should 404 for the wrong role instead
// of redirecting (which would reveal that a page exists here at all) -
// requireRole() always redirects, so it doesn't fit this one case.
export default function AssessmentHubLayout({ children }: { children: ReactNode }) {
  const { userId, sessionClaims } = auth();
  const role = getUserRole(sessionClaims);
  const allowedRoles = routeAccessMap["/dashboard/list/assessment-hub(.*)"];

  if (!userId || !allowedRoles.includes(role)) {
    return notFound();
  }

  return <>{children}</>;
}
