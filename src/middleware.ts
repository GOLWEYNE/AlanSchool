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

export default clerkMiddleware((auth, req) => {
  const { userId, sessionClaims } = auth();
  const role = getRole(sessionClaims);

  if (publicRoutes(req)) {
    if (userId && req.nextUrl.pathname === "/") {
      if (role === "teacher") {
        return NextResponse.redirect(
          new URL(`/dashboard/list/teachers/userpage`, req.url)
        );
      } else if (role === "student") {
        return NextResponse.redirect(
          new URL(`/dashboard/list/students/userpage`, req.url)
        );
      } else if (role === "parent") {
        return NextResponse.redirect(
          new URL(`/dashboard/list/parents/parent_${userId}`, req.url)
        );
      } else if (role === "admin") {
        return NextResponse.redirect(
          new URL(`/dashboard/admin`, req.url)
        );
      }
      return NextResponse.redirect(
        new URL(role ? `/dashboard/${role}` : "/dashboard", req.url)
      );
    }
    return NextResponse.next();
  }

  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  for (const { matcher, allowedRoles } of matchers) {
    if (matcher(req) && !allowedRoles.includes(role ?? "")) {
      if (role === "teacher") {
        return NextResponse.redirect(
          new URL(`/dashboard/list/teachers/userpage`, req.url)
        );
      } else if (role === "student") {
        return NextResponse.redirect(
          new URL(`/dashboard/list/students/userpage`, req.url)
        );
      } else if (role === "parent") {
        return NextResponse.redirect(
          new URL(`/dashboard/list/parents/parent_${userId}`, req.url)
        );
      }
      return NextResponse.redirect(
        new URL(role ? `/dashboard/${role}` : "/dashboard", req.url)
      );
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
