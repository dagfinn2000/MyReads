import crypto from "node:crypto";
import { userHandle, type Expected } from "@/lib/webauthn";

/**
 * For tests only: a small passkey authenticator in software, answering
 * the way a phone or password manager would, made with node:crypto and a
 * little CBOR encoder.
 */

export type Enc = number | string | Uint8Array | Enc[] | Map<Enc, Enc>;

function head(major: number, n: number): Buffer {
  if (n < 24) return Buffer.from([(major << 5) | n]);
  if (n < 0x100) return Buffer.from([(major << 5) | 24, n]);
  if (n < 0x10000) return Buffer.from([(major << 5) | 25, n >> 8, n & 0xff]);
  const b = Buffer.alloc(5);
  b[0] = (major << 5) | 26;
  b.writeUInt32BE(n, 1);
  return b;
}

export function cbor(v: Enc): Buffer {
  if (typeof v === "number") return v >= 0 ? head(0, v) : head(1, -1 - v);
  if (typeof v === "string") return Buffer.concat([head(3, Buffer.byteLength(v)), Buffer.from(v)]);
  if (v instanceof Uint8Array) return Buffer.concat([head(2, v.length), Buffer.from(v)]);
  if (Array.isArray(v)) return Buffer.concat([head(4, v.length), ...v.map(cbor)]);
  return Buffer.concat([head(5, v.size), ...[...v].flatMap(([k, x]) => [cbor(k), cbor(x)])]);
}

export const site: Expected = { origin: "https://books.example.org", rpId: "books.example.org" };
const sha256 = (s: string | Buffer) => crypto.createHash("sha256").update(s).digest();
export const b64 = (b: Buffer | Uint8Array) => Buffer.from(b).toString("base64url");

export function coseKey(pub: crypto.KeyObject, alg: number): Map<Enc, Enc> {
  const jwk = pub.export({ format: "jwk" });
  const raw = (s?: string) => Buffer.from(s ?? "", "base64url");
  if (jwk.kty === "EC") {
    const crv = { "P-256": 1, "P-384": 2, "P-521": 3 }[jwk.crv as string]!;
    return new Map<Enc, Enc>([[1, 2], [3, alg], [-1, crv], [-2, raw(jwk.x)], [-3, raw(jwk.y)]]);
  }
  if (jwk.kty === "OKP") return new Map<Enc, Enc>([[1, 1], [3, alg], [-1, 6], [-2, raw(jwk.x)]]);
  return new Map<Enc, Enc>([[1, 3], [3, alg], [-1, raw(jwk.n)], [-2, raw(jwk.e)]]);
}

export function keys(alg: number) {
  if (alg === -8) return crypto.generateKeyPairSync("ed25519");
  if (alg === -257) return crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const namedCurve = { [-7]: "P-256", [-35]: "P-384", [-36]: "P-521" }[alg as -7]!;
  return crypto.generateKeyPairSync("ec", { namedCurve });
}

function authData(rpId: string, flags: number, count: number, attested?: Buffer): Buffer {
  const c = Buffer.alloc(4);
  c.writeUInt32BE(count);
  return Buffer.concat([sha256(rpId), Buffer.from([flags]), c, attested ?? Buffer.alloc(0)]);
}

const AAGUID = Buffer.from("fbfc3007154e4ecc8c0b6e020557d7bd", "hex");

export function makePasskey(
  opts: { alg?: number; challenge?: string; origin?: string; rpId?: string; flags?: number; type?: string } = {},
) {
  const alg = opts.alg ?? -7;
  const { publicKey, privateKey } = keys(alg);
  const credId = crypto.randomBytes(16);
  const idLen = Buffer.from([0, credId.length]);
  const attested = Buffer.concat([AAGUID, idLen, credId, cbor(coseKey(publicKey, alg))]);
  const challenge = opts.challenge ?? b64(crypto.randomBytes(32));
  const clientData = JSON.stringify({
    type: opts.type ?? "webauthn.create",
    challenge,
    origin: opts.origin ?? site.origin,
  });
  const att = cbor(
    new Map<Enc, Enc>([
      ["fmt", "none"],
      ["attStmt", new Map()],
      ["authData", authData(opts.rpId ?? site.rpId, opts.flags ?? 0x45 | 0x08, 0, attested)],
    ]),
  );
  return {
    alg,
    privateKey,
    challenge,
    response: { id: b64(credId), clientDataJSON: b64(Buffer.from(clientData)), attestationObject: b64(att) },
  };
}

export function signIn(
  privateKey: crypto.KeyObject,
  alg: number,
  id: string,
  opts: { challenge?: string; origin?: string; rpId?: string; count?: number; flags?: number; user?: string } = {},
) {
  const challenge = opts.challenge ?? b64(crypto.randomBytes(32));
  const clientData = Buffer.from(
    JSON.stringify({ type: "webauthn.get", challenge, origin: opts.origin ?? site.origin, crossOrigin: false }),
  );
  const ad = authData(opts.rpId ?? site.rpId, opts.flags ?? 0x05, opts.count ?? 0);
  const data = Buffer.concat([ad, sha256(clientData)]);
  const hash = alg === -8 ? null : { [-7]: "sha256", [-35]: "sha384", [-36]: "sha512", [-257]: "sha256" }[alg as -7]!;
  return {
    id,
    clientDataJSON: b64(clientData),
    authenticatorData: b64(ad),
    signature: b64(crypto.sign(hash, data, privateKey)),
    userHandle: opts.user ?? userHandle("user-1"),
  };
}
