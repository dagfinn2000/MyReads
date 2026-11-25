import crypto from "node:crypto";

/**
 * The server's half of passkeys (WebAuthn), on node:crypto alone: reading
 * what a browser sends back when a passkey is made or used, and checking
 * it. Made with "attestation: none", so there is no maker's certificate to
 * check; what matters is that the key is bound to this site and that each
 * sign-in is signed by it.
 *
 * Spec: https://www.w3.org/TR/webauthn-3/ (sections 6.1 authenticator data,
 * 7.1 registering, 7.2 signing in).
 */

/** COSE algorithms a passkey may use here: ES256, ES384, ES512, EdDSA, RS256. */
export const PASSKEY_ALGORITHMS = [-7, -8, -257, -35, -36] as const;

const FLAG_USER_PRESENT = 0x01;
const FLAG_USER_VERIFIED = 0x04;
const FLAG_BACKUP_ELIGIBLE = 0x08;
const FLAG_ATTESTED_DATA = 0x40;

export class WebAuthnError extends Error {}

const fail = (why: string): never => {
  throw new WebAuthnError(why);
};

// ---------------------------------------------------------------------------
// CBOR, the little of it WebAuthn uses (RFC 8949: definite lengths only).

export type Cbor = number | bigint | boolean | null | undefined | string | Uint8Array | Cbor[] | Map<Cbor, Cbor>;

/** One CBOR item from `bytes` at `at`, and where the next one starts. */
export function decodeCbor(bytes: Uint8Array, at = 0, depth = 0): { value: Cbor; end: number } {
  if (depth > 16) fail("CBOR nested too deep");
  if (at >= bytes.length) fail("CBOR ends early");
  const first = bytes[at];
  const major = first >> 5;
  const info = first & 0x1f;
  let pos = at + 1;
  const need = (n: number) => {
    if (pos + n > bytes.length) fail("CBOR ends early");
  };
  let arg: number | bigint;
  if (info < 24) arg = info;
  else if (info === 24) {
    need(1);
    arg = bytes[pos];
    pos += 1;
  } else if (info === 25) {
    need(2);
    arg = (bytes[pos] << 8) | bytes[pos + 1];
    pos += 2;
  } else if (info === 26) {
    need(4);
    arg = new DataView(bytes.buffer, bytes.byteOffset + pos, 4).getUint32(0);
    pos += 4;
  } else if (info === 27) {
    need(8);
    const big = new DataView(bytes.buffer, bytes.byteOffset + pos, 8).getBigUint64(0);
    arg = big <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(big) : big;
    pos += 8;
  } else {
    return fail("CBOR indefinite lengths aren't used by WebAuthn");
  }

  const length = () => {
    if (typeof arg !== "number" || arg > bytes.length) fail("CBOR length out of range");
    return arg as number;
  };

  switch (major) {
    case 0:
      return { value: arg, end: pos };
    case 1:
      return { value: typeof arg === "bigint" ? -1n - arg : -1 - arg, end: pos };
    case 2: {
      const n = length();
      need(n);
      return { value: bytes.slice(pos, pos + n), end: pos + n };
    }
    case 3: {
      const n = length();
      need(n);
      return { value: new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(pos, pos + n)), end: pos + n };
    }
    case 4: {
      const n = length();
      const items: Cbor[] = [];
      for (let i = 0; i < n; i++) {
        const item = decodeCbor(bytes, pos, depth + 1);
        items.push(item.value);
        pos = item.end;
      }
      return { value: items, end: pos };
    }
    case 5: {
      const n = length();
      const map = new Map<Cbor, Cbor>();
      for (let i = 0; i < n; i++) {
        const key = decodeCbor(bytes, pos, depth + 1);
        const value = decodeCbor(bytes, key.end, depth + 1);
        map.set(key.value, value.value);
        pos = value.end;
      }
      return { value: map, end: pos };
    }
    case 6: // a tag: the item it wraps
      return decodeCbor(bytes, pos, depth + 1);
    default:
      if (info === 20) return { value: false, end: pos };
      if (info === 21) return { value: true, end: pos };
      if (info === 22) return { value: null, end: pos };
      if (info === 23) return { value: undefined, end: pos };
      return fail("CBOR value not used by WebAuthn");
  }
}

// ---------------------------------------------------------------------------
// Keys

const b64url = (b: Uint8Array) => Buffer.from(b).toString("base64url");

const EC_CURVES: Record<number, string> = { 1: "P-256", 2: "P-384", 3: "P-521" };

/** A COSE public key (as made by a passkey) as a node KeyObject, with its
 *  algorithm. Throws for a kind of key this server doesn't take. */
export function coseToKey(cose: Cbor): { key: crypto.KeyObject; algorithm: number } {
  if (!(cose instanceof Map)) return fail("Public key isn't a COSE key");
  const kty = cose.get(1);
  const alg = cose.get(3);
  if (typeof alg !== "number" || !(PASSKEY_ALGORITHMS as readonly number[]).includes(alg)) {
    return fail("Passkey uses an algorithm this server doesn't take");
  }
  const bytes = (label: number) => {
    const v = cose.get(label);
    return v instanceof Uint8Array ? v : fail("COSE key is missing a part");
  };
  let jwk: crypto.JsonWebKey;
  if (kty === 2) {
    const crv = EC_CURVES[cose.get(-1) as number] ?? fail("Unknown curve");
    if (crv !== ALGORITHM_CURVES.get(alg)) fail("Curve doesn't match the algorithm");
    jwk = { kty: "EC", crv, x: b64url(bytes(-2)), y: b64url(bytes(-3)) };
  } else if (kty === 1) {
    if (cose.get(-1) !== 6 || alg !== -8) fail("Only Ed25519 keys are taken");
    jwk = { kty: "OKP", crv: "Ed25519", x: b64url(bytes(-2)) };
  } else if (kty === 3) {
    if (alg !== -257) fail("RSA keys must use RS256");
    jwk = { kty: "RSA", n: b64url(bytes(-1)), e: b64url(bytes(-2)) };
  } else {
    return fail("Unknown key type");
  }
  try {
    return { key: crypto.createPublicKey({ key: jwk, format: "jwk" }), algorithm: alg };
  } catch {
    return fail("Public key couldn't be read");
  }
}

/** The hash each algorithm signs with; EdDSA hashes inside. */
const HASHES = new Map<number, string | null>([
  [-7, "sha256"],
  [-35, "sha384"],
  [-36, "sha512"],
  [-257, "sha256"],
  [-8, null],
]);

/** The curve each ECDSA algorithm is on. */
const ALGORITHM_CURVES = new Map<number, string>([
  [-7, "P-256"],
  [-35, "P-384"],
  [-36, "P-521"],
]);

/** Checks `signature` over `data` with a stored passkey key. */
export function verifySignature(
  algorithm: number,
  publicKeyDer: Uint8Array,
  data: Uint8Array,
  signature: Uint8Array,
): boolean {
  const key = crypto.createPublicKey({ key: Buffer.from(publicKeyDer), format: "der", type: "spki" });
  const hash = HASHES.get(algorithm);
  if (hash === undefined) return false;
  try {
    // ECDSA signatures arrive DER-encoded, node's default for EC keys.
    return crypto.verify(hash, data, key, signature);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// What the authenticator says

export interface AuthenticatorData {
  rpIdHash: Uint8Array;
  userPresent: boolean;
  userVerified: boolean;
  backupEligible: boolean;
  signCount: number;
  /** Only when a passkey is made. */
  attested?: { aaguid: string; credentialId: Uint8Array; publicKey: Cbor };
}

export function parseAuthenticatorData(data: Uint8Array): AuthenticatorData {
  if (data.length < 37) fail("Authenticator data too short");
  const flags = data[32];
  const out: AuthenticatorData = {
    rpIdHash: data.slice(0, 32),
    userPresent: (flags & FLAG_USER_PRESENT) !== 0,
    userVerified: (flags & FLAG_USER_VERIFIED) !== 0,
    backupEligible: (flags & FLAG_BACKUP_ELIGIBLE) !== 0,
    signCount: new DataView(data.buffer, data.byteOffset + 33, 4).getUint32(0),
  };
  if (flags & FLAG_ATTESTED_DATA) {
    if (data.length < 55) fail("Attested credential data too short");
    const hex = Buffer.from(data.subarray(37, 53)).toString("hex");
    const aaguid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    const idLength = (data[53] << 8) | data[54];
    if (idLength < 16 || idLength > 1023 || 55 + idLength > data.length) fail("Credential id out of range");
    const credentialId = data.slice(55, 55 + idLength);
    const { value } = decodeCbor(data, 55 + idLength);
    out.attested = { aaguid, credentialId, publicKey: value };
  }
  return out;
}

interface ClientData {
  type: string;
  challenge: string;
  origin: string;
  crossOrigin?: boolean;
}

function parseClientData(json: Uint8Array): ClientData {
  try {
    const data = JSON.parse(new TextDecoder().decode(json));
    if (typeof data?.type === "string" && typeof data.challenge === "string" && typeof data.origin === "string") {
      return data;
    }
  } catch {
    // falls through
  }
  return fail("Client data couldn't be read");
}

const sha256 = (data: Uint8Array | string) => crypto.createHash("sha256").update(data).digest();

/** Where this server expects passkeys from: the page's origin and the
 *  site's name for passkeys (its host name). */
export interface Expected {
  origin: string;
  rpId: string;
}

function checkClientData(client: ClientData, type: string, expected: Expected) {
  if (client.type !== type) fail("Wrong kind of response");
  if (client.origin !== expected.origin) fail("Response is from another site");
  if (client.crossOrigin) fail("Response came from inside another site");
}

function checkAuthData(auth: AuthenticatorData, expected: Expected) {
  if (!crypto.timingSafeEqual(auth.rpIdHash, sha256(expected.rpId))) fail("Passkey belongs to another site");
  if (!auth.userPresent) fail("No one was there to approve it");
  // And the device checked it was them (fingerprint, face, PIN or screen
  // lock), so a security key someone else picks up doesn't sign in alone.
  if (!auth.userVerified) fail("The device didn't check it was you");
}

// ---------------------------------------------------------------------------
// Making a passkey

export interface RegistrationResponse {
  /** base64url of the credential id, as the browser gave it. */
  id: string;
  clientDataJSON: string;
  attestationObject: string;
  transports?: string[];
}

export interface NewPasskey {
  id: string;
  publicKey: Uint8Array<ArrayBuffer>;
  algorithm: number;
  signCount: number;
  aaguid: string;
  backupEligible: boolean;
  /** The challenge it answered, for the caller to match against one it gave. */
  challenge: string;
}

/** Checks a new passkey made on this site and returns what to keep. */
export function verifyRegistration(res: RegistrationResponse, expected: Expected): NewPasskey {
  const client = parseClientData(Buffer.from(res.clientDataJSON, "base64url"));
  checkClientData(client, "webauthn.create", expected);
  const { value: attestation } = decodeCbor(Buffer.from(res.attestationObject, "base64url"));
  if (!(attestation instanceof Map)) return fail("Attestation couldn't be read");
  const authBytes = attestation.get("authData");
  if (!(authBytes instanceof Uint8Array)) return fail("Attestation has no authenticator data");
  const auth = parseAuthenticatorData(authBytes);
  checkAuthData(auth, expected);
  if (!auth.attested) return fail("No passkey in the response");
  const id = b64url(auth.attested.credentialId);
  if (id !== res.id) fail("Passkey id doesn't match");
  const { key, algorithm } = coseToKey(auth.attested.publicKey);
  return {
    id,
    publicKey: new Uint8Array(key.export({ format: "der", type: "spki" })) as Uint8Array<ArrayBuffer>,
    algorithm,
    signCount: auth.signCount,
    aaguid: auth.attested.aaguid,
    backupEligible: auth.backupEligible,
    challenge: client.challenge,
  };
}

// ---------------------------------------------------------------------------
// Signing in with one

export interface AssertionResponse {
  id: string;
  clientDataJSON: string;
  authenticatorData: string;
  signature: string;
  userHandle?: string | null;
}

export interface StoredPasskey {
  publicKey: Uint8Array;
  algorithm: number;
  signCount: number;
  /** base64url of the account's WebAuthn user handle. */
  userHandle: string;
}

/**
 * Checks a sign-in with a stored passkey. Returns the challenge it answered
 * and the passkey's new signature count. Throws when anything is off,
 * including a count that went backwards: a sign of a copied key.
 */
export function verifyAssertion(
  res: AssertionResponse,
  stored: StoredPasskey,
  expected: Expected,
): { challenge: string; signCount: number; userVerified: boolean } {
  const clientBytes = Buffer.from(res.clientDataJSON, "base64url");
  const client = parseClientData(clientBytes);
  checkClientData(client, "webauthn.get", expected);
  const authBytes = Buffer.from(res.authenticatorData, "base64url");
  const auth = parseAuthenticatorData(authBytes);
  checkAuthData(auth, expected);
  if (res.userHandle && res.userHandle !== stored.userHandle) fail("Passkey is for another account");
  const signed = Buffer.concat([authBytes, sha256(clientBytes)]);
  if (!verifySignature(stored.algorithm, stored.publicKey, signed, Buffer.from(res.signature, "base64url"))) {
    fail("Signature doesn't match");
  }
  if ((auth.signCount > 0 || stored.signCount > 0) && auth.signCount <= stored.signCount) {
    fail("Passkey's counter went backwards");
  }
  return { challenge: client.challenge, signCount: auth.signCount, userVerified: auth.userVerified };
}

/** The WebAuthn user handle for an account: its id's bytes, base64url. */
export function userHandle(userId: string): string {
  return Buffer.from(userId, "utf8").toString("base64url");
}
