// Unit tests for the proxy-aware circuit breaker (Prioritas 2).
//
// Verifies:
//   1. breakerKey() isolates proxy variants — different proxies get different
//      keys, direct traffic keeps the plain provider key (backward compat).
//   2. recordBreakerFailure on one proxy trips ONLY that proxy's breaker.
//   3. isCircuitOpen() for a different proxy (or direct) stays closed.
//   4. Same proxy key shares the breaker state.
//   5. resetBreaker() with no key resets all proxy variants for the provider.
import { describe, it, expect, beforeEach } from "vitest";
import {
  breakerKey, isCircuitOpen, isBreakerBlocking,
  recordBreakerFailure, recordBreakerSuccess, resetBreaker, getBreakerStates,
} from "open-sse/services/circuitBreaker.js";

const SETTINGS = {
  circuitBreaker: {
    enabled: true,
    failureThreshold: 3,
    windowMs: 60000,
    cooldownMs: 60000, // long so OPEN persists during the test
    halfOpenMaxCalls: 1,
  },
};

const proxyA = { connectionProxyEnabled: true, connectionProxyUrl: "http://proxy-a:8080", connectionProxyPoolId: "pool-a" };
const proxyB = { connectionProxyEnabled: true, connectionProxyUrl: "http://proxy-b:8080", connectionProxyPoolId: "pool-b" };
const direct = { connectionProxyEnabled: false };

beforeEach(() => {
  // Reset all breaker state between tests.
  resetBreaker("testprov");
});

describe("breakerKey", () => {
  it("different proxies → different keys; direct → plain provider key", () => {
    const keyA = breakerKey("testprov", proxyA);
    const keyB = breakerKey("testprov", proxyB);
    const keyDirect = breakerKey("testprov", direct);
    const keyNone = breakerKey("testprov");

    expect(keyA).not.toBe(keyB);
    expect(keyDirect).toBe("testprov");
    expect(keyNone).toBe("testprov"); // backward compat
  });

  it("same proxy pool → same key", () => {
    const k1 = breakerKey("testprov", proxyA);
    const k2 = breakerKey("testprov", { ...proxyA, connectionProxyUrl: "http://other:1" });
    expect(k1).toBe(k2); // keyed by pool id when present
  });
});

describe("proxy-aware breaker isolation", () => {
  it("failure on proxy A trips only proxy A, not proxy B or direct", () => {
    const keyA = breakerKey("testprov", proxyA);
    const keyB = breakerKey("testprov", proxyB);

    for (let i = 0; i < 3; i++) recordBreakerFailure("testprov", 502, SETTINGS, keyA);

    // Proxy A breaker OPEN → blocked.
    expect(isCircuitOpen("testprov", SETTINGS, keyA)).toBe(true);
    expect(isBreakerBlocking("testprov", SETTINGS, keyA)).toBe(true);
    // Proxy B + direct still healthy.
    expect(isCircuitOpen("testprov", SETTINGS, keyB)).toBe(false);
    expect(isCircuitOpen("testprov", SETTINGS, "testprov")).toBe(false);
  });

  it("success on proxy B does NOT reset proxy A's breaker", () => {
    const keyA = breakerKey("testprov", proxyA);
    const keyB = breakerKey("testprov", proxyB);

    for (let i = 0; i < 3; i++) recordBreakerFailure("testprov", 503, SETTINGS, keyA);
    expect(isCircuitOpen("testprov", SETTINGS, keyA)).toBe(true);

    recordBreakerSuccess("testprov", SETTINGS, keyB);
    // A stays open despite B succeeding — independent state per proxy.
    expect(isCircuitOpen("testprov", SETTINGS, keyA)).toBe(true);
    expect(isCircuitOpen("testprov", SETTINGS, keyB)).toBe(false);
  });

  it("direct traffic does not share state with proxied traffic", () => {
    const keyA = breakerKey("testprov", proxyA);

    for (let i = 0; i < 3; i++) recordBreakerFailure("testprov", 500, SETTINGS, keyA);
    expect(isCircuitOpen("testprov", SETTINGS, keyA)).toBe(true);
    expect(isCircuitOpen("testprov", SETTINGS, "testprov")).toBe(false); // direct OK
  });
});

describe("getBreakerStates + resetBreaker", () => {
  it("getBreakerStates includes proxy keys; resetBreaker() clears all variants", () => {
    const keyA = breakerKey("testprov", proxyA);
    const keyB = breakerKey("testprov", proxyB);
    for (let i = 0; i < 3; i++) recordBreakerFailure("testprov", 503, SETTINGS, keyA);
    recordBreakerFailure("testprov", 503, SETTINGS, keyB); // 1 failure on B — state exists

    const states = getBreakerStates();
    const providerKeys = states.filter((s) => s.provider.startsWith("testprov")).map((s) => s.provider);
    expect(providerKeys).toContain(keyA);
    expect(providerKeys).toContain(keyB);

    resetBreaker("testprov"); // no key → reset all variants
    expect(isCircuitOpen("testprov", SETTINGS, keyA)).toBe(false);
    expect(isCircuitOpen("testprov", SETTINGS, keyB)).toBe(false);
  });
});
