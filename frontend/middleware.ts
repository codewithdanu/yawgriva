import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("yawgriva_token")?.value;
  const role = request.cookies.get("yawgriva_role")?.value;
  const { pathname } = request.nextUrl;

  // 1. User is NOT logged in
  if (!token) {
    // Redirect dashboard requests to login page
    if (
      pathname.startsWith("/farmer") || 
      pathname.startsWith("/distributor") || 
      pathname.startsWith("/admin")
    ) {
      const loginUrl = new URL("/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // 2. User IS logged in
  if (pathname === "/login") {
    // Redirect away from login to their respective role dashboard
    const dashboardPath = role === "admin" 
      ? "/admin" 
      : role === "distributor" 
        ? "/distributor" 
        : "/farmer";
    return NextResponse.redirect(new URL(dashboardPath, request.url));
  }

  // Guard against unauthorized cross-role access
  if (pathname.startsWith("/admin") && role !== "admin") {
    const fallbackPath = role === "distributor" ? "/distributor" : "/farmer";
    return NextResponse.redirect(new URL(fallbackPath, request.url));
  }

  if (pathname.startsWith("/distributor") && role !== "distributor") {
    const fallbackPath = role === "admin" ? "/admin" : "/farmer";
    return NextResponse.redirect(new URL(fallbackPath, request.url));
  }

  if (pathname.startsWith("/farmer") && role !== "farmer") {
    const fallbackPath = role === "admin" ? "/admin" : "/distributor";
    return NextResponse.redirect(new URL(fallbackPath, request.url));
  }

  return NextResponse.next();
}

// Config to specify matching route paths
export const config = {
  matcher: [
    "/login",
    "/farmer/:path*",
    "/distributor/:path*",
    "/admin/:path*",
  ],
};
