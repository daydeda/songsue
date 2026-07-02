import { auth } from "@/auth";
import { ClubsService } from "@/modules/clubs/clubs.service";
import { effectiveRoles } from "@/lib/admin-access";
import { NextResponse } from "next/server";
import { z } from "zod";

const memberBodySchema = z.object({
  userId: z.string().trim().min(1, "userId is required"),
});

// GET /api/admin/clubs/[id]/members — List a club's members (name, studentId,
// role). Gate: super_admin/admin, OR a club_president viewing THEIR OWN club
// (verified server-side against club_members — never trust the client-supplied
// :id alone). A member roster carries identity PII (name + studentId) for every
// club, so it must not be visible to another club's president or to any role
// beyond the two that already manage club identities plus the club's own
// president.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const isAdminRole = ["super_admin", "admin"].includes(session.user.role || "");

    if (!isAdminRole) {
      // Gate on the full role SET, not just the primary role — see the matching
      // comment in GET /api/admin/clubs for why (a club_president who is also
      // e.g. smo resolves session.user.role to "smo").
      const isClubPresident = effectiveRoles(session.user.role, session.user.roles).includes("club_president");
      const ownClubIds = isClubPresident
        ? await ClubsService.getPresidentClubIds(session.user.id!)
        : [];
      if (!ownClubIds.includes(id)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const members = await ClubsService.getClubMembers(id);
    return NextResponse.json(members);
  } catch (error) {
    console.error("Failed to fetch club members:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST /api/admin/clubs/[id]/members — Add a user to this club as a plain
// 'member'. Gate: super_admin/admin only, same as club identity management
// elsewhere — a club_president can VIEW their own roster (see GET above) but
// not edit it, so membership changes stay with staff. There is deliberately no
// way to grant 'president' here: that role must go through the Students page's
// role editor (setUserClubPresidencies), which keeps the club_members row in
// sync with the user's club_president system role tag — doing it here would let
// someone end up "president" of a club with no actual club_president role.
export async function POST(
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
    const data = memberBodySchema.parse(body);

    const member = await ClubsService.addClubMember(id, data.userId);
    if (!member) {
      return NextResponse.json({ error: "User or club not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, member }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: error.issues.map((e: z.ZodIssue) => `${e.path.join(".")}: ${e.message}`).join(", "),
      }, { status: 400 });
    }

    // FK violation: clubId or userId doesn't exist.
    const dbError = error instanceof Error && error.cause ? error.cause : error;
    if (dbError && typeof dbError === "object" && "code" in dbError && dbError.code === "23503") {
      return NextResponse.json({ error: "User or club not found" }, { status: 404 });
    }

    console.error("Failed to add club member:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// DELETE /api/admin/clubs/[id]/members — Remove a plain 'member' from this
// club. Gate: super_admin/admin only. Deliberately refuses to remove a
// role='president' row — presidency must be revoked via the Students page's
// role editor (which un-checks club_president and clears the matching
// club_members row together), so this stays the one path that can desync a
// club_president system role from an actual club_members presidency.
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
    const body = await req.json().catch(() => null);
    const data = memberBodySchema.parse(body);

    const members = await ClubsService.getClubMembers(id);
    const target = members.find((m) => m.userId === data.userId);
    if (!target) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }
    if (target.role === "president") {
      return NextResponse.json({
        error: "Can't remove a president here — revoke the club_president role from the Students page instead",
      }, { status: 409 });
    }

    await ClubsService.removeClubMember(id, data.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: error.issues.map((e: z.ZodIssue) => `${e.path.join(".")}: ${e.message}`).join(", "),
      }, { status: 400 });
    }

    console.error("Failed to remove club member:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
