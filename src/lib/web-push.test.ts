import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  encryptPayload,
  fromBase64Url,
  generateVapidKeys,
  sendPush,
  toBase64Url,
  vapidAuthorization,
} from "@/lib/web-push";

// RFC 8291 Appendix A: the worked example of an encrypted push message.
const RFC = {
  plaintext: "When I grow up, I want to be a watermelon",
  asPrivate: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  uaPublic: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  auth: "BTBZMqHH6r4Tts7J_aSIgg",
  body:
    "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
};

/** A browser's side: a key pair and auth secret, and reading a message
 *  sent to them, the way a browser does (RFC 8291 section 3). */
function browser() {
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  const auth = crypto.randomBytes(16);
  const hmac = (key: Uint8Array, ...data: Uint8Array[]) => {
    const h = crypto.createHmac("sha256", key);
    for (const d of data) h.update(d);
    return h.digest();
  };
  return {
    subscription: { p256dh: toBase64Url(ecdh.getPublicKey()), auth: toBase64Url(auth) },
    decrypt(body: Buffer): string {
      const salt = body.subarray(0, 16);
      const idlen = body[20];
      const asPublic = body.subarray(21, 21 + idlen);
      const record = body.subarray(21 + idlen);
      const secret = ecdh.computeSecret(asPublic);
      const info = Buffer.concat([Buffer.from("WebPush: info\0"), ecdh.getPublicKey(), asPublic]);
      const ikm = hmac(hmac(auth, secret), info, Buffer.from([1]));
      const prk = hmac(salt, ikm);
      const cek = hmac(prk, Buffer.from("Content-Encoding: aes128gcm\0"), Buffer.from([1])).subarray(0, 16);
      const nonce = hmac(prk, Buffer.from("Content-Encoding: nonce\0"), Buffer.from([1])).subarray(0, 12);
      const decipher = crypto.createDecipheriv("aes-128-gcm", cek, nonce);
      decipher.setAuthTag(record.subarray(record.length - 16));
      const plain = Buffer.concat([decipher.update(record.subarray(0, record.length - 16)), decipher.final()]);
      expect(plain[plain.length - 1]).toBe(2); // the last record's delimiter
      return plain.subarray(0, plain.length - 1).toString();
    },
  };
}

describe("encryptPayload", () => {
  it("matches the RFC's worked example byte for byte", () => {
    const body = encryptPayload(
      Buffer.from(RFC.plaintext),
      { p256dh: RFC.uaPublic, auth: RFC.auth },
      { salt: fromBase64Url(RFC.salt), serverPrivateKey: fromBase64Url(RFC.asPrivate) },
    );
    expect(toBase64Url(body)).toBe(RFC.body);
  });

  it("is read back by the browser it was made for, and differs every time", () => {
    const b = browser();
    const one = encryptPayload(Buffer.from("Time to read"), b.subscription);
    const two = encryptPayload(Buffer.from("Time to read"), b.subscription);
    expect(b.decrypt(one)).toBe("Time to read");
    expect(b.decrypt(two)).toBe("Time to read");
    expect(one.equals(two)).toBe(false);
  });

  it("refuses keys that aren't a browser's, and a payload too long to send", () => {
    const b = browser();
    expect(() => encryptPayload(Buffer.from("x"), { ...b.subscription, p256dh: "AAAA" })).toThrow();
    expect(() => encryptPayload(Buffer.from("x"), { ...b.subscription, auth: "AAAA" })).toThrow();
    expect(() => encryptPayload(Buffer.alloc(5000), b.subscription)).toThrow("too long");
  });
});

describe("vapidAuthorization", () => {
  it("signs a token for the push service's origin with the server's key", () => {
    const keys = generateVapidKeys();
    const now = new Date("2026-10-25T18:00:00Z");
    const header = vapidAuthorization("https://push.example.com/send/abc?x=1", keys, "mailto:me@example.com", now);
    const m = header.match(/^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(\S+)$/)!;
    expect(m).not.toBeNull();
    expect(m[4]).toBe(keys.publicKey);
    expect(JSON.parse(fromBase64Url(m[1]).toString())).toEqual({ typ: "JWT", alg: "ES256" });
    expect(JSON.parse(fromBase64Url(m[2]).toString())).toEqual({
      aud: "https://push.example.com",
      exp: now.getTime() / 1000 + 12 * 3600,
      sub: "mailto:me@example.com",
    });
    const pub = fromBase64Url(keys.publicKey);
    const verifier = crypto.createPublicKey({
      key: { kty: "EC", crv: "P-256", x: toBase64Url(pub.subarray(1, 33)), y: toBase64Url(pub.subarray(33)) },
      format: "jwk",
    });
    const ok = crypto.verify(
      "sha256",
      Buffer.from(`${m[1]}.${m[2]}`),
      { key: verifier, dsaEncoding: "ieee-p1363" },
      fromBase64Url(m[3]),
    );
    expect(ok).toBe(true);
  });
});

describe("sendPush", () => {
  function fakeService(status: number) {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(null, { status });
    }) as unknown as typeof fetch;
    return { calls, fetchImpl };
  }

  it("posts the encrypted message with the headers a push service asks for", async () => {
    const b = browser();
    const service = fakeService(201);
    const res = await sendPush(
      { endpoint: "https://push.example.com/send/abc", ...b.subscription },
      '{"title":"Time to read"}',
      { keys: generateVapidKeys(), subject: "mailto:me@example.com", topic: "reading-reminder" },
      service.fetchImpl,
    );
    expect(res).toEqual({ outcome: "sent", status: 201 });
    const { url, init } = service.calls[0];
    expect(url).toBe("https://push.example.com/send/abc");
    const headers = init.headers as Record<string, string>;
    expect(headers["Content-Encoding"]).toBe("aes128gcm");
    expect(headers.TTL).toBe("43200");
    expect(headers.Topic).toBe("reading-reminder");
    expect(headers.Authorization).toMatch(/^vapid t=/);
    expect(init.redirect).toBe("manual");
    expect(b.decrypt(Buffer.from(init.body as Uint8Array))).toBe('{"title":"Time to read"}');
  });

  it("tells a subscription that's gone from one that failed for now", async () => {
    const b = browser();
    const send = (status: number) =>
      sendPush(
        { endpoint: "https://push.example.com/x", ...b.subscription },
        "{}",
        { keys: generateVapidKeys(), subject: "mailto:me@example.com" },
        fakeService(status).fetchImpl,
      );
    expect((await send(410)).outcome).toBe("gone");
    expect((await send(404)).outcome).toBe("gone");
    expect((await send(429)).outcome).toBe("failed");
    expect((await send(302)).outcome).toBe("failed");
  });
});
