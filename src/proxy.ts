import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

/**
 * Route protection (Next 16 `proxy` convention — the old middleware.ts,
 * renamed). Runs on the Node runtime, but keeps using only the lean config —
 * the `authorized` callback in auth.config.ts decides who gets through
 * without a database round-trip.
 *
 * Note for session revocation: a token revoked via `tokenVersion` (see
 * auth.ts) still passes this layer — measured: with the lean config a revoked
 * cookie reaches the page handler. It is stopped one layer in, where every
 * page calls `auth()` — which does run the DB-backed `jwt` callback — and
 * redirects to /login; API routes do their own `auth()` check and return 401.
 * Keeping the DB out of the proxy is deliberate: it runs on every matched
 * request, and the check it would duplicate already happens where the data
 * is actually read.
 */
export default NextAuth(authConfig).auth;

export const config = {
  // Protect everything except:
  //  - Auth.js's own endpoints and the registration endpoint
  //  - restoring a backup and uploading a cover, which check the session
  //    themselves (and against the database, so a revoked one is refused).
  //    A request the proxy sees has its body copied into memory first, and
  //    cut off at 10 MB: a bigger backup reached the restore as a broken zip.
  //    Only the upload address itself is left out, not the cover files whose
  //    names begin "upload-", which still need a session.
  //  - Next.js internals and static assets
  //  - the PWA manifest and app icons (fetched without credentials on install)
  matcher: [
    "/((?!api/auth|api/register|api/import$|api/covers/upload$|_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|apple-icon.png|icons/).*)",
  ],
};
