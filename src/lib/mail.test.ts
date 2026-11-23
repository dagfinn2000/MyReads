import { describe, expect, it } from "vitest";
import { mailConfig, mailEnabled, mailEnvProblems, mailErrorText, parseSender } from "@/lib/mail";

describe("the mail server settings", () => {
  it("are off without SMTP_HOST", () => {
    expect(mailConfig({})).toBeNull();
    expect(mailEnabled({ SMTP_FROM: "books@example.com" })).toBe(false);
    expect(mailEnvProblems({})).toEqual([]);
  });

  it("take a host, a sender and a login, with STARTTLS on 587 by default", () => {
    expect(
      mailConfig({
        SMTP_HOST: " smtp.example.com ",
        SMTP_USER: "me",
        SMTP_PASSWORD: "pw",
        SMTP_FROM: "books@example.com",
      }),
    ).toEqual({
      host: "smtp.example.com",
      port: 587,
      secure: false,
      user: "me",
      password: "pw",
      from: "MyReads <books@example.com>",
    });
  });

  it("use TLS from the start on 465, or when SMTP_SECURE says so", () => {
    expect(mailConfig({ SMTP_HOST: "h", SMTP_PORT: "465", SMTP_FROM: "a@b.no" })?.secure).toBe(true);
    expect(mailConfig({ SMTP_HOST: "h", SMTP_PORT: "2465", SMTP_SECURE: "true", SMTP_FROM: "a@b.no" })?.secure).toBe(true);
    expect(mailConfig({ SMTP_HOST: "h", SMTP_PORT: "465", SMTP_SECURE: "false", SMTP_FROM: "a@b.no" })?.secure).toBe(false);
  });

  it("send without signing in when there's no SMTP_USER", () => {
    const config = mailConfig({ SMTP_HOST: "relay", SMTP_PORT: "25", SMTP_FROM: "a@b.no", SMTP_PASSWORD: "ignored" });
    expect(config).toMatchObject({ port: 25, user: null, password: null });
  });

  it("send from SMTP_USER when it's an address and SMTP_FROM isn't set", () => {
    expect(mailConfig({ SMTP_HOST: "h", SMTP_USER: "me@gmail.com" })?.from).toBe("MyReads <me@gmail.com>");
    expect(mailConfig({ SMTP_HOST: "h", SMTP_USER: "me" })).toBeNull();
    expect(mailEnvProblems({ SMTP_HOST: "h", SMTP_USER: "me" })).toEqual([
      "Set SMTP_FROM to the address email comes from; until then email is off.",
    ]);
  });

  it("say what's wrong with a bad port or sender", () => {
    expect(mailConfig({ SMTP_HOST: "h", SMTP_PORT: "lots", SMTP_FROM: "a@b.no" })).toBeNull();
    expect(mailEnvProblems({ SMTP_HOST: "h", SMTP_PORT: "lots", SMTP_FROM: "a@b.no" })[0]).toContain("SMTP_PORT");
    expect(mailEnvProblems({ SMTP_HOST: "h", SMTP_FROM: "not an address" })[0]).toContain("SMTP_FROM");
    expect(mailEnvProblems({ SMTP_HOST: "h", SMTP_FROM: "a@b.no" })).toEqual([]);
  });
});

describe("parseSender", () => {
  it("names a bare address MyReads and keeps a name given", () => {
    expect(parseSender("books@example.com")).toBe("MyReads <books@example.com>");
    expect(parseSender("My Books <books@example.com>")).toBe('"My Books" <books@example.com>');
    expect(parseSender('"Dagfinn\'s books" <books@example.com>')).toBe('"Dagfinn\'s books" <books@example.com>');
    expect(parseSender("<books@example.com>")).toBe("MyReads <books@example.com>");
  });

  it("refuses anything that isn't one sender", () => {
    expect(parseSender(undefined)).toBeNull();
    expect(parseSender("")).toBeNull();
    expect(parseSender("books")).toBeNull();
    expect(parseSender("a@b.no\r\nBcc: c@d.no")).toBeNull();
    expect(parseSender("Name <a@b.no>, Other <c@d.no>")).toBeNull();
  });
});

describe("mailErrorText", () => {
  const config = { host: "smtp.example.com", port: 587 };
  it("says what a failure means without the server's own words", () => {
    expect(mailErrorText({ code: "EAUTH" }, config)).toContain("username and password");
    expect(mailErrorText({ code: "ECONNECTION" }, config)).toBe("Couldn’t reach the mail server at smtp.example.com:587.");
    expect(mailErrorText({ code: "ETLS" }, config)).toContain("SMTP_SECURE");
    expect(mailErrorText({ code: "EENVELOPE" }, config)).toContain("address");
    expect(mailErrorText({ responseCode: 554 }, config)).toBe("The mail server refused the message.");
    expect(mailErrorText(new Error("?"), config)).toContain("Try again later");
  });
});
