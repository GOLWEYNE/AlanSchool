import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getUserRole } from "@/lib/auth";
import type { ReactNode } from "react";

/**
 * Frontend route guard for role-gated pages.
 *
 * The edge middleware (`src/middleware.ts` + `routeAccessMap` in
 * `src/lib/settings.ts`) already blocks disallowed roles before a page's
 * server component even runs. This component is a second, explicit layer
 * of defense at the component level: if a page using it is ever reached by
 * a role it isn't meant for (a middleware config gap, a route added
 * without updating `routeAccessMap`, etc.), it redirects the user to their
 * own dashboard instead of rendering the page's content.
 *
 * Usage:
 *   <ProtectedRoute allowedRoles={["admin"]}>
 *     ...page content...
 *   </ProtectedRoute>
 */
const ProtectedRoute = ({
  allowedRoles,
  children,
}: {
  allowedRoles: string[];
  children: ReactNode;
}) => {
  const { userId, sessionClaims } = auth();
  const role = getUserRole(sessionClaims);

  if (!userId) {
    redirect("/sign-in");
  }

  if (!allowedRoles.includes(role)) {
    redirect(role ? `/dashboard/${role}` : "/dashboard");
  }

  return <>{children}</>;
};

export default ProtectedRoute;
