import { checkAndAwardPastEventPoints } from "@/lib/award-points";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Verify cron secret to prevent unauthorized access. Fail CLOSED: if CRON_SECRET
  // is unset, reject everything rather than letting anyone trigger the job.
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await checkAndAwardPastEventPoints();
    return NextResponse.json({ success: true, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error("Cron award-points error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
