import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { routeAccessMap } from "./lib/settings";
import { getUserRole, homeFor } from "./lib/auth";
import { NextResponse } from "next/server";

const matchers = Object.keys(routeAccessMap).map((route) => ({
  matcher: createRouteMatcher([route]),
  allowedRoles: routeAccessMap[route],
}));

// The duty reminder cron has no signed-in user - the route authenticates itself
// with CRON_SECRET. Only that one route is opened up (not all of /api/cron).
const publicRoutes = createRouteMatcher(["/", "/sign-in(.*)", "/sign-up(.*)", "/api/cron/duty-reminders", "/manifest.webmanifest", "/icon-(.*)\\.png"]);

export default clerkMiddleware((auth, req) => {
  const { userId, sessionClaims } = auth();
  const role = getUserRole(sessionClaims);

  if (publicRoutes(req)) {
    if (userId && req.nextUrl.pathname === "/") {
      return NextResponse.redirect(new URL(homeFor(role), req.url));
    }
    return NextResponse.next();
  }

  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  for (const { matcher, allowedRoles } of matchers) {
    if (matcher(req) && !allowedRoles.includes(role ?? "")) {
      return NextResponse.redirect(new URL(homeFor(role), req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
