import { DefaultSession } from "next-auth";

// Auth.js's default session user has no `id`; ours always does (set in the
// session callback from the JWT).
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }

  // What `authorize` returns and the `jwt` callback receives at sign-in.
  interface User {
    tokenVersion?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    /** Snapshot of User.tokenVersion when this token was minted. Absent on
     *  tokens issued before the column existed — treated as 0. */
    tokenVersion?: number;
  }
}
