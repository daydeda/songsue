import { db } from "@/db";
import { auditLogs } from "@/db/schema";

export interface LogActionParams {
  actorId: string;
  targetId?: string;
  action: string;
  ipAddress: string;
}

type DBTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class AuditService {
  /**
   * Log an action inside a database transaction block (internal usage)
   */
  static async logActionInternal(tx: DBTransaction, params: LogActionParams) {
    const { actorId, targetId, action, ipAddress } = params;
    return await tx.insert(auditLogs).values({
      actorId,
      targetId: targetId || null,
      action,
      ipAddress,
      timestamp: new Date(),
    });
  }

  /**
   * Log an action as an independent database operation
   */
  static async logAction(params: LogActionParams) {
    const { actorId, targetId, action, ipAddress } = params;
    return await db.insert(auditLogs).values({
      actorId,
      targetId: targetId || null,
      action,
      ipAddress,
      timestamp: new Date(),
    });
  }

  /**
   * Fetch all audit logs ordered by timestamp
   */
  static async getLogs(limit = 100, offset = 0) {
    return await db.query.auditLogs.findMany({
      orderBy: (auditLogs, { desc }) => [desc(auditLogs.timestamp)],
      limit,
      offset,
      with: {
        actor: {
          columns: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        target: {
          columns: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });
  }
}
