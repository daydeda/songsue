import { createHash, timingSafeEqual } from "crypto";

// Constant-time comparison; hashing first equalizes lengths so even the
// length of the secret doesn't leak through response timing. Mirrors
// src/app/api/cron/award-points/route.ts's safeEqual.
function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(
    createHash("sha256").update(a).digest(),
    createHash("sha256").update(b).digest()
  );
}

// Bearer-secret check for the ActiveCAMT → Songsue sync endpoints
// (src/app/api/integrations/activecamt/**). A genuinely new, cross-app trust
// boundary — deliberately NOT CRON_SECRET or AUTH_SECRET. Fails closed if the
// env var is unset, so a misconfigured deploy rejects every request rather
// than accepting everything.
export function isAuthorizedActiveCamtSync(req: Request): boolean {
  const authHeader = req.headers.get("authorization") ?? "";
  const secret = process.env.ACTIVECAMT_SYNC_SECRET;
  return Boolean(secret) && safeEqual(authHeader, `Bearer ${secret}`);
}
