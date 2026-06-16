import { auth } from "@/auth";
import { db } from "@/db";
import { users, attendance } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { AuditService, getClientIp } from "@/modules/audit/audit.service";

// PATCH: Update user information or role
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || !["super_admin", "admin"].includes(session.user.role || "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: userId } = await params;
    const body = await req.json();

    // Fields that can be updated by admin
    const { name, prefix, major, houseId, studentId, nickname } = body;
    let { role, roles } = body;

    const ROLE_PRIORITY = ["super_admin", "admin", "registration", "organizer", "smo", "anusmo", "staff", "professor", "officer", "student"];
    if (roles && Array.isArray(roles)) {
      // Find the primary role based on priority
      const primary = ROLE_PRIORITY.find(r => roles.includes(r));
      role = primary || roles[0] || "student";
    } else if (role) {
      // If only single role is provided, make sure roles array contains it
      roles = [role];
    }

    // FE-Security: non-super_admin cannot award super_admin role
    const isAssigningSuperAdmin = role === "super_admin" || (roles && roles.includes("super_admin"));
    if (isAssigningSuperAdmin && session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden: Only Super Admins can assign the Super Admin role" }, { status: 403 });
    }

    // FE-Security: non-super_admin cannot edit a super_admin user
    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const isTargetSuperAdmin = targetUser.role === "super_admin" || (targetUser.roles as string[] | null)?.includes("super_admin");
    if (isTargetSuperAdmin && session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden: Cannot edit Super Admin accounts" }, { status: 403 });
    }

    // Build the audit summary: role changes are logged with old → new values,
    // other fields by name only (no PII values in the log itself).
    const changes: string[] = [];
    if (role !== undefined && role !== targetUser.role) {
      changes.push(`role: ${targetUser.role} → ${role}`);
    }
    const oldRoles = ((targetUser.roles as string[] | null) ?? []).slice().sort();
    const newRoles = roles ? (roles as string[]).slice().sort() : null;
    if (newRoles && JSON.stringify(newRoles) !== JSON.stringify(oldRoles)) {
      changes.push(`roles: [${oldRoles.join(", ")}] → [${newRoles.join(", ")}]`);
    }
    if (name !== undefined && name !== targetUser.name) changes.push("name");
    if (prefix !== undefined && prefix !== targetUser.prefix) changes.push("prefix");
    if (major !== undefined && major !== targetUser.major) changes.push("major");
    if (houseId !== undefined && houseId !== targetUser.houseId) changes.push("houseId");
    if (studentId !== undefined && studentId !== targetUser.studentId) changes.push("studentId");
    if (nickname !== undefined && nickname !== targetUser.nickname) changes.push("nickname");

    await db.transaction(async (tx) => {
      await tx.update(users)
        .set({
          name,
          prefix,
          role,
          roles,
          major,
          houseId,
          studentId,
          nickname,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      if (changes.length > 0) {
        await AuditService.logActionInternal(tx, {
          actorId: session.user.id!,
          targetId: userId,
          action: `Updated user ${targetUser.name}: ${changes.join(", ")}`,
          ipAddress: getClientIp(req),
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// DELETE: Remove user
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || !["super_admin", "admin"].includes(session.user.role || "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: userId } = await params;

    // Prevent self-deletion
    if (userId === session.user.id) {
      return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
    }

    // FE-Security: non-super_admin cannot delete a super_admin user
    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (targetUser.role === "super_admin" && session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden: Cannot delete Super Admin accounts" }, { status: 403 });
    }

    // Some foreign keys referencing users.id lack ON DELETE CASCADE in the
    // production schema (attendance.student_id / scanned_by). Clean those up in
    // a transaction first, otherwise Postgres rejects the delete with a FK
    // violation. accounts / sessions / authenticators / form_submissions
    // already cascade. audit_logs rows are NEVER rewritten — their actor_id /
    // target_id values are baked into the tamper-evident row hashes, so the
    // FK constraints on audit_logs were dropped instead (migration step 27).
    await db.transaction(async (tx) => {
      // Remove this user's own event registrations/attendance.
      await tx.delete(attendance).where(eq(attendance.studentId, userId));
      // Preserve other students' attendance that this user scanned in.
      await tx.update(attendance).set({ scannedBy: null }).where(eq(attendance.scannedBy, userId));

      await tx.delete(users).where(eq(users.id, userId));

      // PDPA erasure record. The name/studentId live in the action text since
      // the target user row no longer exists to join against.
      await AuditService.logActionInternal(tx, {
        actorId: session.user.id!,
        targetId: userId,
        action: `Deleted user account: ${targetUser.name}${targetUser.studentId ? ` (${targetUser.studentId})` : ""}`,
        ipAddress: getClientIp(req),
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
