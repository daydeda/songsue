import { createHash } from "crypto";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { asc, desc, sql } from "drizzle-orm";

// Fixed key for the transaction-scoped advisory lock that serializes audit-log
// appends. Without it, two concurrent transactions can read the same chain tip and
// both link to it, forking the hash chain. The lock makes every append wait for the
// previous one's tip to commit. Released automatically at transaction end.
const AUDIT_CHAIN_LOCK_KEY = 919273;

// Client IP as seen through Vercel's proxy headers.
export function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1"
  );
}

export interface LogActionParams {
  actorId: string;
  targetId?: string;
  action: string;
  ipAddress: string;
}

export interface ChainVerifyResult {
  valid: boolean;
  totalRows: number;
  hashedRows: number;
  firstBreakIndex: number | null;
  firstBreakId: string | null;
  reason: string;
}

type DBTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Sentinel prevHash used by the first hashed row
const GENESIS_HASH = "0".repeat(64);

// Field order is fixed — changing it invalidates all existing hashes
function computeRowHash(fields: {
  id: string;
  timestamp: string;
  actorId: string | null;
  targetId: string | null;
  action: string;
  ipAddress: string | null;
  prevHash: string;
}): string {
  const payload = JSON.stringify([
    fields.id,
    fields.timestamp,
    fields.actorId,
    fields.targetId,
    fields.action,
    fields.ipAddress,
    fields.prevHash,
  ]);
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

async function getLastHashForUpdate(tx: DBTransaction): Promise<string> {
  const [last] = await tx
    .select({ rowHash: auditLogs.rowHash })
    .from(auditLogs)
    .orderBy(desc(auditLogs.timestamp))
    .limit(1)
    .for("update");
  // Pre-chain rows have rowHash = '' — treat as genesis
  return last?.rowHash || GENESIS_HASH;
}

export class AuditService {
  static async logActionInternal(tx: DBTransaction, params: LogActionParams) {
    const { actorId, targetId, action, ipAddress } = params;

    // Serialize all appenders so the chain can't fork under concurrency.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${AUDIT_CHAIN_LOCK_KEY})`);

    const prevHash = await getLastHashForUpdate(tx);
    const id = crypto.randomUUID();
    const timestamp = new Date();

    const rowHash = computeRowHash({
      id,
      timestamp: timestamp.toISOString(),
      actorId: actorId ?? null,
      targetId: targetId ?? null,
      action,
      ipAddress: ipAddress ?? null,
      prevHash,
    });

    return await tx.insert(auditLogs).values({
      id,
      timestamp,
      actorId,
      targetId: targetId || null,
      action,
      ipAddress,
      prevHash,
      rowHash,
    });
  }

  static async logAction(params: LogActionParams) {
    return await db.transaction((tx) => AuditService.logActionInternal(tx, params));
  }

  static async verifyChainIntegrity(): Promise<ChainVerifyResult> {
    const rows = await db
      .select()
      .from(auditLogs)
      .orderBy(asc(auditLogs.timestamp));

    const chainStart = rows.findIndex((r) => r.rowHash !== "");

    if (chainStart === -1) {
      return {
        valid: true,
        totalRows: rows.length,
        hashedRows: 0,
        firstBreakIndex: null,
        firstBreakId: null,
        reason: "No hashed rows yet — chain begins on next log entry.",
      };
    }

    // expectedPrevHash is null only for the first hashed row (no upstream to verify)
    let expectedPrevHash: string | null = null;

    for (let i = chainStart; i < rows.length; i++) {
      const row = rows[i];

      if (expectedPrevHash !== null && row.prevHash !== expectedPrevHash) {
        return {
          valid: false,
          totalRows: rows.length,
          hashedRows: rows.length - chainStart,
          firstBreakIndex: i,
          firstBreakId: row.id,
          reason: `Chain break at row ${i} (id: ${row.id}): prevHash mismatch — a row was deleted or inserted before this one.`,
        };
      }

      const recomputed = computeRowHash({
        id: row.id,
        timestamp: row.timestamp!.toISOString(),
        actorId: row.actorId,
        targetId: row.targetId,
        action: row.action,
        ipAddress: row.ipAddress,
        prevHash: row.prevHash,
      });

      if (recomputed !== row.rowHash) {
        return {
          valid: false,
          totalRows: rows.length,
          hashedRows: rows.length - chainStart,
          firstBreakIndex: i,
          firstBreakId: row.id,
          reason: `Chain break at row ${i} (id: ${row.id}): rowHash mismatch — this row's content was modified.`,
        };
      }

      expectedPrevHash = row.rowHash;
    }

    return {
      valid: true,
      totalRows: rows.length,
      hashedRows: rows.length - chainStart,
      firstBreakIndex: null,
      firstBreakId: null,
      reason: `Chain intact across ${rows.length - chainStart} hashed rows (${chainStart} pre-chain rows skipped).`,
    };
  }

  static async getLogs(limit = 100, offset = 0) {
    return await db.query.auditLogs.findMany({
      orderBy: (auditLogs, { desc }) => [desc(auditLogs.timestamp)],
      limit,
      offset,
      with: {
        actor: {
          columns: { id: true, name: true, email: true, role: true },
        },
        target: {
          columns: { id: true, name: true, email: true, role: true },
        },
      },
    });
  }
}
