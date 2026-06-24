import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import path from "path";

// No `force-dynamic`: the [name] segment already makes this dynamic per request,
// and we WANT the immutable Cache-Control below to survive (force-dynamic stomps
// it to max-age=0). Filenames are content-unique UUIDs, so caching hard is safe.

// Public upload serving. On the self-hosted deploy (SUPABASE_* unset) /api/upload
// writes posters/product-images/avatars to public/uploads at RUNTIME and returns
// a /uploads/<file> URL. But `next start` only serves files that were in public/
// at BUILD time — runtime-written files 404. So those URLs are rewritten here
// (next.config.ts: /uploads/:name -> /api/media/:name) and the bytes are streamed
// off disk per request, the same way private form files / slips are served.
//
// When Supabase IS configured, /api/upload returns absolute Supabase URLs that
// never hit this route, so this is a no-op in that mode.

// Server-generated names are "<uuid>.<ext>"; reject anything else (path traversal,
// dotfiles, nested paths). Extensions mirror the upload allowlist.
const NAME_PATTERN = /^[0-9a-f-]{36}\.(webp|png|jpe?g|gif)$/i;

const CONTENT_TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
};

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;

  if (!NAME_PATTERN.test(name)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filePath = path.join(process.cwd(), "public", "uploads", name);
  try {
    const buffer = await readFile(filePath);
    // Cache-Control is set on the /uploads/:name request path in next.config.ts:
    // Next stomps a route handler's own Cache-Control to max-age=0, but the
    // headers() layer (which matches the original request path) survives.
    return new NextResponse(new Uint8Array(buffer), {
      headers: { "Content-Type": contentType },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
