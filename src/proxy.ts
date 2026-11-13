import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Optimistic check only, from the session cookie. Real authorization happens in the Data Access Layer
 * (src/server/session.ts).
 * - Signed out: protected pages bounce to sign-in.
 * - Signed in: the home page isn't for you, so it goes to the dashboard. (A stale cookie ends up at sign-in
 *   from there, which doesn't redirect back, so this can't loop.)
 */
export function proxy(request: NextRequest) {
  const signedIn = !!getSessionCookie(request);
  if (request.nextUrl.pathname === "/") {
    return signedIn ? NextResponse.redirect(new URL("/dashboard", request.url)) : NextResponse.next();
  }
  if (!signedIn) {
    const url = new URL("/sign-in", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/onboarding/:path*", "/cases/:path*", "/dashboard/:path*", "/profile/:path*"],
};
