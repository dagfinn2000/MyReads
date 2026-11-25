/**
 * The Content-Security-Policy every page is sent with (proxy.ts). Scripts
 * run only from this site's own files and from the inline ones the server
 * itself marked with this response's nonce, so a script slipped into a
 * page some other way (a book's text, a note, an import) doesn't run.
 *
 * Styles, pictures and fonts stay open: the app uses inline styles
 * throughout, covers come from catalogue sites or any address a reader
 * pastes, and the reader's own CSS (Preferences) may load fonts or
 * pictures from anywhere.
 */

/** A fresh nonce for one response: 128 random bits, base64. */
export function makeNonce(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64");
}

/** The origin of AUTH_URL when it's set, where sign-in may send a form. */
function configuredOrigin(): string | null {
  const configured = process.env.AUTH_URL || process.env.NEXTAUTH_URL;
  if (!configured) return null;
  try {
    return new URL(configured).origin;
  } catch {
    return null;
  }
}

/** Where the browser itself asks for the weather (components/weather-*.tsx). */
const WEATHER_HOSTS = ["https://api.open-meteo.com", "https://geocoding-api.open-meteo.com"];

export function pagePolicy(nonce: string, dev = process.env.NODE_ENV === "development"): string {
  const site = configuredOrigin();
  const self = site ? `'self' ${site}` : "'self'";
  return [
    "default-src 'self'",
    // 'strict-dynamic': a script the page trusts may load the app's other
    // chunks. In development React also needs eval for its error overlay.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src * data: blob: 'unsafe-inline'",
    "img-src * data: blob:",
    "font-src * data:",
    // The development server's live reload talks over a websocket.
    `connect-src ${self} ${WEATHER_HOSTS.join(" ")}${dev ? " ws: wss:" : ""}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    `form-action ${self}`,
    "frame-ancestors 'none'",
  ].join("; ");
}
