import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from "vitest";
import { createHmac } from "crypto";

// qr-token reads AUTH_SECRET lazily inside secret(); set a deterministic test
// secret BEFORE importing the module. Never read .env / never hit prod.
const TEST_SECRET = "test-secret-do-not-use-in-prod";

let signQrToken: typeof import("@/lib/qr-token").signQrToken;
let verifyQrToken: typeof import("@/lib/qr-token").verifyQrToken;

const WINDOW_MS = 5 * 60 * 1000;
const GRACE_MS = 30 * 1000;
const SIG_LEN = 32;

beforeAll(async () => {
  process.env.AUTH_SECRET = TEST_SECRET;
  const mod = await import("@/lib/qr-token");
  signQrToken = mod.signQrToken;
  verifyQrToken = mod.verifyQrToken;
});

// Fixed point in time so window math is fully deterministic.
const NOW = 1_700_000_000_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("signQrToken", () => {
  it("returns a 3-part token of the form userId.exp.sig", () => {
    const { token } = signQrToken("user-1");
    const parts = token.split(".");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe("user-1");
    expect(Number(parts[1])).toBeGreaterThan(NOW);
    expect(parts[2]).toHaveLength(SIG_LEN);
  });

  it("expiresAt is in the future and aligned to a per-user window boundary", () => {
    const { expiresAt } = signQrToken("user-1");
    expect(expiresAt).toBeGreaterThan(NOW);
    expect(expiresAt - NOW).toBeLessThanOrEqual(WINDOW_MS);
  });

  it("is TOTP-style: every call within the same window yields the identical token", () => {
    const a = signQrToken("user-1");
    vi.setSystemTime(NOW + 1000);
    const b = signQrToken("user-1");
    expect(b.token).toBe(a.token);
    expect(b.expiresAt).toBe(a.expiresAt);
  });

  it("offsets the window grid per user (different users expire at different instants)", () => {
    const a = signQrToken("user-aaaa");
    const b = signQrToken("user-zzzz");
    // Same wall clock, but per-user offset should (very likely) differ.
    expect(a.expiresAt).not.toBe(b.expiresAt);
  });
});

describe("verifyQrToken — happy path", () => {
  it("a freshly signed token round-trips back to the userId", () => {
    const { token } = signQrToken("user-42");
    expect(verifyQrToken(token)).toBe("user-42");
  });

  it("verifies anywhere inside the active window", () => {
    const { token, expiresAt } = signQrToken("user-42");
    vi.setSystemTime(expiresAt - 1); // one ms before boundary
    expect(verifyQrToken(token)).toBe("user-42");
  });

  it("verifies within the 30s grace period past expiry", () => {
    const { token, expiresAt } = signQrToken("user-42");
    vi.setSystemTime(expiresAt + GRACE_MS - 1);
    expect(verifyQrToken(token)).toBe("user-42");
  });
});

describe("verifyQrToken — expiry", () => {
  it("rejects a token once past expiry + grace", () => {
    const { token, expiresAt } = signQrToken("user-42");
    vi.setSystemTime(expiresAt + GRACE_MS + 1);
    expect(verifyQrToken(token)).toBeNull();
  });

  it("rejects exactly at the grace boundary edge (> comparison)", () => {
    const { token, expiresAt } = signQrToken("user-42");
    // Date.now() > exp + GRACE_MS rejects; so exp+GRACE+1 must fail.
    vi.setSystemTime(expiresAt + GRACE_MS + 1);
    expect(verifyQrToken(token)).toBeNull();
  });

  it("rejects a far-future token signed long ago (window rolled over)", () => {
    const { token, expiresAt } = signQrToken("user-42");
    vi.setSystemTime(expiresAt + WINDOW_MS * 10);
    expect(verifyQrToken(token)).toBeNull();
  });
});

describe("verifyQrToken — tampering and garbage", () => {
  it("rejects a tampered signature", () => {
    const { token } = signQrToken("user-42");
    const [uid, exp, sig] = token.split(".");
    const flipped = sig[0] === "a" ? "b" : "a";
    const tampered = `${uid}.${exp}.${flipped}${sig.slice(1)}`;
    expect(verifyQrToken(tampered)).toBeNull();
  });

  it("rejects a tampered userId (signature no longer matches payload)", () => {
    const { token } = signQrToken("user-42");
    const [, exp, sig] = token.split(".");
    expect(verifyQrToken(`user-99.${exp}.${sig}`)).toBeNull();
  });

  it("rejects a tampered expiry (extending lifetime forges the payload)", () => {
    const { token, expiresAt } = signQrToken("user-42");
    const [uid, , sig] = token.split(".");
    const longer = expiresAt + WINDOW_MS * 100;
    expect(verifyQrToken(`${uid}.${longer}.${sig}`)).toBeNull();
  });

  it("rejects a token signed with the wrong secret", () => {
    const userId = "user-42";
    const exp = (Math.floor(NOW / WINDOW_MS) + 1) * WINDOW_MS;
    const payload = `${userId}.${exp}`;
    const wrongSig = createHmac("sha256", "the-wrong-secret").update(payload).digest("hex").slice(0, SIG_LEN);
    expect(verifyQrToken(`${payload}.${wrongSig}`)).toBeNull();
  });

  it("rejects malformed tokens (wrong part count / garbage)", () => {
    expect(verifyQrToken("")).toBeNull();
    expect(verifyQrToken("garbage")).toBeNull();
    expect(verifyQrToken("a.b")).toBeNull();
    expect(verifyQrToken("a.b.c.d")).toBeNull();
    expect(verifyQrToken("user.notanumber.sig")).toBeNull();
    expect(verifyQrToken("..")).toBeNull();
  });

  it("rejects a signature of the wrong length (timingSafeEqual throws -> null)", () => {
    const { token } = signQrToken("user-42");
    const [uid, exp] = token.split(".");
    expect(verifyQrToken(`${uid}.${exp}.short`)).toBeNull();
  });
});
