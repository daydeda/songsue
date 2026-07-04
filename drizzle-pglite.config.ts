import { defineConfig } from "drizzle-kit";

// TEMPORARY test-only config (safe to delete): sync schema into local PGlite sandbox.
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  driver: "pglite",
  dbCredentials: {
    url: "./.pglite-data",
  },
});
