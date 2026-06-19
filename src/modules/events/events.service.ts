import { db } from "@/db";
import { events, attendance, eventSessions } from "@/db/schema";
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
   * Lists an event's sessions in display order ("Day 1", "Day 2", …).
   */
  static async getSessions(eventId: string) {
    return await db.query.eventSessions.findMany({
      where: eq(eventSessions.eventId, eventId),
      orderBy: (s, { asc }) => [asc(s.sortOrder), asc(s.startTime)],
    });
  }

  /**
   * Resolve which session a scan defaults to when the client omits sessionId.
   * Prefers the session whose [start, end] window contains now; else the nearest
   * upcoming; else the most recent past. Deterministic so the scanner UI and the
   * server pick the same "current" day. Returns null if the event has no sessions.
   */
  static async resolveCurrentSessionId(eventId: string): Promise<string | null> {
    const sessions = await this.getSessions(eventId);
    if (sessions.length === 0) return null;
    const now = Date.now();
    const current = sessions.find(
      (s) => s.startTime.getTime() <= now && now <= s.endTime.getTime()
    );
    if (current) return current.id;
    const upcoming = sessions.find((s) => s.startTime.getTime() > now);
    if (upcoming) return upcoming.id;
    return sessions[sessions.length - 1].id; // all in the past → most recent
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
