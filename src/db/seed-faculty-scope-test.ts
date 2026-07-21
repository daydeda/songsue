/**
 * Database Seed Script for Faculty-Scope Feature Testing
 * Run with: npx tsx --env-file=.env.local src/db/seed-faculty-scope-test.ts
 *
 * LOCAL ONLY — uses .env.local pointing at localhost Docker Postgres.
 * Never run against production.
 *
 * Creates synthetic test data to verify per-faculty admin scoping:
 * - 2-3 fake students per faculty (CAMT, MASSCOM, ARCH, ARTS)
 * - 1 admin per faculty with faculty assigned
 * - 1 registration staff per faculty with faculty assigned
 * - 1 admin with faculty=null (deny-safe path test — should see nothing)
 * - A cross-faculty event with registrations for testing event scoping
 *
 * All emails are obviously synthetic (e.g., camt-test-student-1@test.local).
 * All data is idempotent — safe to re-run without duplicates.
 */
import { db } from "./index";
import { users, events, eventSessions, attendance } from "./schema";
import { eq } from "drizzle-orm";
import { assertDestructiveAllowed } from "./guard";
import { FACULTY_IDS, houseRowId } from "../lib/faculties";

const FACULTIES = FACULTY_IDS; // ["CAMT", "MASSCOM", "ARCH", "ARTS"]
const COLORS = ["red", "green", "yellow", "blue"] as const;

async function seed() {
  assertDestructiveAllowed("seed-faculty-scope-test (synthetic test users + cross-faculty event)");

  console.log("🌱 Seeding faculty-scope test data...\n");

  // ============================================================================
  // 1. CREATE SYNTHETIC STUDENTS (2-3 per faculty)
  // ============================================================================
  console.log("📚 Creating synthetic students per faculty...");
  for (const faculty of FACULTIES) {
    for (let i = 1; i <= 3; i++) {
      const email = `${faculty.toLowerCase()}-test-student-${i}@test.local`;
      const name = `${faculty} Test Student ${i}`;

      // Find a house for this student from their faculty
      const houseId = houseRowId(faculty, COLORS[i % 4]);

      const existing = await db.query.users.findFirst({
        where: (u, { eq }) => eq(u.email, email),
      });

      if (existing) {
        console.log(`  ✓ Student already exists: ${email}`);
      } else {
        await db.insert(users).values({
          id: crypto.randomUUID(),
          name,
          email,
          role: "student",
          roles: ["student"],
          faculty,
          houseId,
          profileCompleted: true,
          qrToken: crypto.randomUUID(),
        });
        console.log(`  ✅ Created student: ${name} (${email}) → ${faculty} / ${houseId}`);
      }
    }
  }

  // ============================================================================
  // 2. CREATE FACULTY ADMIN ACCOUNTS (one per faculty)
  // ============================================================================
  console.log("\n👤 Creating per-faculty admin accounts...");
  for (const faculty of FACULTIES) {
    const email = `${faculty.toLowerCase()}-test-admin@test.local`;
    const name = `${faculty} Test Admin`;

    const existing = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.email, email),
    });

    if (existing) {
      // Ensure role/faculty are set correctly
      await db
        .update(users)
        .set({ role: "admin", roles: ["admin"], faculty })
        .where(eq(users.email, email));
      console.log(`  ✓ Admin already exists: ${email}`);
    } else {
      await db.insert(users).values({
        id: crypto.randomUUID(),
        name,
        email,
        role: "admin",
        roles: ["admin"],
        faculty,
        profileCompleted: true,
        qrToken: crypto.randomUUID(),
      });
      console.log(`  ✅ Created admin: ${name} (${email}) → ${faculty}`);
    }
  }

  // ============================================================================
  // 3. CREATE FACULTY REGISTRATION STAFF ACCOUNTS (one per faculty)
  // ============================================================================
  console.log("\n📋 Creating per-faculty registration staff accounts...");
  for (const faculty of FACULTIES) {
    const email = `${faculty.toLowerCase()}-test-registration@test.local`;
    const name = `${faculty} Test Registration`;

    const existing = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.email, email),
    });

    if (existing) {
      // Ensure role/faculty are set correctly
      await db
        .update(users)
        .set({ role: "registration", roles: ["registration"], faculty })
        .where(eq(users.email, email));
      console.log(`  ✓ Registration staff already exists: ${email}`);
    } else {
      await db.insert(users).values({
        id: crypto.randomUUID(),
        name,
        email,
        role: "registration",
        roles: ["registration"],
        faculty,
        profileCompleted: true,
        qrToken: crypto.randomUUID(),
      });
      console.log(`  ✅ Created registration: ${name} (${email}) → ${faculty}`);
    }
  }

  // ============================================================================
  // 4. CREATE DENY-SAFE TEST ACCOUNT (null faculty, staff role)
  // ============================================================================
  // This exercises the crucial bug fix #2 from handoff.md:
  // A staff account with faculty=null must match NOTHING, not default to CAMT.
  console.log("\n⚠️  Creating deny-safe test account (null faculty)...");
  const denySafeEmail = "unassigned-faculty-admin@test.local";
  const denySafeName = "Unassigned Faculty Admin (deny-safe test)";

  const denySafeExisting = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.email, denySafeEmail),
  });

  if (denySafeExisting) {
    // Ensure it has admin role but faculty is null
    await db
      .update(users)
      .set({ role: "admin", roles: ["admin"], faculty: null })
      .where(eq(users.email, denySafeEmail));
    console.log(`  ✓ Deny-safe admin already exists: ${denySafeEmail}`);
  } else {
    await db.insert(users).values({
      id: crypto.randomUUID(),
      name: denySafeName,
      email: denySafeEmail,
      role: "admin",
      roles: ["admin"],
      faculty: null, // Deliberately null to test the deny-safe path
      profileCompleted: true,
      qrToken: crypto.randomUUID(),
    });
    console.log(`  ✅ Created deny-safe admin: ${denySafeName} (${denySafeEmail}) → faculty=null`);
  }

  // ============================================================================
  // 5. CREATE CROSS-FACULTY TEST EVENT WITH REGISTRATIONS
  // ============================================================================
  // This event itself now belongs to CAMT (events.faculty — see
  // src/lib/faculty-scope.ts): only a CAMT-scoped admin/registration staffer
  // (or super_admin) can even open it at all — a MASSCOM/ARCH/ARTS admin gets
  // "Event not found" on /api/admin/events/[id]/attendance|export|report. The
  // REGISTRATIONS below still deliberately span all 4 faculties, so once a
  // CAMT admin (or super_admin) IS let in, the roster itself still exercises
  // the older, independent attendee-row faculty filter (only CAMT attendees
  // show up for a CAMT-scoped admin; super_admin sees all 4).
  console.log("\n🎉 Creating cross-faculty test event...");

  // Event name and timing
  const eventTitle = "Faculty Scope Test Event";
  const now = new Date();
  const eventStart = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now
  const eventEnd = new Date(eventStart.getTime() + 2 * 60 * 60 * 1000); // 2 hour duration

  // Find or create the event
  let event = await db.query.events.findFirst({
    where: (e, { eq }) => eq(e.title, eventTitle),
  });

  if (!event) {
    const insertedEvents = await db
      .insert(events)
      .values({
        id: crypto.randomUUID(),
        title: eventTitle,
        faculty: "CAMT",
        description: "Synthetic event for testing faculty-scoped admin visibility",
        startTime: eventStart,
        endTime: eventEnd,
        registrationOpenTime: new Date(now.getTime() - 60 * 60 * 1000), // 1 hour ago
        registrationCloseTime: eventEnd,
        quota: 100,
        quotaWalkIn: 20,
        location: "Test Location",
        walkInsEnabled: true,
        registrationMode: "once",
      })
      .returning();
    event = insertedEvents[0];
    console.log(`  ✅ Created event: ${eventTitle}`);
  } else {
    console.log(`  ✓ Event already exists: ${eventTitle}`);
  }

  // Create event session
  let session = await db.query.eventSessions.findFirst({
    where: (es, { eq }) => eq(es.eventId, event.id),
  });

  if (!session) {
    const insertedSessions = await db
      .insert(eventSessions)
      .values({
        id: crypto.randomUUID(),
        eventId: event.id,
        title: "Session 1",
        startTime: eventStart,
        endTime: eventEnd,
        sortOrder: 0,
        quotaWalkIn: 20,
      })
      .returning();
    session = insertedSessions[0];
    console.log(`  ✅ Created event session`);
  } else {
    console.log(`  ✓ Event session already exists`);
  }

  // ============================================================================
  // 6. ADD CROSS-FACULTY REGISTRATIONS TO THE EVENT
  // ============================================================================
  console.log("\n📝 Adding cross-faculty registrations...");
  for (const faculty of FACULTIES) {
    // Register the first student from each faculty
    const email = `${faculty.toLowerCase()}-test-student-1@test.local`;
    const student = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.email, email),
    });

    if (student) {
      // Check if already registered
      const existing = await db.query.attendance.findFirst({
        where: (a, { and, eq }) =>
          and(eq(a.eventId, event.id), eq(a.studentId, student.id)),
      });

      if (existing) {
        console.log(
          `  ✓ ${faculty} student already registered: ${email}`
        );
      } else {
        await db.insert(attendance).values({
          id: crypto.randomUUID(),
          eventId: event.id,
          sessionId: session.id,
          studentId: student.id,
          status: "registered",
          method: "pre-registered",
        });
        console.log(
          `  ✅ Registered ${faculty} student: ${email}`
        );
      }
    }
  }

  console.log("\n✅ Faculty-scope test seeding complete!");
  console.log("\n📋 Test accounts created:");
  console.log("   • Students: <faculty>-test-student-{1,2,3}@test.local");
  console.log("   • Admins: <faculty>-test-admin@test.local");
  console.log("   • Registration: <faculty>-test-registration@test.local");
  console.log("   • Deny-safe (null faculty): unassigned-faculty-admin@test.local");
  console.log("\n🎉 Event: Faculty Scope Test Event (one registration per faculty)");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
