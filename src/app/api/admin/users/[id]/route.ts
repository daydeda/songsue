import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

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
    const { name, role, major, houseId, studentId, nickname } = body;

    // FE-Security: non-super_admin cannot award super_admin role
    if (role === "super_admin" && session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden: Only Super Admins can assign the Super Admin role" }, { status: 403 });
    }

    // FE-Security: non-super_admin cannot edit a super_admin user
    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (targetUser?.role === "super_admin" && session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden: Cannot edit Super Admin accounts" }, { status: 403 });
    }

    await db.update(users)
      .set({
        name,
        role,
        major,
        houseId,
        studentId,
        nickname,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

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
    if (targetUser?.role === "super_admin" && session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden: Cannot delete Super Admin accounts" }, { status: 403 });
    }

    await db.delete(users).where(eq(users.id, userId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
