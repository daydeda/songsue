import { defineConfig } from "vitest/config";

// Pure-logic unit tests only — node environment, no jsdom, no DB, no Next runtime.
// `resolve.tsconfigPaths` makes the `@/*` alias from tsconfig.json resolve in tests
// (natively supported by Vite, no extra plugin needed).
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Guard rail: these tests must never reach a database. If a test transitively
    // imports the prod DB client, surface it loudly instead of silently connecting.
    env: {
      DATABASE_URL: "",
    },
  },
});
