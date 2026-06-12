import { auth } from "@/auth";
import { writeFile, mkdir } from "fs/promises";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import path from "path";

// MIME type and extension are both client-controlled, so the only trustworthy
// signal is the file's own magic bytes. A spoofed "image" that slips through
// would be stored verbatim and served from public storage — i.e. stored XSS.
function sniffImageType(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  const ascii6 = buf.subarray(0, 6).toString("ascii");
  if (ascii6 === "GIF87a" || ascii6 === "GIF89a") return "image/gif";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Validate file size (max 10MB)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File size exceeds the 10MB limit." }, { status: 400 });
    }

    // Check if it's an image
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only images are allowed" }, { status: 400 });
    }

    // Harden upload: check file extension to prevent content-type spoofing (Stored XSS)
    const allowedExts = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
    const ext = path.extname(file.name).toLowerCase();
    if (!allowedExts.includes(ext)) {
      return NextResponse.json({ error: "Invalid image extension. Only .jpg, .jpeg, .png, .webp, and .gif are allowed." }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    let buffer: Buffer = Buffer.from(bytes);

    const sniffedType = sniffImageType(buffer);
    if (!sniffedType) {
      return NextResponse.json({ error: "File content is not a valid image." }, { status: 400 });
    }

    let outputExt = ext;
    let outputContentType = sniffedType;

    // Compress on upload to protect the Supabase free-tier egress wall (5GB/mo).
    // Raw 10MB posters served to ~1,500 devices blow the cap in a day. Re-encode to
    // WebP at max 1600px — typically a 5–20× size cut — except animated GIFs, which
    // we leave untouched to preserve animation. Re-encoding also destroys any
    // polyglot payload, so a file sharp cannot decode is rejected, never stored raw.
    if (sniffedType !== "image/gif") {
      try {
        const sharp = (await import("sharp")).default;
        buffer = await sharp(buffer)
          .rotate() // honor EXIF orientation before stripping metadata
          .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
          .webp({ quality: 80 })
          .toBuffer();
        outputExt = ".webp";
        outputContentType = "image/webp";
      } catch (e) {
        console.error("Image re-encode failed, rejecting upload:", e);
        return NextResponse.json({ error: "File could not be processed as an image." }, { status: 400 });
      }
    }

    // Server-generated filename. Never derive from client file.name — that allows
    // path traversal in the disk fallback and lets a known name be targeted for
    // overwrite. The validated extension is the only client-derived part kept.
    const filename = `${randomUUID()}${outputExt}`;

    // --- PRODUCTION: Supabase Storage ---
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      const { data, error } = await supabase.storage
        .from("uploads")
        .upload(filename, buffer, {
          contentType: outputContentType,
          upsert: false,
        });

      if (error) {
        console.error("Supabase storage upload error:", error);
        return NextResponse.json({ error: "Failed to upload to cloud storage." }, { status: 500 });
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("uploads")
        .getPublicUrl(filename);

      return NextResponse.json({ url: publicUrl });
    }

    // --- DEVELOPMENT FALLBACK: Local Disk ---
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    
    // Ensure directory exists
    try {
      await mkdir(uploadDir, { recursive: true });
    } catch (e) {}

    const filePath = path.join(uploadDir, filename);
    await writeFile(filePath, buffer);

    const publicPath = `/uploads/${filename}`;
    return NextResponse.json({ url: publicPath });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

