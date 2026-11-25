import NextAuth from "next-auth";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { authConfig } from "@/auth.config";
import { makeNonce, pagePolicy } from "@/lib/csp";

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
const authProxy = NextAuth(authConfig).auth as unknown as (
  req: NextRequest,
  ev: NextFetchEvent,
) => Promise<Response>;

/**
 * And every page gets its Content-Security-Policy here (lib/csp.ts), with a
 * nonce of its own: Next marks its inline scripts with the nonce it finds
 * in the policy on the request, and the root layout marks the theme's
 * pre-paint script with `x-nonce`. API routes keep the headers they set
 * themselves (the monthly email's pages send stricter ones).
 */
export default async function proxy(req: NextRequest, ev: NextFetchEvent): Promise<Response> {
  const res = await authProxy(req, ev);
  // A redirect to /login renders nothing here, and an API route isn't a page.
  if (res.headers.get("x-middleware-next") !== "1" || req.nextUrl.pathname.startsWith("/api/")) return res;

  const nonce = makeNonce();
  const policy = pagePolicy(nonce);
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("content-security-policy", policy);
  requestHeaders.set("x-nonce", nonce);
  const page = NextResponse.next({ request: { headers: requestHeaders } });
  // The session cookie, when the auth layer renewed it.
  for (const cookie of res.headers.getSetCookie()) page.headers.append("set-cookie", cookie);
  page.headers.set("Content-Security-Policy", policy);
  return page;
}

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
  //  - the pictures of the themes that bring their own (public/themes), which
  //    the sign-in pages show too
  //  - the monthly email's "Stop these emails" link, which is opened from
  //    a mail app with no session and checks a key of its own instead
  //  - the service worker (and push-sw.js, its old name), which a redirect
  //    to /login would keep from installing, and the list of the build's
  //    files it keeps: neither holds anything private. (The page it shows
  //    offline is let through by auth.config.ts instead, so it gets its
  //    Content-Security-Policy here like every other page.)
  matcher: [
    "/((?!api/auth|api/register|api/import$|api/covers/upload$|api/offline/assets$|api/email/unsubscribe$|_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|apple-icon.png|icons/|themes/|sw.js$|push-sw.js$).*)",
  ],
};
