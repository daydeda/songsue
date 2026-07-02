import { auth } from "@/auth";
import { ClubsService } from "@/modules/clubs/clubs.service";
import { NextResponse } from "next/server";

// GET /api/admin/clubs/[id]/members — List a club's members (name, studentId,
// role). Gate: super_admin/admin ONLY — stricter than GET /api/admin/clubs
// (which registration/organizer may also call, but only for id/name/counts
// used by pickers). A member roster carries identity PII (name + studentId)
// for every club, so it must not be visible to another club's president or to
// any role beyond the two that already manage club identities.
export async function GET(
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
    const members = await ClubsService.getClubMembers(id);
    return NextResponse.json(members);
  } catch (error) {
    console.error("Failed to fetch club members:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
