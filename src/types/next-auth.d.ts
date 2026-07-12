import { DefaultSession } from "next-auth";

// Auth.js's default session user has no `id`; ours always does (set in the
// session callback from the JWT).
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}
