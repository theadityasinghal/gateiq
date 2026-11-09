import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Optimistic check only: bounce visitors without a session cookie to sign-in.
 * Real authorization happens in the Data Access Layer (src/server/session.ts).
 */
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const url = new URL("/sign-in", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/onboarding/:path*", "/cases/:path*", "/dashboard/:path*", "/profile/:path*"],
};
