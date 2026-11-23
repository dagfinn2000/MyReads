/**
 * Email addresses as MyReads takes them (the monthly email's, in
 * Preferences): one plain address, something@somewhere.tld, with nothing
 * in it that could start a second header or name a second recipient. Pure,
 * so the form and the server check them the same way.
 */

const ADDRESS = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:".]+$/;

/** The longest address a mailbox can have (RFC 5321). */
export const EMAIL_ADDRESS_MAX = 254;

/** Whether `value` is one plain email address. */
export function isEmailAddress(value: string): boolean {
  return value.length <= EMAIL_ADDRESS_MAX && ADDRESS.test(value) && !value.includes("..");
}

/** An address as typed, made tidy: trimmed, or "" when it isn't one. */
export function parseEmailAddress(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const value = raw.trim();
  return isEmailAddress(value) ? value : "";
}
