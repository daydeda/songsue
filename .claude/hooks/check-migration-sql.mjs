#!/usr/bin/env node
/**
 * PreToolUse(Bash) guard for ActiveCAMT.
 *
 * Blocks `npm run db:migrate` (which runs src/db/migrate.ts against PROD, per .env →
 * Supabase) when the migration introduces a HARD-DESTRUCTIVE SQL statement that isn't
 * already on `main`/committed. db:migrate hits prod and a DELETE once wiped the whole
 * activity feed; guard.ts already gates db:reset/db:seed but db:migrate had no guard —
 * this fills that gap.
 *
 * Scope: scans only ADDED lines (git diff main...HEAD + uncommitted vs HEAD) for
 * src/db/migrate.ts and drizzle/, so the existing scoped DELETEs already on main don't
 * trip it. db:push is dev-only (drizzle-kit) and not guarded here.
 *
 * Opt-in escape hatch (mirrors guard.ts's CONFIRM=yes): prefix the command, e.g.
 *     CONFIRM=yes npm run db:migrate
 * to apply a reviewed, scoped destructive step per the /safe-deploy DELETE rule.
 *
 * Protocol: exit 2 + stderr = block; exit 0 = allow. Never throws to the caller.
 */
import { execSync } from "node:child_process";

async function main() {
  const input = await new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => (data += c));
    process.stdin.on("end", () => resolve(data));
    setTimeout(() => resolve(data), 5000); // don't hang if stdin never closes
  });

  let payload;
  try {
    payload = JSON.parse(input || "{}");
  } catch {
    process.exit(0);
  }

  if (payload.tool_name && payload.tool_name !== "Bash") process.exit(0);

  const command = payload?.tool_input?.command;
  if (typeof command !== "string" || !command) process.exit(0);

  // Only the prod migration command matters here.
  const isMigrate = /\bdb:migrate\b/.test(command) || /src\/db\/migrate\.ts/.test(command);
  if (!isMigrate) process.exit(0);

  // Explicit opt-in, same muscle memory as guard.ts.
  if (/\bCONFIRM=yes\b/.test(command)) process.exit(0);

  const repoCwd = payload?.cwd || process.cwd();
  const added = [];
  const collect = (range) => {
    try {
      const out = execSync(`git diff ${range} -U0 -- src/db/migrate.ts drizzle`, {
        encoding: "utf8",
        cwd: repoCwd,
        stdio: ["ignore", "pipe", "ignore"],
        maxBuffer: 10 * 1024 * 1024,
      });
      for (const line of out.split("\n")) {
        if (line.startsWith("+") && !line.startsWith("+++")) added.push(line.slice(1));
      }
    } catch {
      /* invalid range / not a git repo — skip this source */
    }
  };
  collect("main...HEAD"); // committed on this branch, not yet on main
  collect("HEAD"); // uncommitted working-tree changes

  if (added.length === 0) process.exit(0); // nothing new to inspect — don't block

  const RULES = [
    { re: /\bDROP\s+TABLE\b/i, what: "DROP TABLE" },
    { re: /\bDROP\s+COLUMN\b/i, what: "DROP COLUMN" },
    { re: /\bTRUNCATE\b/i, what: "TRUNCATE" },
    { re: /\bDELETE\s+FROM\b/i, what: "DELETE FROM" },
  ];

  const hits = [];
  for (const raw of added) {
    const line = raw.trim();
    if (!line || line.startsWith("--") || line.startsWith("//") || line.startsWith("*")) continue;
    for (const rule of RULES) if (rule.re.test(line)) hits.push({ what: rule.what, line });
  }

  if (hits.length === 0) process.exit(0);

  const detail = hits.map((h) => `  • ${h.what}: ${h.line.slice(0, 160)}`).join("\n");
  process.stderr.write(
    `⛔ BLOCKED: db:migrate runs against PRODUCTION (.env → Supabase) and this migration ` +
      `adds destructive SQL not yet on main:\n\n${detail}\n\n` +
      `Per CLAUDE.md / the /safe-deploy DELETE rule, don't add DROP/DELETE/TRUNCATE to a prod ` +
      `migration without explicit review — convert in place instead (e.g. set a column NULL ` +
      `rather than DELETE the row). A DELETE once wiped the whole activity feed.\n\n` +
      `If this is intentional, already scoped, and reviewed, re-run with the same opt-in ` +
      `guard.ts uses:\n    CONFIRM=yes npm run db:migrate\n`
  );
  process.exit(2);
}

main().catch(() => process.exit(0)); // never block on our own error
