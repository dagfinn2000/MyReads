import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

/**
 * Route protection. Uses only the edge-safe config — the `authorized`
 * callback in auth.config.ts decides who gets through.
 */
export default NextAuth(authConfig).auth;

export const config = {
  // Protect everything except:
  //  - Auth.js's own endpoints and the registration endpoint
  //  - Next.js internals and static assets
  matcher: [
    "/((?!api/auth|api/register|_next/static|_next/image|favicon.ico|icon.svg).*)",
  ],
};
