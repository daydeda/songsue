import { auth } from "@/auth";
import { db } from "@/db";
import { attendance, forms, formSubmissions } from "@/db/schema";
import { and, count, eq, lt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { canAccessSkillForm, getFormAvailability } from "@/lib/form-access";

// Shape of a form as it appears in a history entry's `forms` array.
type FormStatus = "available" | "submitted" | "closed" | "upcoming";

interface EventFormStatus {
  id: string;
  formType: string;
  title: string;
  sortOrder: number;
  formStatus: FormStatus;
  formPoints: number;
  opensAt: Date | string | null;
  closesAt: Date | string | null;
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const userRole = session.user.role || "";
    const me = { id: userId, role: userRole };

    // Whether the viewer is assigned (by role or by person) to a given S form —
    // managers are NOT counted here so an admin's history isn't flooded with every
    // event's skill form (admins fill those from the admin form builder instead).
    const isAssignedTo = (f: { assignedRoles?: string[] | null; assignedUserIds?: string[] | null }) => {
      const roles = f.assignedRoles ?? [];
      const ids = f.assignedUserIds ?? [];
      return (!!userRole && roles.includes(userRole)) || ids.includes(userId);
    };

    // Compute the per-viewer status of a form (submitted / available / scheduled).
    const buildFormStatus = (
      formObj: typeof forms.$inferSelect,
      hasSubmission: boolean
    ): EventFormStatus => {
      let formStatus: FormStatus;
      if (hasSubmission) {
        formStatus = "submitted";
      } else {
        const availability = getFormAvailability(formObj);
        formStatus = availability === "open" ? "available" : availability === "upcoming" ? "upcoming" : "closed";
      }
      return {
        id: formObj.id,
        formType: formObj.formType,
        title: formObj.title,
        sortOrder: formObj.sortOrder,
        formStatus,
        formPoints: formObj.pointsAwarded ?? 0,
        opensAt: formObj.opensAt,
        closesAt: formObj.closesAt,
      };
    };

    const hasSubmitted = async (formId: string) => {
      const sub = await db.query.formSubmissions.findFirst({
        where: and(eq(formSubmissions.formId, formId), eq(formSubmissions.studentId, userId)),
      });
      return !!sub;
    };

    const userAttendances = await db.query.attendance.findMany({
      where: eq(attendance.studentId, userId),
      with: { event: true },
      orderBy: (a, { desc }) => [desc(a.checkInTime)],
    });
    const attendedEventIds = new Set(userAttendances.map((a) => a.eventId));

    // History entries for events the student registered for / attended.
    const history = await Promise.all(
      userAttendances.map(async (att) => {
        if (!att.event) return null;

        // Rank = the order this student physically checked in among everyone who
        // attended. Only set once they've actually checked in; null otherwise.
        let rank: number | null = null;
        if (att.checkInTime) {
          const [{ value: earlier }] = await db
            .select({ value: count() })
            .from(attendance)
            .where(
              and(
                eq(attendance.eventId, att.eventId),
                lt(attendance.checkInTime, att.checkInTime)
              )
            );
          rank = (earlier || 0) + 1;
        }

        const eventForms = await db.query.forms.findMany({
          where: eq(forms.eventId, att.eventId),
          orderBy: (f, { asc }) => [asc(f.sortOrder), asc(f.createdAt)],
        });

        // Non-S forms are shown to everyone; an S form only if the viewer may
        // access it (assigned by role/person, or a manager).
        const studentForms = await Promise.all(
          eventForms
            .filter((f) => f.formType !== "S" || canAccessSkillForm(f, me))
            .map(async (formObj) => buildFormStatus(formObj, await hasSubmitted(formObj.id)))
        );

        return {
          id: att.id,
          eventId: att.eventId,
          eventTitle: att.event.title,
          eventImageUrl: att.event.imageUrl,
          eventQuota: att.event.quota,
          eventStartTime: att.event.startTime,
          eventEndTime: att.event.endTime,
          checkInTime: att.checkInTime,
          method: att.method,
          rank,
          forms: studentForms,
        };
      })
    );

    // S forms the viewer is assigned to on events they did NOT attend — surfaced
    // so assigned evaluators can fill them without being a participant.
    const assignedSForms = (
      await db.query.forms.findMany({
        where: eq(forms.formType, "S"),
        with: { event: true },
        orderBy: (f, { asc }) => [asc(f.sortOrder), asc(f.createdAt)],
      })
    ).filter((f) => f.event && !attendedEventIds.has(f.eventId) && isAssignedTo(f));

    // Group assigned forms by event into synthetic (no check-in) history entries.
    const assignedByEvent = new Map<string, typeof assignedSForms>();
    for (const f of assignedSForms) {
      const list = assignedByEvent.get(f.eventId) ?? [];
      list.push(f);
      assignedByEvent.set(f.eventId, list);
    }

    const assignedEntries = await Promise.all(
      [...assignedByEvent.values()].map(async (eventForms) => {
        const ev = eventForms[0].event!;
        const formsList = await Promise.all(
          eventForms.map(async (formObj) => buildFormStatus(formObj, await hasSubmitted(formObj.id)))
        );
        return {
          id: `assigned-${ev.id}`,
          eventId: ev.id,
          eventTitle: ev.title,
          eventImageUrl: ev.imageUrl,
          eventQuota: ev.quota,
          eventStartTime: ev.startTime,
          eventEndTime: ev.endTime,
          checkInTime: null,
          method: null,
          rank: null,
          assignedOnly: true, // attended=false; viewer is here only to evaluate
          forms: formsList,
        };
      })
    );

    return NextResponse.json([...history.filter(Boolean), ...assignedEntries]);
  } catch (error) {
    console.error("Failed to fetch student history:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
