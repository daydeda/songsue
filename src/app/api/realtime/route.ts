import { auth } from "@/auth";
import { realtimeEmitter } from "@/lib/realtime-emitter";
import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import { watch } from "fs";
import path from "path";
import os from "os";

export async function GET(req: Request) {
  try {
    // 1. Authenticate the connection via NextAuth
    const session = await auth();
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const isAdmin = ["super_admin", "admin", "registration", "organizer"].includes(session.user.role || "");
    const isVercel = !!process.env.VERCEL;
    const brokerDir = isVercel
      ? path.join(os.tmpdir(), "realtime-events")
      : path.join(process.cwd(), "scratch", "realtime-events");

    // 2. Open persistent Server-Sent Events stream
    const responseStream = new ReadableStream({
      async start(controller) {
        // Enqueue text helper formatted for Server-Sent Events (data: <string>\n\n)
        const handleUpdate = (...args: unknown[]) => {
          const eventPayload = args[0] as ({ type: string } & Record<string, unknown>) | null | undefined;
          if (!eventPayload) return;
          try {
            // PDPA and Security: If client is not an admin, filter out private details (like checkins)
            if (!isAdmin) {
              const allowedStudentEventTypes = ["score", "event_created", "event_updated", "event_deleted", "ping"];
              if (!allowedStudentEventTypes.includes(eventPayload.type)) {
                return; // Suppress private student checkin alerts
              }
            }
            controller.enqueue(`data: ${JSON.stringify(eventPayload)}\n\n`);
          } catch (e) {
            // Stream might already be closed/aborting
          }
        };

        // Subscribe to local in-memory emitter (just in case they are on the same thread)
        realtimeEmitter.on("dashboard_update", handleUpdate);

        // Ensure broker directory exists
        try {
          await fs.mkdir(brokerDir, { recursive: true });
        } catch (e) {}

        // Read and clear any existing/queued files on start
        const processPendingFiles = async () => {
          try {
            const files = await fs.readdir(brokerDir);
            for (const file of files) {
              if (file.endsWith(".json")) {
                const filePath = path.join(brokerDir, file);
                try {
                  const content = await fs.readFile(filePath, "utf-8");
                  const payload = JSON.parse(content);
                  handleUpdate(payload);
                  await fs.unlink(filePath); // Delete file to keep disk clean
                } catch (e) {}
              }
            }
          } catch (e) {}
        };

        await processPendingFiles();

        // Start filesystem watcher to capture cross-thread event broker files
        let fsWatcher: any = null;
        try {
          fsWatcher = watch(brokerDir, async (eventType, filename) => {
            if (eventType === "rename" && filename && filename.endsWith(".json")) {
              const filePath = path.join(brokerDir, filename);
              try {
                // Tiny timeout to ensure file write completed
                await new Promise((resolve) => setTimeout(resolve, 30));
                const content = await fs.readFile(filePath, "utf-8");
                const payload = JSON.parse(content);
                handleUpdate(payload);
                await fs.unlink(filePath); // Clean up file immediately
              } catch (e) {
                // Might be already unlinked by another connection thread
              }
            }
          });
        } catch (watchError) {
          console.warn("SSE Realtime: fs.watch is not supported in this environment, bypassing file watcher:", watchError);
        }

        // Define a safe connection lifetime (8 seconds on Vercel to stay under the 10s Hobby plan timeout)
        const streamLifetime = isVercel ? 8000 : 55000;

        const cleanup = () => {
          clearTimeout(streamTimeout);
          clearInterval(pingInterval);
          realtimeEmitter.off("dashboard_update", handleUpdate);
          if (fsWatcher) {
            try {
              fsWatcher.close(); // Close kernel watch handle
            } catch (e) {}
          }
          try {
            controller.close();
          } catch (e) {}
        };

        // Keep-alive heartbeats every 15 seconds to prevent browser or Nginx timeouts
        const pingInterval = setInterval(() => {
          try {
            controller.enqueue(`data: ${JSON.stringify({ type: "ping" })}\n\n`);
          } catch (e) {}
        }, 15000);

        // Automatically close the stream after the lifetime limit to prevent Vercel execution timeouts
        const streamTimeout = setTimeout(() => {
          cleanup();
        }, streamLifetime);

        // Clean up subscriptions and intervals when the request is aborted
        req.signal.addEventListener("abort", () => {
          cleanup();
        });
      }
    });

    return new NextResponse(responseStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
      }
    });
  } catch (error) {
    console.error("SSE Realtime route error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
