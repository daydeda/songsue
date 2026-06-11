import { createHmac, timingSafeEqual } from "crypto";

const TTL_MS = 5 * 60 * 1000;
const SIG_LEN = 24;

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

/**
 * Returns a short-lived token: `{userId}.{exp}.{hmac24}`.
 * Safe to embed in a QR code — expires in 5 minutes.
 */
export function signQrToken(userId: string): string {
  const exp = Date.now() + TTL_MS;
  const payload = `${userId}.${exp}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("hex").slice(0, SIG_LEN);
  return `${payload}.${sig}`;
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
  if (!userId || isNaN(exp) || Date.now() > exp) return null;
  const payload = `${userId}.${exp}`;
  const expected = createHmac("sha256", secret()).update(payload).digest("hex").slice(0, SIG_LEN);
  try {
    if (!timingSafeEqual(Buffer.from(sig, "utf8"), Buffer.from(expected, "utf8"))) return null;
  } catch {
    return null;
  }
  return userId;
}
