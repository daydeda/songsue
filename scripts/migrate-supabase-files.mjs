// One-off CUTOVER script: download all Supabase Storage objects into the local
// volumes, so file uploads keep working after moving off Supabase Storage.
//
// WHY a script: on the shared swarm there is no host filesystem to copy bucket
// files onto, but the web container CAN reach both Supabase (outbound internet)
// and its own mounted volumes. So we pull every object down from inside it.
//
// Bucket → local path (matches the disk fallback in the upload code):
//   uploads      → ./public/uploads/                (public)
//   form-uploads → ./.uploads-private/form-uploads/ (PDPA, private)
//   slips        → ./.uploads-private/slips/        (PDPA, private)
//
// Run ONCE in the Portainer web-container console, passing the Supabase creds
// inline (they are NOT in the stack env on purpose):
//   SUPABASE_URL=https://<ref>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<service_role_key> \
//   node scripts/migrate-supabase-files.mjs
//
// SAFE TO RE-RUN: existing files are skipped, so a second run only fetches what
// is missing.
import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("❌ Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.");
  process.exit(1);
}

const supabase = createClient(url, key);

// [bucket, localDir]
const targets = [
  ["uploads", path.join(process.cwd(), "public", "uploads")],
  ["form-uploads", path.join(process.cwd(), ".uploads-private", "form-uploads")],
  ["slips", path.join(process.cwd(), ".uploads-private", "slips")],
];

const PAGE = 100;

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

async function migrateBucket(bucket, dir) {
  await mkdir(dir, { recursive: true });
  let offset = 0;
  let fetched = 0;
  let skipped = 0;
  for (;;) {
    const { data: list, error } = await supabase.storage
      .from(bucket)
      .list("", { limit: PAGE, offset, sortBy: { column: "name", order: "asc" } });
    if (error) {
      console.error(`  ❌ list ${bucket} failed:`, error.message);
      return;
    }
    if (!list || list.length === 0) break;

    for (const obj of list) {
      // `list("")` returns only top-level entries; our uploads are flat (UUID
      // filenames), so we don't recurse. A folder entry has no `id`.
      if (!obj.id) continue;
      const dest = path.join(dir, obj.name);
      if (await exists(dest)) { skipped++; continue; }

      const { data: blob, error: dlErr } = await supabase.storage.from(bucket).download(obj.name);
      if (dlErr || !blob) {
        console.error(`  ⚠️  download ${bucket}/${obj.name} failed:`, dlErr?.message);
        continue;
      }
      const buf = Buffer.from(await blob.arrayBuffer());
      await writeFile(dest, buf);
      fetched++;
    }

    if (list.length < PAGE) break;
    offset += PAGE;
  }
  console.log(`  ✅ ${bucket}: ${fetched} downloaded, ${skipped} already present → ${dir}`);
}

try {
  console.log("🔄 Downloading Supabase Storage buckets into local volumes…");
  for (const [bucket, dir] of targets) {
    await migrateBucket(bucket, dir);
  }
  console.log("✅ File migration complete.");
  process.exit(0);
} catch (err) {
  console.error("❌ File migration failed:", err);
  process.exit(1);
}
