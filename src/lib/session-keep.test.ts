import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { keepSessionProof, keptVersion } from "@/lib/session-keep";

describe("keeping this session when signing out everywhere else", () => {
  const secret = process.env.AUTH_SECRET;
  beforeEach(() => {
    process.env.AUTH_SECRET = "test-secret";
  });
  afterEach(() => {
    process.env.AUTH_SECRET = secret;
  });

  it("moves this account's session to the new version", () => {
    const proof = keepSessionProof("user1", 4, 1000)!;
    expect(keptVersion(proof, "user1", 1000)).toBe(4);
  });

  it("refuses another account, a late proof, a changed one and junk", () => {
    const proof = keepSessionProof("user1", 4, 1000)!;
    expect(keptVersion(proof, "user2", 1000)).toBeNull();
    expect(keptVersion(proof, "user1", 1000 + 61_000)).toBeNull();
    expect(keptVersion(proof.replace("user1.4", "user1.9"), "user1", 1000)).toBeNull();
    expect(keptVersion("user1.4.999999999999.abc", "user1", 1000)).toBeNull();
    expect(keptVersion(undefined, "user1", 1000)).toBeNull();
    expect(keptVersion(42, "user1", 1000)).toBeNull();
  });

  it("can't be made or checked without AUTH_SECRET", () => {
    const proof = keepSessionProof("user1", 4, 1000)!;
    delete process.env.AUTH_SECRET;
    expect(keepSessionProof("user1", 4, 1000)).toBeNull();
    expect(keptVersion(proof, "user1", 1000)).toBeNull();
  });
});
