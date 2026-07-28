import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";
import { clientIp, loginLimiter } from "@/lib/rate-limit";

const credentialsSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

/** Thrown when a username or IP has burned through its failed-attempt
 *  budget. The `code` surfaces in the client `signIn` response so the login
 *  page can say "slow down" instead of "wrong password". */
class RateLimited extends CredentialsSignin {
  code = "rate-limited";
}

/**
 * Full Auth.js setup (Node runtime): the edge-safe base config plus the
 * Credentials provider that checks username/password against the database.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username" },
        password: { label: "Password", type: "password" },
      },
      /**
       * Returns the user object on success or null on any failure.
       * Deliberately does not distinguish "unknown user" from "wrong
       * password" — both surface as the same login error.
       *
       * Failed attempts are rate-limited per username *and* per IP (see
       * lib/rate-limit.ts), so an online guessing attack locks itself out
       * long before it can try a meaningful number of passwords.
       */
      async authorize(credentials, request) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const username = parsed.data.username.trim().toLowerCase();
        const userKey = `login:u:${username}`;
        const ipKey = `login:ip:${clientIp(request.headers)}`;
        if (loginLimiter.blocked(userKey) || loginLimiter.blocked(ipKey)) {
          throw new RateLimited();
        }

        const user = await prisma.user.findUnique({ where: { username } });
        // Compare against a real hash even for unknown users, so response
        // timing doesn't reveal whether the username exists.
        const valid = await bcrypt.compare(
          parsed.data.password,
          user?.passwordHash ??
            // cost-12 hash of a random throwaway string
            "$2b$12$ZIgPF.pZ5kI2j99acoA77etRoBI8rt0AYAxOK8wKk52ZBwSHqA2Ky",
        );

        if (!user || !valid) {
          loginLimiter.hit(userKey);
          loginLimiter.hit(ipKey);
          return null;
        }

        loginLimiter.clear(userKey);
        loginLimiter.clear(ipKey);
        return {
          id: user.id,
          name: user.username,
          tokenVersion: user.tokenVersion,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    /**
     * Session revocation. JWT sessions have no server-side row to delete, so
     * a stolen cookie would otherwise stay valid for its full lifetime even
     * after the owner changed their password. The token carries the
     * `tokenVersion` it was minted with; here — on the Node runtime, where
     * Prisma is available — it's checked against the database on every
     * session read, and a mismatch destroys the session.
     *
     * Returning null invalidates the token. The edge-safe config in
     * auth.config.ts deliberately keeps its DB-free callback for the proxy,
     * so a revoked token still passes the middleware and is rejected here
     * instead: every page and server action resolves its session through
     * this config, so a revoked session can neither read nor write.
     *
     * Tokens minted before the column existed carry no version and are read
     * as 0, matching the column default — upgrading an existing instance
     * doesn't sign anyone out.
     */
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.tokenVersion = user.tokenVersion ?? 0;
        return token;
      }

      if (typeof token.id !== "string") return null;

      const current = await prisma.user.findUnique({
        where: { id: token.id },
        select: { tokenVersion: true },
      });
      // Deleted account: the row is gone, so the cookie must stop working.
      if (!current) return null;
      if (current.tokenVersion !== (token.tokenVersion ?? 0)) return null;

      return token;
    },
  },
});
