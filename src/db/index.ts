import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
};

// Production connects through the Supabase transaction pooler (port 6543), which
// does NOT support prepared statements — postgres-js must run in "simple query"
// mode there. We also keep the pool small per serverless instance: many concurrent
// instances each holding a large pool would exhaust the pooler's client slots.
const usingTransactionPooler = (process.env.DATABASE_URL ?? "").includes(":6543");

const conn =
  globalForDb.conn ??
  postgres(process.env.DATABASE_URL!, {
    max: usingTransactionPooler ? 1 : 10,
    prepare: !usingTransactionPooler,
    idle_timeout: 20,
    connect_timeout: 10,
  });
if (process.env.NODE_ENV !== "production") globalForDb.conn = conn;

export const db = drizzle(conn, { schema });