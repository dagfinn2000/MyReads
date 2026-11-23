import { useSyncExternalStore } from "react";

/**
 * Passkeys in the browser: turning the server's options (base64url text)
 * into what navigator.credentials takes, and its answers back into text for
 * the server (lib/actions/passkeys.ts, the "passkey" sign-in in auth.ts).
 */

const toBytes = (s: string): ArrayBuffer => {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
};

const toText = (buf: ArrayBuffer | null): string => {
  if (!buf) return "";
  let bin = "";
  for (const byte of new Uint8Array(buf)) bin += String.fromCharCode(byte);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

/** Why passkeys can't be used here, or null when they can. */
export function passkeysUnavailable(): "unsupported" | "insecure" | null {
  if (typeof window === "undefined") return "unsupported";
  if (!window.isSecureContext) return "insecure";
  if (!window.PublicKeyCredential || !navigator.credentials) return "unsupported";
  return null;
}

const noChange = () => () => {};

/** passkeysUnavailable() for a component: "checking" while rendering on
 *  the server, before the browser can be asked. */
export function usePasskeySupport(): ReturnType<typeof passkeysUnavailable> | "checking" {
  return useSyncExternalStore(noChange, passkeysUnavailable, () => "checking");
}

/** True when this browser can offer a passkey in the username box. */
export async function passkeyAutofill(): Promise<boolean> {
  try {
    return (
      passkeysUnavailable() === null &&
      typeof PublicKeyCredential.isConditionalMediationAvailable === "function" &&
      (await PublicKeyCredential.isConditionalMediationAvailable())
    );
  } catch {
    return false;
  }
}

interface CreationOptions {
  challenge: string;
  rp: { name: string; id: string };
  user: { id: string; name: string; displayName: string };
  pubKeyCredParams: { type: "public-key"; alg: number }[];
  timeout: number;
  attestation: AttestationConveyancePreference;
  authenticatorSelection: AuthenticatorSelectionCriteria;
  excludeCredentials: { type: "public-key"; id: string; transports: string[] }[];
}

/** Makes a passkey; resolves to what addPasskey takes, or null when the
 *  reader closed the browser's window. */
export async function createPasskey(options: CreationOptions) {
  const credential = (await navigator.credentials.create({
    publicKey: {
      ...options,
      challenge: toBytes(options.challenge),
      user: { ...options.user, id: toBytes(options.user.id) },
      excludeCredentials: options.excludeCredentials.map((c) => ({
        type: c.type,
        id: toBytes(c.id),
        transports: c.transports as AuthenticatorTransport[],
      })),
    },
  })) as PublicKeyCredential | null;
  if (!credential) return null;
  const response = credential.response as AuthenticatorAttestationResponse;
  return {
    id: credential.id,
    clientDataJSON: toText(response.clientDataJSON),
    attestationObject: toText(response.attestationObject),
    transports: typeof response.getTransports === "function" ? response.getTransports() : [],
  };
}

interface RequestOptions {
  challenge: string;
  rpId: string;
  timeout: number;
  userVerification: UserVerificationRequirement;
}

/**
 * Asks for a passkey to sign in with: in the browser's own window, or with
 * `autofill` among the username box's suggestions (it waits there until
 * one is picked or `signal` stops it). Resolves to the answer as text for
 * signIn("passkey"), or null.
 */
export async function getPasskey(
  options: RequestOptions,
  { signal, autofill = false }: { signal?: AbortSignal; autofill?: boolean } = {},
): Promise<string | null> {
  const credential = (await navigator.credentials.get({
    publicKey: { ...options, challenge: toBytes(options.challenge), allowCredentials: [] },
    mediation: autofill ? "conditional" : "optional",
    signal,
  })) as PublicKeyCredential | null;
  if (!credential) return null;
  const response = credential.response as AuthenticatorAssertionResponse;
  return JSON.stringify({
    id: credential.id,
    clientDataJSON: toText(response.clientDataJSON),
    authenticatorData: toText(response.authenticatorData),
    signature: toText(response.signature),
    userHandle: response.userHandle ? toText(response.userHandle) : null,
  });
}

/** What to say when the browser's passkey window ends without one. */
export function passkeyErrorText(error: unknown): string | null {
  const name = error instanceof DOMException ? error.name : "";
  // Closed or timed out: the browser says nothing more, so neither do we.
  if (name === "NotAllowedError" || name === "AbortError") return null;
  if (name === "InvalidStateError") return "This device already has a passkey for your account.";
  if (name === "SecurityError") return "Passkeys can’t be used at this address.";
  return "That didn’t work. Try again.";
}
