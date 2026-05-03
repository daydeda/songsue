import postgres from "postgres";
import "dotenv/config";

const sql = postgres(process.env.DATABASE_URL!);

async function test() {
  try {
    const result = await sql`SELECT 1 as connected`;
    console.log("Database connection successful:", result);
    process.exit(0);
  } catch (error) {
    console.error("Database connection failed:", error);
    process.exit(1);
  }
}

test();
