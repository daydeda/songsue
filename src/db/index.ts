import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
};

// Production connects through the Supabase transaction pooler (port 6543), which
// does NOT support prepared statements — postgres-js must run in "simple query"
// mode there.
//
// `max` is the per-instance pool size. It must be > 1: a request issues several
// queries concurrently (Promise.all), and with max=1 they serialize over one
// connection — worse, a single slow/stuck query then head-of-line-blocks every
// other query on the instance (including the auth session lookup), which can hang
// the whole function. A small pool (5) restores concurrency while staying well
// within the pooler's client-slot budget for this app's traffic.
const usingTransactionPooler = (process.env.DATABASE_URL ?? "").includes(":6543");

const conn =
  globalForDb.conn ??
  postgres(process.env.DATABASE_URL!, {
    max: 5,
    prepare: !usingTransactionPooler,
    idle_timeout: 20,
    connect_timeout: 10,
  });
if (process.env.NODE_ENV !== "production") globalForDb.conn = conn;

export const db = drizzle(conn, { schema });