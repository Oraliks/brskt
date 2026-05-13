import { and, eq, gte } from 'drizzle-orm';
import { db } from '@/lib/db';
import { manualIronfxStatus } from '@/lib/db/schema';
import type { IronFXAdapter, IronFXClientStatus } from './types';

/**
 * Adapter "manuel" pour IronFX : lit dans la table manual_ironfx_status
 * mise à jour par les admins via /admin/vip.
 *
 * Permet de fonctionner sans API IronFX, en attendant l'intégration.
 */
export class IronFXManualAdapter implements IronFXAdapter {
  readonly mode = 'manual' as const;

  async getClientStatus(accountId: string): Promise<IronFXClientStatus | null> {
    const row = await db.query.manualIronfxStatus.findFirst({
      where: eq(manualIronfxStatus.accountId, accountId),
    });

    if (!row) return null;
    return this.mapRow(row);
  }

  async getRecentUpdates(since: Date): Promise<IronFXClientStatus[]> {
    const rows = await db.query.manualIronfxStatus.findMany({
      where: gte(manualIronfxStatus.updatedAt, since),
    });

    return rows.map((r) => this.mapRow(r));
  }

  private mapRow(
    row: typeof manualIronfxStatus.$inferSelect
  ): IronFXClientStatus {
    return {
      accountId: row.accountId,
      signupDetected: row.signupDetected,
      depositTotal: Number(row.depositTotal),
      depositCurrency: row.depositCurrency ?? 'EUR',
      cpaQualified: row.cpaQualified,
      accountClosed: row.accountClosed,
      hasWithdrawn: row.hasWithdrawn,
      lastUpdated: row.updatedAt,
    };
  }
}
