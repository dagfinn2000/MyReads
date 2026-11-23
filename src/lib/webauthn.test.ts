import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  WebAuthnError,
  coseToKey,
  decodeCbor,
  parseAuthenticatorData,
  userHandle,
  verifyAssertion,
  verifyRegistration,
} from "@/lib/webauthn";
import { b64, cbor, coseKey, keys, makePasskey, signIn, site, type Enc } from "@/lib/webauthn-fake";

describe("decodeCbor", () => {
  it("reads the kinds WebAuthn uses", () => {
    const value = new Map<Enc, Enc>([
      [1, 2],
      [-3, 500],
      ["text", "é"],
      ["bytes", Buffer.from([1, 2, 3])],
      ["list", [70000, -70000]],
    ]);
    const { value: back, end } = decodeCbor(cbor(value));
    expect(end).toBe(cbor(value).length);
    expect(back).toBeInstanceOf(Map);
    const m = back as Map<unknown, unknown>;
    expect(m.get(1)).toBe(2);
    expect(m.get(-3)).toBe(500);
    expect(m.get("text")).toBe("é");
    expect([...(m.get("bytes") as Uint8Array)]).toEqual([1, 2, 3]);
    expect(m.get("list")).toEqual([70000, -70000]);
  });

  it("refuses what is cut short or nested without end", () => {
    expect(() => decodeCbor(cbor("hello").subarray(0, 3))).toThrow(WebAuthnError);
    expect(() => decodeCbor(Buffer.from([0x9f]))).toThrow(WebAuthnError);
    expect(() => decodeCbor(Buffer.alloc(40, 0x81))).toThrow(WebAuthnError);
  });
});

describe("coseToKey", () => {
  it("refuses algorithms and curves this server doesn't take", () => {
    const { publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
    expect(() => coseToKey(coseKey(publicKey, -999))).toThrow(WebAuthnError);
    expect(() => coseToKey(coseKey(publicKey, -35))).toThrow(/Curve/);
  });
});

describe("verifyRegistration and verifyAssertion", () => {
  for (const alg of [-7, -35, -36, -8, -257]) {
    it(`makes and signs in with a passkey (algorithm ${alg})`, () => {
      const made = makePasskey({ alg });
      const kept = verifyRegistration(made.response, site);
      expect(kept.id).toBe(made.response.id);
      expect(kept.algorithm).toBe(alg);
      expect(kept.challenge).toBe(made.challenge);
      expect(kept.aaguid).toBe("fbfc3007-154e-4ecc-8c0b-6e020557d7bd");
      expect(kept.backupEligible).toBe(true);

      const stored = { publicKey: kept.publicKey, algorithm: kept.algorithm, signCount: 0, userHandle: userHandle("user-1") };
      const res = signIn(made.privateKey, alg, kept.id, { challenge: "abc" });
      expect(verifyAssertion(res, stored, site)).toEqual({ challenge: "abc", signCount: 0, userVerified: true });
    });
  }

  it("refuses a passkey made for another site or page", () => {
    expect(() => verifyRegistration(makePasskey({ origin: "https://evil.example" }).response, site)).toThrow(/another site/);
    expect(() => verifyRegistration(makePasskey({ rpId: "evil.example" }).response, site)).toThrow(/another site/);
    expect(() => verifyRegistration(makePasskey({ type: "webauthn.get" }).response, site)).toThrow(/kind/);
    expect(() => verifyRegistration(makePasskey({ flags: 0x44 }).response, site)).toThrow(/approve/);
    const made = makePasskey();
    expect(() => verifyRegistration({ ...made.response, id: b64(Buffer.from("other-id-of-sixteen")) }, site)).toThrow(
      /id/,
    );
  });

  it("refuses a sign-in signed by another key, for another site, or for another account", () => {
    const made = makePasskey();
    const kept = verifyRegistration(made.response, site);
    const stored = { publicKey: kept.publicKey, algorithm: -7, signCount: 0, userHandle: userHandle("user-1") };
    const other = keys(-7).privateKey;
    expect(() => verifyAssertion(signIn(other, -7, kept.id), stored, site)).toThrow(/Signature/);
    expect(() => verifyAssertion(signIn(made.privateKey, -7, kept.id, { origin: "https://evil.example" }), stored, site)).toThrow(
      /another site/,
    );
    expect(() => verifyAssertion(signIn(made.privateKey, -7, kept.id, { rpId: "evil.example" }), stored, site)).toThrow(
      /another site/,
    );
    expect(() => verifyAssertion(signIn(made.privateKey, -7, kept.id, { user: userHandle("user-2") }), stored, site)).toThrow(
      /another account/,
    );
    expect(() => verifyAssertion(signIn(made.privateKey, -7, kept.id, { flags: 0x00 }), stored, site)).toThrow(/approve/);
  });

  it("refuses a sign-in whose counter didn't go up", () => {
    const made = makePasskey();
    const kept = verifyRegistration(made.response, site);
    const stored = { publicKey: kept.publicKey, algorithm: -7, signCount: 5, userHandle: userHandle("user-1") };
    expect(verifyAssertion(signIn(made.privateKey, -7, kept.id, { count: 6 }), stored, site).signCount).toBe(6);
    expect(() => verifyAssertion(signIn(made.privateKey, -7, kept.id, { count: 5 }), stored, site)).toThrow(/counter/);
    expect(() => verifyAssertion(signIn(made.privateKey, -7, kept.id, { count: 0 }), stored, site)).toThrow(/counter/);
  });

  it("reads the flags and the passkey from authenticator data", () => {
    const made = makePasskey();
    const att = decodeCbor(Buffer.from(made.response.attestationObject, "base64url")).value as Map<string, Uint8Array>;
    const parsed = parseAuthenticatorData(att.get("authData")!);
    expect(parsed.userPresent).toBe(true);
    expect(parsed.userVerified).toBe(true);
    expect(b64(parsed.attested!.credentialId)).toBe(made.response.id);
  });
});
