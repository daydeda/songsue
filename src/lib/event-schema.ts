import { z } from "zod";

// One session (day) of an event. `id` present = an existing session being edited;
// absent = a new session to create. Shared by the create (POST) and update (PUT)
// admin event routes. Lives here rather than in a route.ts because Next.js route
// modules may only export request handlers + known config — an extra export there
// trips the generated route-type check.
export const sessionInputSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().optional().nullable(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  quotaWalkIn: z.number().int().min(0).optional().nullable(),
});

export type SessionInput = z.infer<typeof sessionInputSchema>;
