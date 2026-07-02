import { auth } from "@/auth";
import { ClubsService } from "@/modules/clubs/clubs.service";
import { NextResponse } from "next/server";
import { z } from "zod";

const patchClubSchema = z.object({
  name: z.string().trim().min(1, "Name is required").optional(),
  isArchived: z.boolean().optional(),
}).refine((d) => d.name !== undefined || d.isArchived !== undefined, {
  message: "At least one of name or isArchived must be provided",
});

// PATCH /api/admin/clubs/[id] — Rename and/or archive/unarchive a club.
// Gate: super_admin/admin only (creating/renaming club identities is stricter
// than reading the list). Archive is still the recommended path for a club
// that's just inactive — see DELETE below for permanent removal.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const isAdminRole = ["super_admin", "admin"].includes(session?.user?.role || "");
    if (!session?.user || !isAdminRole) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => null);
    const data = patchClubSchema.parse(body);

    let club;
    if (data.name !== undefined) {
      club = await ClubsService.renameClub(id, data.name);
    }
    if (data.isArchived !== undefined) {
      club = await ClubsService.setArchived(id, data.isArchived);
    }

    if (!club) {
      return NextResponse.json({ error: "Club not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, club });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: error.issues.map((e: z.ZodIssue) => `${e.path.join(".")}: ${e.message}`).join(", "),
      }, { status: 400 });
    }

    // Partial unique index (clubs_active_name_unique): two ACTIVE clubs can't
    // share a name (an archived club's name may be reused).
    const dbError = error instanceof Error && error.cause ? error.cause : error;
    if (dbError && typeof dbError === "object" && "code" in dbError && dbError.code === "23505") {
      return NextResponse.json({ error: "An active club with this name already exists" }, { status: 409 });
    }

    console.error("Failed to update club:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// DELETE /api/admin/clubs/[id] — Permanently delete a club. Gate: super_admin/
// admin only, same as PATCH. Removes all its club_members rows (FK cascade)
// and detaches it from any event's ownerClubIds (see ClubsService.deleteClub —
// that field has no FK, so Postgres can't cascade into it automatically).
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const isAdminRole = ["super_admin", "admin"].includes(session?.user?.role || "");
    if (!session?.user || !isAdminRole) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const deleted = await ClubsService.deleteClub(id);
    if (!deleted) {
      return NextResponse.json({ error: "Club not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete club:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
