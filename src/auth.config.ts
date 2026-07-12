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
     * registration pages requires a session; hitting an auth page while
     * already signed in bounces to the library.
     */
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAuthPage =
        nextUrl.pathname.startsWith("/login") ||
        nextUrl.pathname.startsWith("/register");

      if (isAuthPage) {
        if (isLoggedIn) return Response.redirect(new URL("/books", nextUrl));
        return true;
      }
      return isLoggedIn;
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
