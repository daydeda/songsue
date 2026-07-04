import { drizzle as drizzlePgJs, PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
  pglite: PGlite | undefined;
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

let dbInstance: PostgresJsDatabase<typeof schema>;

if (process.env.DB_TYPE === "pglite") {
  if (process.env.NODE_ENV === "production") {
    throw new Error("DB_TYPE 'pglite' is not allowed in production environment");
  }
  // Use WASM-based in-process PostgreSQL (PGlite) for ZeroSetup local development
  // In test environment, use an in-memory PGlite instance to prevent locking and conflicts.
  const client =
    globalForDb.pglite ??
    (process.env.NODE_ENV === "test" ? new PGlite() : new PGlite("./.pglite-data"));
  globalForDb.pglite = client;
  // Cast to PostgresJsDatabase to maintain type consistency across the app
  dbInstance = drizzlePglite(client, { schema }) as unknown as PostgresJsDatabase<typeof schema>;
} else {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is required when DB_TYPE is not 'pglite'");
  }

  const usingTransactionPooler = (process.env.DATABASE_URL ?? "").includes(":6543");
  const poolMax = Number(process.env.DB_POOL_MAX) || (usingTransactionPooler ? 5 : 15);

  const conn =
    globalForDb.conn ??
    postgres(process.env.DATABASE_URL, {
      max: poolMax,
      prepare: !usingTransactionPooler,
      idle_timeout: 20,
      connect_timeout: 10,
    });
  if (process.env.NODE_ENV !== "production") globalForDb.conn = conn;

  dbInstance = drizzlePgJs(conn, { schema });
}

export const db = dbInstance;
