import { auth } from "@/auth";
import { writeFile, mkdir } from "fs/promises";
import { NextResponse } from "next/server";
import path from "path";

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

    // Check if it's an image
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only images are allowed" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create unique filename
    const filename = `${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
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
