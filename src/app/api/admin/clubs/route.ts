import { auth } from "@/auth";
import { ClubsService } from "@/modules/clubs/clubs.service";
import { effectiveRoles } from "@/lib/admin-access";
import { NextResponse } from "next/server";
import { z } from "zod";

const createClubSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
});

// GET /api/admin/clubs — List clubs (optional ?includeArchived=true, default false).
// Read-only, so gated more broadly than write: super_admin/admin/registration/
// organizer — the staff roles that can enter the admin area and need to pick a
// club (event-form owner picker, role-assignment club picker), but NOT students.
// club_president may also call this, but only ever sees the club(s) they preside
// over — same privacy boundary as club/major event scoping (see EventScopeService)
// — never the full org's club list. smo/major_president get no data here.
export async function GET(req: Request) {
  try {
    const session = await auth();
    const role = session?.user?.role || "";
    const isAdminRole = ["super_admin", "admin", "registration", "organizer"].includes(role);
    // Gate on the full role SET, not just the primary role: club_president ranks
    // below smo/anusmo/organizer/registration/admin in ROLE_PRIORITY (src/auth.ts),
    // so a user who is BOTH e.g. smo and club_president has session.user.role
    // resolve to "smo" — checking the singular role here would silently lock a
    // real club president out of their own scoped view. Mirrors how proxy.ts and
    // AdminNav already gate this same page on the role set.
    const isClubPresident = effectiveRoles(session?.user?.role, session?.user?.roles).includes("club_president");
    if (!session?.user || !(isAdminRole || isClubPresident)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const includeArchived = searchParams.get("includeArchived") === "true";

    const list = await ClubsService.listClubs(includeArchived);

    if (isClubPresident) {
      const ownClubIds = new Set(await ClubsService.getPresidentClubIds(session.user.id!));
      return NextResponse.json(list.filter((club) => ownClubIds.has(club.id)));
    }

    // When a caller (the role-assignment club picker) wants to pre-check which
    // clubs a specific user already presides over, it passes ?presidentUserId=.
    const presidentUserId = searchParams.get("presidentUserId");
    if (!presidentUserId) {
      return NextResponse.json(list);
    }
    const presidentClubIds = new Set(await ClubsService.getPresidentClubIds(presidentUserId));
    return NextResponse.json(
      list.map((club) => ({ ...club, isPresident: presidentClubIds.has(club.id) }))
    );
  } catch (error) {
    console.error("Failed to fetch clubs:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST /api/admin/clubs — Create a club. Stricter than GET: creating a club
// identity is admin-only (matches who can already assign the club_president
// role). No audit logging — club CRUD touches no PII/medical data (mirrors
// src/app/api/admin/houses/route.ts).
export async function POST(req: Request) {
  try {
    const session = await auth();
    const isAdminRole = ["super_admin", "admin"].includes(session?.user?.role || "");
    if (!session?.user || !isAdminRole) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const data = createClubSchema.parse(body);

    const created = await ClubsService.createClub(data.name);
    return NextResponse.json({ success: true, club: created }, { status: 201 });
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

    console.error("Failed to create club:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
