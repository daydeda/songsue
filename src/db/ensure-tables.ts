import { sql } from "drizzle-orm";
import { db } from "@/db";

let tablesEnsured = false;

export async function ensureGameTables() {
  if (tablesEnsured) return;

  try {
    // 1. game_rooms table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS game_rooms (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        room_code text NOT NULL,
        game_type text NOT NULL,
        host_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        guest_id text REFERENCES users(id) ON DELETE CASCADE,
        game_state jsonb NOT NULL,
        current_turn integer NOT NULL DEFAULT 1,
        status text NOT NULL DEFAULT 'waiting',
        winner_id text REFERENCES users(id) ON DELETE SET NULL,
        finish_reason text,
        turn_deadline timestamptz,
        expires_at timestamptz NOT NULL,
        created_at timestamptz DEFAULT now() NOT NULL,
        updated_at timestamptz DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_game_rooms_code ON game_rooms (room_code)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_game_rooms_status ON game_rooms (status)`);

    // 2. webrtc_signals table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS webrtc_signals (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        room_id uuid NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
        role text NOT NULL,
        sdp_offer text,
        sdp_answer text,
        ice_candidates jsonb DEFAULT '[]'::jsonb,
        updated_at timestamptz DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_webrtc_signals_room_role ON webrtc_signals (room_id, role)`);

    // 3. game_stats table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS game_stats (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        game_type text NOT NULL,
        wins integer NOT NULL DEFAULT 0,
        losses integer NOT NULL DEFAULT 0,
        draws integer NOT NULL DEFAULT 0,
        win_streak integer NOT NULL DEFAULT 0,
        best_streak integer NOT NULL DEFAULT 0,
        total_games integer NOT NULL DEFAULT 0,
        last_played_at timestamptz DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_game_stats_user_game ON game_stats (user_id, game_type)`);

    tablesEnsured = true;
    console.log("[db] Game tables verified and created successfully.");
  } catch (error) {
    console.error("[db] Failed to ensure game tables:", error);
  }
}
