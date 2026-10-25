import crypto from "node:crypto";

/**
 * Web Push with nothing but node:crypto: the message is encrypted for the
 * browser that subscribed (RFC 8291, "aes128gcm" content coding from RFC
 * 8188) and the request is signed with the server's own key (VAPID, RFC
 * 8292), which is all a push service (Google's, Mozilla's, Apple's) asks
 * for. Reading reminders are the only user (lib/reminders-run.ts).
 */

export function toBase64Url(buf: Uint8Array): string {
  return Buffer.from(buf).toString("base64url");
}

export function fromBase64Url(s: string): Buffer {
  return Buffer.from(s, "base64url");
}

/** The server's key pair for signing, both base64url: the public key as
 *  the 65-byte uncompressed point browsers take as applicationServerKey,
 *  the private key as its 32-byte scalar. */
export interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

export function generateVapidKeys(): VapidKeys {
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  return { publicKey: toBase64Url(ecdh.getPublicKey()), privateKey: toBase64Url(ecdh.getPrivateKey()) };
}

/** A P-256 key pair (raw point and scalar) as a KeyObject for signing. */
function signingKey(keys: VapidKeys): crypto.KeyObject {
  const pub = fromBase64Url(keys.publicKey);
  return crypto.createPrivateKey({
    key: {
      kty: "EC",
      crv: "P-256",
      x: toBase64Url(pub.subarray(1, 33)),
      y: toBase64Url(pub.subarray(33, 65)),
      d: keys.privateKey,
    },
    format: "jwk",
  });
}

/**
 * The Authorization header for a push to `endpoint` (RFC 8292): a JWT for
 * the push service's origin, valid for 12 hours, signed ES256, and the
 * public key it can be checked with.
 */
export function vapidAuthorization(
  endpoint: string,
  keys: VapidKeys,
  subject: string,
  now: Date = new Date(),
): string {
  const header = toBase64Url(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = toBase64Url(
    Buffer.from(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        exp: Math.floor(now.getTime() / 1000) + 12 * 60 * 60,
        sub: subject,
      }),
    ),
  );
  const signature = crypto.sign("sha256", Buffer.from(`${header}.${claims}`), {
    key: signingKey(keys),
    dsaEncoding: "ieee-p1363",
  });
  return `vapid t=${header}.${claims}.${toBase64Url(signature)}, k=${keys.publicKey}`;
}

function hmac(key: Uint8Array, ...data: Uint8Array[]): Buffer {
  const h = crypto.createHmac("sha256", key);
  for (const d of data) h.update(d);
  return h.digest();
}

/** HKDF's expand step for one block (all this needs: L ≤ 32). */
function expand(prk: Uint8Array, info: Uint8Array, length: number): Buffer {
  return hmac(prk, info, Buffer.from([1])).subarray(0, length);
}

/** Record size the body declares: one record holds any reminder. */
const RECORD_SIZE = 4096;

/** The most a payload may be: one record, less the delimiter and tag. */
export const MAX_PAYLOAD = RECORD_SIZE - 17;

/**
 * Encrypts `payload` for a browser's subscription (its p256dh and auth
 * keys, base64url) as one aes128gcm record (RFC 8291 section 4).
 * `salt` and `serverKey` are fresh each time; the tests pass the RFC's.
 */
export function encryptPayload(
  payload: Uint8Array,
  subscription: { p256dh: string; auth: string },
  fixed: { salt?: Uint8Array; serverPrivateKey?: Uint8Array } = {},
): Buffer {
  if (payload.length > MAX_PAYLOAD) throw new Error("Push payload too long");
  const uaPublic = fromBase64Url(subscription.p256dh);
  const authSecret = fromBase64Url(subscription.auth);
  if (uaPublic.length !== 65 || uaPublic[0] !== 4) throw new Error("Bad p256dh key");
  if (authSecret.length < 16) throw new Error("Bad auth secret");

  const ecdh = crypto.createECDH("prime256v1");
  if (fixed.serverPrivateKey) ecdh.setPrivateKey(fixed.serverPrivateKey);
  else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const ecdhSecret = ecdh.computeSecret(uaPublic);

  // The shared secret, mixed with the browser's auth secret and both keys.
  const prkKey = hmac(authSecret, ecdhSecret);
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]);
  const ikm = expand(prkKey, keyInfo, 32);

  const salt = fixed.salt ?? crypto.randomBytes(16);
  const prk = hmac(salt, ikm);
  const cek = expand(prk, Buffer.from("Content-Encoding: aes128gcm\0"), 16);
  const nonce = expand(prk, Buffer.from("Content-Encoding: nonce\0"), 12);

  // The last (and only) record ends with the delimiter 2, and no padding.
  const cipher = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const body = Buffer.concat([cipher.update(payload), cipher.update(Buffer.from([2])), cipher.final()]);

  const header = Buffer.alloc(16 + 4 + 1);
  Buffer.from(salt).copy(header, 0);
  header.writeUInt32BE(RECORD_SIZE, 16);
  header.writeUInt8(asPublic.length, 20);
  return Buffer.concat([header, asPublic, body, cipher.getAuthTag()]);
}

/** How a push service answered, for the caller to act on. */
export type PushOutcome = "sent" | "gone" | "failed";

/**
 * Sends one push. "gone" is the push service saying the subscription no
 * longer exists (404 or 410), which the caller should forget; anything
 * else that isn't a 2xx is "failed" and may work next time.
 */
export async function sendPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  options: { keys: VapidKeys; subject: string; topic?: string; ttlSeconds?: number },
  fetchImpl: typeof fetch = fetch,
): Promise<{ outcome: PushOutcome; status: number }> {
  const body = encryptPayload(Buffer.from(payload), subscription);
  const res = await fetchImpl(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: vapidAuthorization(subscription.endpoint, options.keys, options.subject),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: String(options.ttlSeconds ?? 12 * 60 * 60),
      Urgency: "normal",
      // A newer message with the same topic replaces one not yet delivered.
      ...(options.topic && { Topic: options.topic }),
    },
    body: new Uint8Array(body),
    // A push service answers itself; a redirect is not one to follow.
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
  });
  // Nothing in the answer is needed; reading it lets the connection go.
  await res.arrayBuffer().catch(() => {});
  if (res.ok) return { outcome: "sent", status: res.status };
  if (res.status === 404 || res.status === 410) return { outcome: "gone", status: res.status };
  return { outcome: "failed", status: res.status };
}
