/**
 * Safety guard for destructive / privileged CLI scripts (db:reset, db:seed,
 * promote-admin, elevate-admin).
 *
 * Per the project's deploy setup, `.env` points at the PRODUCTION Supabase DB
 * and these scripts run with `tsx --env-file=.env`. A stray `npm run db:reset`
 * would therefore wipe production with no confirmation. This guard makes the
 * operator opt in explicitly whenever the target looks like a managed/remote DB.
 *
 * To proceed against such a database, set CONFIRM=yes, e.g.
 *   CONFIRM=yes npm run db:reset
 */
export function assertDestructiveAllowed(action: string): void {
  const url = process.env.DATABASE_URL ?? "";
  const looksRemote =
    /supabase\.(co|com)|amazonaws\.com|:6543|render\.com|neon\.tech/.test(url) ||
    process.env.NODE_ENV === "production";

  if (looksRemote && process.env.CONFIRM !== "yes") {
    console.error(
      `\n⛔ Refusing to run "${action}" against what looks like a PRODUCTION/remote database.\n` +
        `   DATABASE_URL host: ${safeHost(url)}\n` +
        `   If you really mean it, re-run with CONFIRM=yes:\n` +
        `     CONFIRM=yes <your command>\n`
    );
    process.exit(1);
  }
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}
