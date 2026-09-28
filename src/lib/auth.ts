import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

type RoleClaims = {
  [key: string]: unknown;
  role?: string;
  metadata?: { role?: string };
  publicMetadata?: { role?: string };
};

export const getUserRole = (
  sessionClaims: RoleClaims | null | undefined,
  fallbackRole = ""
) => {
  const role = (
    sessionClaims?.role ??
    sessionClaims?.metadata?.role ??
    sessionClaims?.publicMetadata?.role ??
    fallbackRole
  );

  return String(role).trim().toLowerCase();
};

// Every role has a purpose-built home dashboard at /dashboard/<role>
// (admin, teacher, student, parent all live under src/app/dashboard/<role>).
// Sending everyone there - instead of a generic page or a profile "userpage" -
// is what makes a parent land on their child's schedule/results and a
// student land on their own day, rather than everyone seeing the same view.
// Shared by middleware.ts and requireRole() below so a signed-in user who
// hits a route their role can't see always lands in the same place, however
// the check that caught them ran.
export const homeFor = (role: string) => (role ? `/dashboard/${role}` : "/dashboard");

export type RequireRoleResult = { userId: string; role: string };

// The page/layout half of the app's role gate. Server Components and layouts
// call this at the top of the function body with the SAME allowedRoles array
// middleware.ts would use for that route (in practice, look it up from
// routeAccessMap in @/lib/settings by the route's own key, e.g.
// `requireRole(routeAccessMap["/dashboard/list/gradebook(.*)"])`) so the two
// checks can't drift apart into two different opinions about who's allowed.
//
// middleware.ts already redirects unauthorized requests before a Server
// Component ever renders, so in the common case this never fires - it's the
// second layer of defense-in-depth for when a route's middleware matcher
// doesn't cover a path the way it's expected to, or a future refactor moves
// a page without updating the matcher. Unlike middleware (which only sees a
// pathname), this runs with the actual rendered auth() call the page already
// needed, so it's nearly free to add.
export function requireRole(allowedRoles: string[]): RequireRoleResult {
  const { userId, sessionClaims } = auth();
  const role = getUserRole(sessionClaims);

  if (!userId) {
    redirect("/sign-in");
  }
  if (!allowedRoles.includes(role)) {
    redirect(homeFor(role));
  }

  return { userId, role };
}

// The API route-handler half of the same gate. redirect() only makes sense
// for a page render, so a route handler calls this instead and gets back
// either a NextResponse it should return immediately, or the caller's
// {userId, role} once access is confirmed:
//
//   const access = requireApiRole(["admin"]);
//   if (access instanceof NextResponse) return access;
//   const { userId, role } = access;
export function requireApiRole(
  allowedRoles: string[]
): RequireRoleResult | NextResponse {
  const { userId, sessionClaims } = auth();
  const role = getUserRole(sessionClaims);

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!allowedRoles.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return { userId, role };
}
