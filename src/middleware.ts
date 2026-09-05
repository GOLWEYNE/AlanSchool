import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { routeAccessMap } from "./lib/settings";
import { NextResponse } from "next/server";

const matchers = Object.keys(routeAccessMap).map((route) => ({
  matcher: createRouteMatcher([route]),
  allowedRoles: routeAccessMap[route],
}));

const publicRoutes = createRouteMatcher(["/", "/sign-in(.*)", "/sign-up(.*)"]);

const getRole = (sessionClaims: any) => {
  const directRole = sessionClaims?.role as string | undefined;
  const metadataRole = (sessionClaims?.metadata as { role?: string } | undefined)?.role;
  const publicMetadataRole = (sessionClaims?.publicMetadata as { role?: string } | undefined)?.role;
  return String(directRole ?? metadataRole ?? publicMetadataRole ?? "").trim().toLowerCase();
};

// Every role has a purpose-built home dashboard at /dashboard/<role>
// (admin, teacher, student, parent all live under src/app/dashboard/<role>).
// Sending everyone there — instead of a generic page or a profile "userpage" —
// is what makes a parent land on their child's schedule/results and a
// student land on their own day, rather than everyone seeing the same view.
const homeFor = (role: string) => (role ? `/dashboard/${role}` : "/dashboard");

export default clerkMiddleware((auth, req) => {
  const { userId, sessionClaims } = auth();
  const role = getRole(sessionClaims);

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
