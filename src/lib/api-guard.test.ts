import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The shelf scan spends the same per-user lookup budget as the metadata
 * routes, but needs "wait this long" rather than a 429, and spends several
 * units at once. The session isn't under test, so auth is stubbed.
 */

vi.mock("@/auth", () => ({ auth: async () => null }));

const { metadataBudgetUsed, spendMetadataBudget, takeMetadataBudget } = await import(
  "@/lib/api-guard"
);

let userId = "";

beforeEach(() => {
  vi.useFakeTimers();
  // A fresh user per test, so each starts with a full budget.
  userId = `user-${Math.random()}`;
});
afterEach(() => {
  vi.useRealTimers();
});

describe("takeMetadataBudget", () => {
  it("allows 90 lookups a minute and says how many were used", () => {
    expect(takeMetadataBudget(userId)).toEqual({ ok: true, used: 1 });
    expect(takeMetadataBudget(userId, 2)).toEqual({ ok: true, used: 3 });
    for (let i = 3; i < 90; i++) expect(takeMetadataBudget(userId).ok).toBe(true);
    expect(metadataBudgetUsed(userId)).toBe(90);
  });

  it("then refuses with the wait until the minute is up, without counting the refusal", () => {
    for (let i = 0; i < 90; i++) takeMetadataBudget(userId);
    vi.advanceTimersByTime(20_000);

    const refused = takeMetadataBudget(userId);
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.retryInMs).toBeGreaterThan(0);
    expect(refused.retryInMs).toBeLessThanOrEqual(60_000);
    expect(refused.retryInMs).toBe(40_000);
    expect(metadataBudgetUsed(userId)).toBe(90);

    vi.advanceTimersByTime(40_000);
    expect(takeMetadataBudget(userId)).toEqual({ ok: true, used: 1 });
  });

  it("takes nothing when fewer units are left than asked for", () => {
    for (let i = 0; i < 89; i++) takeMetadataBudget(userId);
    expect(takeMetadataBudget(userId, 2).ok).toBe(false);
    expect(metadataBudgetUsed(userId)).toBe(89);
    expect(takeMetadataBudget(userId, 1).ok).toBe(true);
  });

  it("shares the budget with the metadata routes", () => {
    for (let i = 0; i < 90; i++) takeMetadataBudget(userId);
    expect(spendMetadataBudget(userId)?.status).toBe(429);
  });
});
