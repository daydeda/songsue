// One-off CUTOVER script: Supabase Storage public URLs → local-disk paths.
//
// After migrating off Supabase to the self-hosted Docker stack, rows in the DB
// still hold absolute public URLs like
//   https://<ref>.supabase.co/storage/v1/object/public/uploads/<file>
// but the self-hosted upload code (no SUPABASE_URL set) serves the same files
// from local disk at /uploads/<file>. This script strips the Supabase prefix in
// place so those images resolve after cutover.
//
// SCOPE: only the PUBLIC "uploads" bucket columns. It deliberately does NOT touch:
//   - users.image          → external Google avatar URLs, not our storage
//   - shop_orders.slip_path → private "slips" bucket; stored as a key, served via
//                             the auth-guarded endpoint, never an absolute URL
//   - form-uploads          → private; referenced by key, not a public URL
//
// SAFE TO RE-RUN: each statement only matches rows that still contain the
// Supabase prefix, so a second run is a no-op. Run it AFTER the data import,
// against the NEW self-hosted DB only.
//
// Usage (on the server):
//   sudo docker compose exec web node scripts/rewrite-storage-urls.mjs
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("❌ DATABASE_URL is not set. Run inside the web container (it injects it).");
  process.exit(1);
}

// HARD GUARD: never run against Supabase. The live Vercel site still serves images
// FROM Supabase, so rewriting those URLs there would break every poster/avatar.
if (/supabase/i.test(url)) {
  console.error("❌ DATABASE_URL points at Supabase. This script only runs against the");
  console.error("   self-hosted DB after cutover. Refusing to run.");
  process.exit(1);
}

// Matches any "<scheme>://<host>/storage/v1/object/public/uploads/" prefix.
const PREFIX_RE = "^https?://[^/]+/storage/v1/object/public/uploads/";
const LIKE = "%/storage/v1/object/public/uploads/%";

const sql = postgres(url, { max: 1, prepare: !url.includes(":6543"), idle_timeout: 5, connect_timeout: 15 });

// [table, textColumn] — plain text URL columns
const textCols = [
  ["events", "image_url"],
  ["shop_products", "image_url"],
  ["shop_settings", "qr_image_url"],
];

// [table, jsonbArrayColumn] — jsonb arrays of URL strings
const jsonbCols = [
  ["events", "image_urls"],
  ["shop_products", "image_urls"],
];

try {
  console.log(`🔄 Rewriting Supabase 'uploads' URLs → /uploads/ on ${url.replace(/:[^:@/]+@/, ":****@")}`);

  for (const [table, col] of textCols) {
    const res = await sql.unsafe(
      `UPDATE ${table}
         SET ${col} = regexp_replace(${col}, $1, '/uploads/')
       WHERE ${col} LIKE $2`,
      [PREFIX_RE, LIKE]
    );
    console.log(`  ✅ ${table}.${col}: ${res.count} row(s) rewritten`);
  }

  for (const [table, col] of jsonbCols) {
    const res = await sql.unsafe(
      `UPDATE ${table}
         SET ${col} = (
           SELECT jsonb_agg(regexp_replace(elem #>> '{}', $1, '/uploads/'))
           FROM jsonb_array_elements(${col}) AS elem
         )
       WHERE ${col} IS NOT NULL AND ${col}::text LIKE $2`,
      [PREFIX_RE, LIKE]
    );
    console.log(`  ✅ ${table}.${col}: ${res.count} row(s) rewritten`);
  }

  console.log("✅ URL rewrite complete.");
  await sql.end();
  process.exit(0);
} catch (err) {
  console.error("❌ URL rewrite failed:", err);
  await sql.end();
  process.exit(1);
}
