import { pgTable, text, timestamp, uuid, integer, boolean, jsonb, primaryKey } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import type { AdapterAccountType } from "next-auth/adapters";

export const houses = pgTable("houses", {
  id: text("id").primaryKey(), // e.g. 'red', 'blue', 'green', 'yellow'
  name: text("name").notNull(),
  color: text("color").default("#6366f1"), // Hex color for display
  points: integer("points").default(0),
});

export const users = pgTable("users", {
  id: text("id").primaryKey(), // Auth.js / OAuth provider ID
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  role: text("role").default("student"), // 'student', 'admin'
  houseId: text("house_id").references(() => houses.id),
  // QR Token for secure check-in (FE-13)
  qrToken: text("qr_token").unique(),
  // Profile specifics
  studentId: text("student_id").unique(),
  prefix: text("prefix"),
  nickname: text("nickname"),
  major: text("major"), // ANI, DG, DII, MMIT, SE
  imageTransform: jsonb("image_transform"), // { scale: number, x: number, y: number }
  religion: text("religion"),
  phone: text("phone"),
  contactChannels: text("contact_channels"),
  // Sensitive data (FE-12, §4.3)
  chronicDiseases: text("chronic_diseases"),
  medicalHistory: text("medical_history"),
  drugAllergies: text("drug_allergies"),
  foodAllergies: text("food_allergies"),
  dietaryRestrictions: text("dietary_restrictions"),
  faintingHistory: boolean("fainting_history"),
  emergencyMedication: text("emergency_medication"),
  emergencyContacts: jsonb("emergency_contacts"), // [{name, relationship, phone}]
  pdpaConsent: boolean("pdpa_consent").default(false),
  profileCompleted: boolean("profile_completed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const authenticators = pgTable(
  "authenticator",
  {
    credentialID: text("credentialID").notNull().unique(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerAccountId: text("providerAccountId").notNull(),
    credentialPublicKey: text("credentialPublicKey").notNull(),
    counter: integer("counter").notNull(),
    credentialDeviceType: text("credentialDeviceType").notNull(),
    credentialBackedUp: boolean("credentialBackedUp").notNull(),
    transports: text("transports"),
  }
);

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  })
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  })
);

export const events = pgTable("events", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  quota: integer("quota"),
  location: text("location"),
  pointsAwarded: integer("points_awarded").default(0),
  imageUrl: text("image_url"),
  walkInsEnabled: boolean("walk_ins_enabled").default(false),
  targetThai: boolean("target_thai").default(true),
  targetInternational: boolean("target_international").default(true),
  quotaThai: integer("quota_thai"),
  quotaInternational: integer("quota_international"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const attendance = pgTable("attendance", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "cascade" }).notNull(),
  studentId: text("student_id").references(() => users.id).notNull(),
  checkInTime: timestamp("check_in_time"),
  method: text("method"), // 'qr', 'manual', 'walk-in', 'pre-registered'
  status: text("status").default("registered"), // 'registered', 'attended'
  scannedBy: text("scanned_by").references(() => users.id),
  medsCheckOption: text("meds_check_option"),
});

// Score history log per house per activity (FE-08)
export const scoreHistory = pgTable("score_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  houseId: text("house_id").references(() => houses.id, { onDelete: "cascade" }).notNull(),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "cascade" }),
  delta: integer("delta").notNull(), // positive = gain, negative = loss
  reason: text("reason").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  timestamp: timestamp("timestamp").defaultNow(),
  actorId: text("actor_id").references(() => users.id),
  targetId: text("target_id").references(() => users.id),
  action: text("action").notNull(),
  ipAddress: text("ip_address"),
});

// ─── Relations ────────────────────────────────────────────────────────────────

export const housesRelations = relations(houses, ({ many }) => ({
  users: many(users),
  scoreHistory: many(scoreHistory),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  house: one(houses, {
    fields: [users.houseId],
    references: [houses.id],
  }),
  attendances: many(attendance),
  auditLogsAsActor: many(auditLogs, { relationName: "actor" }),
  auditLogsAsTarget: many(auditLogs, { relationName: "target" }),
}));

export const eventsRelations = relations(events, ({ many }) => ({
  attendances: many(attendance),
  scoreHistory: many(scoreHistory),
}));

export const attendanceRelations = relations(attendance, ({ one }) => ({
  event: one(events, {
    fields: [attendance.eventId],
    references: [events.id],
  }),
  user: one(users, {
    fields: [attendance.studentId],
    references: [users.id],
  }),
  scanner: one(users, {
    fields: [attendance.scannedBy],
    references: [users.id],
  }),
}));

export const scoreHistoryRelations = relations(scoreHistory, ({ one }) => ({
  house: one(houses, {
    fields: [scoreHistory.houseId],
    references: [houses.id],
  }),
  event: one(events, {
    fields: [scoreHistory.eventId],
    references: [events.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(users, {
    fields: [auditLogs.actorId],
    references: [users.id],
    relationName: "actor",
  }),
  target: one(users, {
    fields: [auditLogs.targetId],
    references: [users.id],
    relationName: "target",
  }),
}));

export const forms = pgTable("forms", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "cascade" }).notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  questions: jsonb("questions").notNull(), // Array of: { id: string, type: 'text' | 'rating', label: string, required: boolean }
  pointsAwarded: integer("points_awarded").default(0),
  isActive: boolean("is_active").default(true),
  isAwarded: boolean("is_awarded").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const formSubmissions = pgTable("form_submissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  formId: uuid("form_id").references(() => forms.id, { onDelete: "cascade" }).notNull(),
  studentId: text("student_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  answers: jsonb("answers").notNull(), // Map of questionId -> studentAnswer
  submittedAt: timestamp("submitted_at").defaultNow(),
});

export const formsRelations = relations(forms, ({ one, many }) => ({
  event: one(events, {
    fields: [forms.eventId],
    references: [events.id],
  }),
  submissions: many(formSubmissions),
}));

export const formSubmissionsRelations = relations(formSubmissions, ({ one }) => ({
  form: one(forms, {
    fields: [formSubmissions.formId],
    references: [forms.id],
  }),
  user: one(users, {
    fields: [formSubmissions.studentId],
    references: [users.id],
  }),
}));
