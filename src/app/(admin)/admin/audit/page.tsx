import {
  and,
  count,
  countDistinct,
  desc,
  eq,
  gte,
  ilike,
  max,
  or,
  type SQL,
} from 'drizzle-orm';
import {
  Activity,
  Calendar,
  Download,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { db } from '@/lib/db';
import { adminAuditLogs, users } from '@/lib/db/schema';
import {
  AdminContainer,
  AdminPageHeader,
} from '@/components/admin/page-header';
import { StatCard, StatCardGrid } from '@/components/admin/stat-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AuditFilters } from '@/components/admin/audit-filters';
import {
  AuditTable,
  type AuditLogRow,
} from '@/components/admin/audit-table';
import { AuditPagination } from '@/components/admin/audit-pagination';

export const dynamic = 'force-dynamic';

/**
 * Page admin : historique des actions admin (audit log).
 *
 * Filtres via query params :
 *  - ?q=…       : recherche full-text sur action/targetType/targetId
 *  - ?date=…    : 'today' | '7d' | '30d' | ''
 *  - ?admin=…   : UUID admin
 *  - ?action=…  : nom d'action exact
 *  - ?page=N    : pagination (1-indexed, default 1)
 *  - ?perPage=N : taille de page (default 20, max 100)
 */

interface PageProps {
  searchParams: Promise<{
    q?: string;
    date?: string;
    admin?: string;
    action?: string;
    page?: string;
    perPage?: string;
  }>;
}

function parseDate(raw: string | undefined): Date | null {
  if (raw === 'today') {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (raw === '7d') {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d;
  }
  if (raw === '30d') {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  }
  return null;
}

export default async function AdminAuditPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = params.q?.trim() ?? '';
  const dateFilter = params.date ?? '';
  const adminId = params.admin ?? '';
  const action = params.action ?? '';
  const page = Math.max(1, Number(params.page) || 1);
  const perPage = Math.min(100, Math.max(10, Number(params.perPage) || 20));
  const offset = (page - 1) * perPage;

  // ============ BUILD WHERE ============
  const conditions: SQL[] = [];
  if (q) {
    const pattern = `%${q}%`;
    const orClause = or(
      ilike(adminAuditLogs.action, pattern),
      ilike(adminAuditLogs.targetType, pattern),
      ilike(adminAuditLogs.targetId, pattern)
    );
    if (orClause) conditions.push(orClause);
  }
  const dateStart = parseDate(dateFilter);
  if (dateStart) conditions.push(gte(adminAuditLogs.createdAt, dateStart));
  if (adminId) conditions.push(eq(adminAuditLogs.adminId, adminId));
  if (action) conditions.push(eq(adminAuditLogs.action, action));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // ============ QUERIES (parallèles) ============
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    rows,
    totalRow,
    totalAllRow,
    todayRow,
    adminsTouchedRow,
    lastActivityRow,
    distinctAdmins,
    distinctActions,
  ] = await Promise.all([
    db
      .select({
        id: adminAuditLogs.id,
        action: adminAuditLogs.action,
        targetType: adminAuditLogs.targetType,
        targetId: adminAuditLogs.targetId,
        before: adminAuditLogs.before,
        after: adminAuditLogs.after,
        createdAt: adminAuditLogs.createdAt,
        adminId: adminAuditLogs.adminId,
        adminName: users.name,
        adminEmail: users.email,
        adminTelegramUsername: users.telegramUsername,
      })
      .from(adminAuditLogs)
      .leftJoin(users, eq(adminAuditLogs.adminId, users.id))
      .where(whereClause)
      .orderBy(desc(adminAuditLogs.createdAt))
      .limit(perPage)
      .offset(offset),
    db.select({ c: count() }).from(adminAuditLogs).where(whereClause),
    db.select({ c: count() }).from(adminAuditLogs),
    db
      .select({ c: count() })
      .from(adminAuditLogs)
      .where(gte(adminAuditLogs.createdAt, today)),
    db
      .select({ c: countDistinct(adminAuditLogs.adminId) })
      .from(adminAuditLogs),
    db
      .select({ last: max(adminAuditLogs.createdAt) })
      .from(adminAuditLogs),
    db
      .select({
        id: users.id,
        name: users.name,
        telegramUsername: users.telegramUsername,
      })
      .from(users)
      .innerJoin(adminAuditLogs, eq(adminAuditLogs.adminId, users.id))
      .groupBy(users.id, users.name, users.telegramUsername),
    db
      .select({
        action: adminAuditLogs.action,
      })
      .from(adminAuditLogs)
      .groupBy(adminAuditLogs.action)
      .orderBy(adminAuditLogs.action),
  ]);

  const total = totalRow[0]?.c ?? 0;
  const totalAll = totalAllRow[0]?.c ?? 0;
  const todayCount = todayRow[0]?.c ?? 0;
  const adminsTouched = adminsTouchedRow[0]?.c ?? 0;
  const lastActivity = lastActivityRow[0]?.last ?? null;

  const adminOptions = distinctAdmins.map((a) => ({
    value: a.id,
    label: a.name ?? (a.telegramUsername ? `@${a.telegramUsername}` : 'admin'),
  }));
  const actionOptions = distinctActions.map((a) => ({
    value: a.action,
    label: a.action,
  }));

  const auditRows: AuditLogRow[] = rows.map((r) => ({
    id: r.id,
    action: r.action,
    targetType: r.targetType,
    targetId: r.targetId,
    before: r.before as Record<string, unknown> | null,
    after: r.after as Record<string, unknown> | null,
    createdAt: r.createdAt,
    adminId: r.adminId,
    adminName: r.adminName,
    adminEmail: r.adminEmail,
    adminTelegramUsername: r.adminTelegramUsername,
  }));

  return (
    <AdminContainer>
      <AdminPageHeader
        title="Audit log"
        description="Historique des actions admin (200 dernières)."
        actions={
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="text-xs">
              <ShieldCheck className="h-3 w-3 mr-1" />
              {totalAll} entrées
            </Badge>
            <Button asChild size="sm" variant="secondary" className="gap-1.5">
              <a href="/api/admin/export/audit.csv" download>
                <Download className="h-3.5 w-3.5" />
                Exporter CSV
              </a>
            </Button>
          </div>
        }
      />

      {/* 4 KPI cards */}
      <StatCardGrid cols={4} className="mb-5">
        <StatCard
          label="Entrées totales"
          value={totalAll}
          icon={<ShieldCheck className="h-4 w-4" />}
          tone="info"
        />
        <StatCard
          label="Aujourd'hui"
          value={todayCount}
          icon={<Calendar className="h-4 w-4" />}
          tone={todayCount > 0 ? 'success' : 'default'}
        />
        <StatCard
          label="Admins touchés"
          value={adminsTouched}
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label="Dernière activité"
          value={lastActivity ? formatRelative(lastActivity) : '—'}
          hint={lastActivity ? formatDateTime(lastActivity) : 'pas d\'activité'}
          icon={<Activity className="h-4 w-4" />}
        />
      </StatCardGrid>

      <AuditFilters admins={adminOptions} actions={actionOptions} />

      <AuditTable rows={auditRows} />

      <AuditPagination page={page} perPage={perPage} total={total} />
    </AdminContainer>
  );
}

function formatRelative(d: Date): string {
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}j`;
}

function formatDateTime(d: Date): string {
  return d.toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
