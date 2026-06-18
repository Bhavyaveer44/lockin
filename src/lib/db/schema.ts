import {
  pgSchema,
  uuid,
  text,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";

// Isolate Lockin's tables in their own schema so it can safely share a Neon
// database with other projects (no collision on common names like "sessions").
export const lockin = pgSchema("lockin");

// A focus session: one continuous period the camera was watching the desk.
export const sessions = lockin.table("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

// A contiguous interval spent in one inferred WorkState. We store intervals
// (not per-frame samples) so rows stay small. NO image data is ever stored.
export const signalEvents = lockin.table(
  "signal_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    // focused | distracted | phone | away | fading
    state: text("state").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    durationSec: integer("duration_sec").notNull(),
  },
  (t) => [
    index("signal_user_started_idx").on(t.userId, t.startedAt),
    index("signal_session_idx").on(t.sessionId),
  ],
);

export type Session = typeof sessions.$inferSelect;
export type SignalEvent = typeof signalEvents.$inferSelect;
export type NewSignalEvent = typeof signalEvents.$inferInsert;
