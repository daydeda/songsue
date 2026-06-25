import "dotenv/config";

const isPglite = process.env.DB_TYPE === "pglite";

async function test() {
  try {
    let result: any;
    if (isPglite) {
      console.log("📦 PGlite active. Testing connection...");
      const { PGlite } = require("@electric-sql/pglite");
      const client = new PGlite("./.pglite-data");
      result = await client.query("SELECT 1 as connected");
      await client.close();
    } else {
      const postgres = require("postgres");
      const sql = postgres(process.env.DATABASE_URL!);
      result = await sql`SELECT 1 as connected`;
      await sql.end();
    }
    console.log("Database connection successful:", result);
    process.exit(0);
  } catch (error) {
    console.error("Database connection failed:", error);
    process.exit(1);
  }
}

test();

