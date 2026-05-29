import { EventEmitter } from "events";
import { promises as fs } from "fs";
import path from "path";

// Keep a local in-memory emitter for same-thread queries
const globalForEmitter = globalThis as unknown as {
  emitter: EventEmitter | undefined;
};

const emitter = globalForEmitter.emitter ?? new EventEmitter();

if (process.env.NODE_ENV !== "production") {
  globalForEmitter.emitter = emitter;
}

export const realtimeEmitter = {
  on(event: string, listener: (...args: unknown[]) => void) {
    emitter.on(event, listener);
  },

  off(event: string, listener: (...args: unknown[]) => void) {
    emitter.off(event, listener);
  },

  emit(event: string, payload: unknown) {
    // 1. Emit locally in the same thread first
    emitter.emit(event, payload);

    // 2. If it's a dashboard update, write a tiny JSON to filesystem
    // to cross the Next.js worker thread/process boundaries
    if (event === "dashboard_update") {
      const brokerDir = path.join(process.cwd(), "scratch", "realtime-events");
      const filename = `update-${Date.now()}-${Math.random().toString(36).substring(2)}.json`;
      const filePath = path.join(brokerDir, filename);

      // Asynchronous, non-blocking disk operation
      fs.mkdir(brokerDir, { recursive: true })
        .then(() => fs.writeFile(filePath, JSON.stringify(payload), "utf-8"))
        .catch((err) => {
          console.error("FS Realtime Broker write failed:", err);
        });
    }
  }
};
