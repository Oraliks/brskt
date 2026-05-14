import { db } from '@/lib/db';
import { adminAuditLogs } from '@/lib/db/schema';

/**
 * Log une action admin pour traçabilité.
 *
 * Best-effort : si l'insert échoue (DB down), on log côté serveur mais on
 * ne throw PAS — un audit log raté ne doit pas casser l'action elle-même.
 *
 * Appelé après que l'action mutative ait réussi.
 */
export async function logAdminAction(opts: {
  adminId: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    await db.insert(adminAuditLogs).values({
      adminId: opts.adminId,
      action: opts.action,
      targetType: opts.targetType ?? null,
      targetId: opts.targetId ?? null,
      before: opts.before ?? null,
      after: opts.after ?? null,
    });
  } catch (err) {
    console.error('[audit] log failed', {
      action: opts.action,
      adminId: opts.adminId,
      err,
    });
  }
}
