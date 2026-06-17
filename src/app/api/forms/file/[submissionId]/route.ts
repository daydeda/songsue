import { auth } from "@/auth";
import { db } from "@/db";
import { formSubmissions } from "@/db/schema";
import { downloadFormFile } from "@/lib/form-file-storage";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Mirrors ADMIN_ROLES in /api/admin/events/[id]/form — the same people who can
// see submissions in the admin events page may view their file answers.
const ADMIN_ROLES = ["super_admin", "admin", "registration", "organizer"];

// A stored key is always "<uuid>.<ext>"; anything else is a text/choice answer
// that happens to live at this question id, not a file — reject it.
const KEY_PATTERN = /^[0-9a-f-]{36}\.[a-z0-9]+$/i;

// GET /api/forms/file/[submissionId]?q=<questionId> — stream a form file-answer.
// PDPA-gated: only the student who submitted it or an admin may view it. The file
// lives in a private bucket and is proxied here, so access is checked per request
// (never a public URL).
export async function GET(req: Request, { params }: { params: Promise<{ submissionId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { submissionId } = await params;
    const questionId = new URL(req.url).searchParams.get("q");
    if (!questionId) {
      return NextResponse.json({ error: "Missing question id" }, { status: 400 });
    }

    const submission = await db.query.formSubmissions.findFirst({
      where: eq(formSubmissions.id, submissionId),
    });
    if (!submission) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const isOwner = submission.studentId === session.user.id;
    const isAdmin = ADMIN_ROLES.includes(session.user.role || "");
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const answers = (submission.answers as Record<string, unknown>) || {};
    const key = answers[questionId];
    if (typeof key !== "string" || !KEY_PATTERN.test(key)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { buffer, contentType } = await downloadFormFile(key);
    const ext = key.slice(key.lastIndexOf("."));
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${submissionId}-${questionId}${ext}"`,
        // Private: caches must revalidate auth, never store shared copies.
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Form file view error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
