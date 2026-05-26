import { db } from "@/db";
import { events, attendance } from "@/db/schema";
import { eq, count } from "drizzle-orm";

export class EventsService {
  /**
   * Retrieves an event record by UUID
   */
  static async getEventById(id: string) {
    return await db.query.events.findFirst({
      where: eq(events.id, id),
    });
  }

  /**
   * Retrieves the current checked-in attendee count for an event
   */
  static async getAttendeeCount(eventId: string): Promise<number> {
    const [result] = await db
      .select({ value: count() })
      .from(attendance)
      .where(eq(attendance.eventId, eventId));
    return result?.value ?? 0;
  }

  /**
   * General list of events
   */
  static async getEventsList() {
    return await db.query.events.findMany({
      orderBy: (events, { desc }) => [desc(events.startTime)],
    });
  }
}
