import { createHash, createHmac, timingSafeEqual } from "crypto";

const WINDOW_MS = 5 * 60 * 1000;
// 32 hex chars = 128 bits of the HMAC — the floor for not worrying about
// brute-force, while keeping the QR payload small enough to scan fast.
// Bumping this invalidates in-flight tokens for at most one 5-min window.
const SIG_LEN = 32;
// Accept a token for a short grace period past its expiry. A student's screen
// shows a code that expires at the window boundary; a scan begun a second before
// expiry can reach the server just after it. Without grace, verification fails and
// the lookup falls through to legacy resolution, surfacing the confusing "Student
// not found" error. 30s comfortably covers scan + network latency.
const GRACE_MS = 30 * 1000;

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

/**
 * Per-user shift of the window grid. Without this, every client's token
 * expires at the same wall-clock second and hundreds of dashboards refetch
 * simultaneously (thundering herd on the token endpoint at large events).
 */
function windowOffset(userId: string): number {
  return createHash("sha256").update(userId).digest().readUInt32BE(0) % WINDOW_MS;
}

/**
 * Returns a short-lived token: `{userId}.{exp}.{hmac24}`.
 * Expiry snaps to a fixed 5-minute window boundary (TOTP-style), so every
 * request within the same window yields the identical token — and all copies
 * of it expire together the instant the window rolls over. A page refresh
 * therefore cannot leave a still-valid "old" QR behind, and multiple open
 * tabs/devices all display the same code. The grid is offset per user so
 * refetches spread evenly across the window instead of spiking together.
 */
export function signQrToken(userId: string): { token: string; expiresAt: number } {
  const offset = windowOffset(userId);
  const exp = (Math.floor((Date.now() - offset) / WINDOW_MS) + 1) * WINDOW_MS + offset;
  const payload = `${userId}.${exp}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("hex").slice(0, SIG_LEN);
  return { token: `${payload}.${sig}`, expiresAt: exp };
}

/**
 * Verifies signature and expiry. Returns the userId on success, null otherwise.
 * Uses timing-safe comparison to prevent side-channel attacks.
 */
export function verifyQrToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expStr, sig] = parts;
  const exp = Number(expStr);
  if (!userId || isNaN(exp) || Date.now() > exp + GRACE_MS) return null;
  const payload = `${userId}.${exp}`;
  const expected = createHmac("sha256", secret()).update(payload).digest("hex").slice(0, SIG_LEN);
  try {
    if (!timingSafeEqual(Buffer.from(sig, "utf8"), Buffer.from(expected, "utf8"))) return null;
  } catch {
    return null;
  }
  return userId;
}
