import { desc, eq } from 'drizzle-orm';
import { ShieldCheck } from 'lucide-react';
import { db } from '@/lib/db';
import { adminAuditLogs, users } from '@/lib/db/schema';
import {
  AdminContainer,
  AdminPageHeader,
} from '@/components/admin/page-header';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * Page admin : historique des actions admin (audit log).
 * Limite à 200 entrées les plus récentes — pour aller plus loin, prévoir
 * une pagination ou un filtre par admin/action/cible.
 */
export default async function AdminAuditPage() {
  const logs = await db
    .select({
      id: adminAuditLogs.id,
      action: adminAuditLogs.action,
      targetType: adminAuditLogs.targetType,
      targetId: adminAuditLogs.targetId,
      before: adminAuditLogs.before,
      after: adminAuditLogs.after,
      createdAt: adminAuditLogs.createdAt,
      adminName: users.name,
      adminTelegramUsername: users.telegramUsername,
    })
    .from(adminAuditLogs)
    .leftJoin(users, eq(adminAuditLogs.adminId, users.id))
    .orderBy(desc(adminAuditLogs.createdAt))
    .limit(200);

  return (
    <AdminContainer>
      <AdminPageHeader
        title="Audit log"
        description="Historique des actions admin (200 dernières)."
        actions={
          <Badge variant="secondary">
            <ShieldCheck className="h-3 w-3 mr-1" />
            {logs.length} entrées
          </Badge>
        }
      />

      {logs.length === 0 ? (
        <div className="glass rounded-[var(--radius-lg)] p-10 text-center text-sm text-[var(--color-text-dim)]">
          Aucune action admin enregistrée pour l&apos;instant.
        </div>
      ) : (
        <div className="glass rounded-[var(--radius-lg)] overflow-hidden">
          <ul className="divide-y divide-[var(--color-border)]">
            {logs.map((log) => (
              <li key={log.id} className="p-4 hover:bg-[var(--color-surface-tint)]">
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs bg-[var(--color-surface-tint)] px-2 py-0.5 rounded">
                      {log.action}
                    </span>
                    {log.targetType && (
                      <span className="text-xs text-[var(--color-text-dim)]">
                        sur{' '}
                        <span className="font-mono">
                          {log.targetType}
                          {log.targetId
                            ? `#${log.targetId.slice(0, 8)}`
                            : ''}
                        </span>
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[var(--color-text-faint)] font-mono">
                    {formatDate(log.createdAt)} · par{' '}
                    {log.adminTelegramUsername
                      ? `@${log.adminTelegramUsername}`
                      : log.adminName ?? 'admin'}
                  </div>
                </div>

                {(log.before || log.after) && (
                  <details className="mt-2 text-xs">
                    <summary className="cursor-pointer text-[var(--color-text-dim)] hover:text-[var(--color-text)]">
                      Voir le diff
                    </summary>
                    <div className="mt-2 grid sm:grid-cols-2 gap-3">
                      {log.before && (
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-rose-300 light:text-rose-700 mb-1">
                            Avant
                          </div>
                          <pre className="font-mono text-[11px] bg-[var(--color-surface-tint)] p-2 rounded overflow-x-auto">
                            {JSON.stringify(log.before, null, 2)}
                          </pre>
                        </div>
                      )}
                      {log.after && (
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-emerald-300 light:text-emerald-700 mb-1">
                            Après
                          </div>
                          <pre className="font-mono text-[11px] bg-[var(--color-surface-tint)] p-2 rounded overflow-x-auto">
                            {JSON.stringify(log.after, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </AdminContainer>
  );
}
