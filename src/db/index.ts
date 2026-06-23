import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
  errorGuardsInstalled: boolean | undefined;
};

// A single rejected DB operation (e.g. a query cancelled under momentary load, or
// a pooled socket dropped by Supabase) must NEVER crash the serverless instance.
// Node terminates the process on an unhandled rejection by default — and on a
// shared instance that aborts every OTHER in-flight request too, which is exactly
// how one slow query turned into a site-wide wave of 504s. Log and keep running.
if (!globalForDb.errorGuardsInstalled) {
  process.on("unhandledRejection", (reason) => {
    console.error("[db] Unhandled promise rejection (suppressed to keep instance alive):", reason);
  });
  globalForDb.errorGuardsInstalled = true;
}

// Production connects through the Supabase transaction pooler (port 6543), which
// does NOT support prepared statements — postgres-js must run in "simple query"
// mode there.
//
// `max` is the per-instance pool size. It must be > 1: a request issues several
// queries concurrently (Promise.all), and with max=1 they serialize over one
// connection — worse, a single slow/stuck query then head-of-line-blocks every
// other query on the instance (including the auth session lookup), which can hang
// the whole function.
//
// The right size depends on what we connect to:
//  - Supabase transaction pooler (:6543): keep it small (5) so we stay within the
//    pooler's shared client-slot budget — many instances share that budget.
//  - A dedicated Postgres we own (self-hosted, direct :5432): that shared budget
//    no longer applies, so a larger pool (15) lets concurrent requests — event
//    scan-ins, the dashboard's parallel reads — run instead of queueing. 15 stays
//    far under Postgres's default max_connections of 100.
// DB_POOL_MAX overrides the default for per-host tuning without an image rebuild.
const usingTransactionPooler = (process.env.DATABASE_URL ?? "").includes(":6543");
const poolMax = Number(process.env.DB_POOL_MAX) || (usingTransactionPooler ? 5 : 15);

const conn =
  globalForDb.conn ??
  postgres(process.env.DATABASE_URL!, {
    max: poolMax,
    prepare: !usingTransactionPooler,
    idle_timeout: 20,
    connect_timeout: 10,
  });
if (process.env.NODE_ENV !== "production") globalForDb.conn = conn;

export const db = drizzle(conn, { schema });