import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe half of the Auth.js configuration.
 *
 * The middleware runs on the Edge runtime where Prisma (and therefore the
 * Credentials `authorize` function) can't run, so this file must not import
 * anything Node-only. The full config in `auth.ts` spreads this object and
 * adds the Credentials provider.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  // JWT sessions are the standard pairing with the Credentials provider
  // (database sessions require an adapter flow Credentials doesn't use),
  // and they let the middleware check auth without a DB round-trip.
  session: { strategy: "jwt" },
  providers: [], // filled in by auth.ts
  callbacks: {
    /**
     * Gatekeeper used by the middleware. Everything except the login and
     * registration pages requires a session.
     *
     * The auth pages are always allowed through, and deliberately so. This
     * callback only sees the decoded JWT — it cannot tell a live session from
     * one revoked by a password change or a deleted account, because Auth.js
     * does not run the DB-backed `jwt` callback here. Bouncing "logged in"
     * visitors from /login to /books therefore sent revoked sessions into a
     * loop: the page resolves the real session, finds nothing and sends the
     * client to /login, which this callback sent straight back to /books.
     *
     * Sending an already-signed-in visitor to the library is still done — by
     * the login page itself, which resolves the session properly and can tell
     * the difference.
     */
    authorized({ auth, request: { nextUrl } }) {
      const isAuthPage =
        nextUrl.pathname.startsWith("/login") ||
        nextUrl.pathname.startsWith("/register");

      if (isAuthPage) return true;
      return !!auth?.user;
    },
    /** Persist the user id into the JWT at sign-in. */
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    /** Expose the user id on the session object (see types/next-auth.d.ts). */
    session({ session, token }) {
      if (session.user && typeof token.id === "string") {
        session.user.id = token.id;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
