/**
 * Sending email, through the SMTP server whoever runs MyReads names in
 * SMTP_HOST and the settings beside it (.env.example). Today only the
 * monthly email uses it (lib/monthly-email-run.ts). Without SMTP_HOST
 * nothing is ever sent, and Preferences says email isn't set up here.
 *
 * nodemailer does the talking; it is loaded only when a message goes.
 * Server only: the form checks addresses with lib/email-address.ts.
 */

import { isEmailAddress } from "@/lib/email-address";

export interface MailConfig {
  host: string;
  port: number;
  /** TLS from the first byte (port 465). Otherwise the connection is
   *  upgraded with STARTTLS whenever the server offers it. */
  secure: boolean;
  /** Null for a server that takes mail without signing in (a relay on the
   *  same network). */
  user: string | null;
  password: string | null;
  /** The sender, "MyReads <books@example.com>". */
  from: string;
}

function envFlag(value: string | undefined): boolean | null {
  const v = value?.trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes" || v === "on") return true;
  if (v === "false" || v === "0" || v === "no" || v === "off") return false;
  return null;
}

/** SMTP_FROM as a sender: "books@example.com" gets the name MyReads, and
 *  "Name <books@example.com>" is kept as it is. Null when it isn't one. */
export function parseSender(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value || /[\r\n]/.test(value)) return null;
  if (isEmailAddress(value)) return `MyReads <${value}>`;
  const named = /^(.*?)\s*<([^<>]+)>$/.exec(value);
  if (!named || !isEmailAddress(named[2])) return null;
  const name = named[1].replace(/^"(.*)"$/, "$1").trim();
  if (/[<>]/.test(name)) return null;
  return name ? `"${name.replace(/["\\]/g, "")}" <${named[2]}>` : `MyReads <${named[2]}>`;
}

type Env = Record<string, string | undefined>;

/**
 * The mail server from the environment, or null when email is off: no
 * SMTP_HOST, or no sender (SMTP_FROM, else an SMTP_USER that is an
 * address).
 */
export function mailConfig(env: Env = process.env): MailConfig | null {
  const host = env.SMTP_HOST?.trim();
  if (!host) return null;
  const port = Number(env.SMTP_PORT?.trim() || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  const user = env.SMTP_USER?.trim() || null;
  const from = parseSender(env.SMTP_FROM) ?? (user && isEmailAddress(user) ? `MyReads <${user}>` : null);
  if (!from) return null;
  return {
    host,
    port,
    secure: envFlag(env.SMTP_SECURE) ?? port === 465,
    user,
    password: user ? (env.SMTP_PASSWORD ?? "") : null,
    from,
  };
}

/** Whether this server can send email. */
export function mailEnabled(env: Env = process.env): boolean {
  return mailConfig(env) !== null;
}

/** What is wrong with the mail settings, for the log at start: SMTP_HOST
 *  given, but something else keeps email off. Empty when all is well, and
 *  when email simply isn't set up. */
export function mailEnvProblems(env: Env = process.env): string[] {
  if (!env.SMTP_HOST?.trim()) return [];
  const problems: string[] = [];
  const port = Number(env.SMTP_PORT?.trim() || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    problems.push(`SMTP_PORT "${env.SMTP_PORT}" isn't a port number, so email is off.`);
  }
  const user = env.SMTP_USER?.trim();
  if (env.SMTP_FROM?.trim() && !parseSender(env.SMTP_FROM)) {
    problems.push(`SMTP_FROM "${env.SMTP_FROM}" isn't an address, so email is off.`);
  } else if (!env.SMTP_FROM?.trim() && !(user && isEmailAddress(user))) {
    problems.push("Set SMTP_FROM to the address email comes from; until then email is off.");
  }
  return problems;
}

/** A picture in the message that its HTML shows as `cid:<cid>`. */
export interface InlineImage {
  cid: string;
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  inline?: InlineImage[];
  headers?: Record<string, string>;
}

export type SendMail = (message: MailMessage) => Promise<void>;

/** Something went wrong sending; `message` is fit to show the reader. */
export class MailError extends Error {}

/** What a failure from the mail server means, in words a reader can act
 *  on (or pass on to whoever runs the server). */
export function mailErrorText(err: unknown, config: Pick<MailConfig, "host" | "port">): string {
  const e = (err ?? {}) as { code?: string; responseCode?: number };
  switch (e.code) {
    case "EAUTH":
      return "The mail server didn’t take the username and password (SMTP_USER, SMTP_PASSWORD).";
    case "ETIMEDOUT":
    case "ECONNECTION":
    case "ESOCKET":
    case "EDNS":
    case "ECONNREFUSED":
      return `Couldn’t reach the mail server at ${config.host}:${config.port}.`;
    case "ETLS":
      return `Couldn’t talk securely to the mail server at ${config.host}:${config.port}. Check SMTP_PORT and SMTP_SECURE.`;
    case "EENVELOPE":
      return "The mail server wouldn’t send to that address.";
  }
  if (e.responseCode && e.responseCode >= 500) return "The mail server refused the message.";
  return "The mail server didn’t take the message. Try again later.";
}

/**
 * Sends one message, or throws a MailError saying why it couldn't. The
 * connection is made for the message and closed after it: the server
 * sends a handful a month, not enough to keep one open.
 */
export async function sendMail(message: MailMessage, config: MailConfig | null = mailConfig()): Promise<void> {
  if (!config) throw new MailError("Email isn’t set up on this server.");
  if (!isEmailAddress(message.to)) throw new MailError("That isn’t an email address.");
  const { default: nodemailer } = await import("nodemailer");
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user ? { user: config.user, pass: config.password ?? "" } : undefined,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
    // The message carries everything it needs: never let it read a file
    // or fetch an address on the server's behalf.
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  try {
    await transport.sendMail({
      from: config.from,
      to: message.to,
      subject: message.subject.replace(/[\r\n]+/g, " "),
      text: message.text,
      html: message.html,
      headers: message.headers,
      attachments: (message.inline ?? []).map((img) => ({
        cid: img.cid,
        filename: img.filename,
        content: img.content,
        contentType: img.contentType,
        contentDisposition: "inline" as const,
      })),
    });
  } catch (err) {
    console.warn(`[myreads] email not sent: ${err instanceof Error ? err.message : String(err)}`);
    throw new MailError(mailErrorText(err, config));
  } finally {
    transport.close();
  }
}
