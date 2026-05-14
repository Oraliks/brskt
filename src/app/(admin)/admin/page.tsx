import Link from 'next/link';
import { and, count, desc, eq } from 'drizzle-orm';
import {
  ArrowRight,
  CalendarCheck,
  CreditCard,
  Percent,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import { db } from '@/lib/db';
import {
  bookings,
  payments,
  users,
  vipApplications,
} from '@/lib/db/schema';
import {
  AdminContainer,
  AdminPageHeader,
} from '@/components/admin/page-header';
import { StatCard, StatCardGrid } from '@/components/admin/stat-card';
import { Badge } from '@/components/ui/badge';
import { getChannelMemberCount } from '@/lib/telegram/community-stats';
import { formatDate, formatPrice } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AdminOverview() {
  const [
    [usersCount],
    [bookingsCount],
    [vipInGroup],
    [vipQualified],
    [paidPayments],
    recentBookings,
    channelCount,
  ] = await Promise.all([
    db.select({ c: count() }).from(users),
    db.select({ c: count() }).from(bookings),
    db
      .select({ c: count() })
      .from(vipApplications)
      .where(eq(vipApplications.step, 'in_group')),
    db
      .select({ c: count() })
      .from(vipApplications)
      .where(
        and(
          eq(vipApplications.step, 'in_group'),
          eq(vipApplications.cpaQualified, true)
        )
      ),
    db
      .select({ c: count() })
      .from(payments)
      .where(eq(payments.status, 'completed')),
    db.query.bookings.findMany({
      orderBy: [desc(bookings.createdAt)],
      limit: 5,
      with: { formation: true, user: true },
    }),
    getChannelMemberCount(),
  ]);

  const inGroup = vipInGroup?.c ?? 0;
  const qualified = vipQualified?.c ?? 0;
  const conversionPct = inGroup > 0 ? Math.round((qualified / inGroup) * 100) : 0;

  return (
    <AdminContainer>
      <AdminPageHeader
        title="Overview"
        description="Vue globale de la plateforme."
      />

      <StatCardGrid cols={4} className="mb-4">
        <StatCard
          label="Utilisateurs"
          value={usersCount?.c ?? 0}
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label="Réservations"
          value={bookingsCount?.c ?? 0}
          icon={<CalendarCheck className="h-4 w-4" />}
        />
        <StatCard
          label="Paiements OK"
          value={paidPayments?.c ?? 0}
          icon={<CreditCard className="h-4 w-4" />}
        />
        {channelCount !== null && (
          <StatCard
            label="Canal Telegram"
            value={channelCount.toLocaleString('fr-FR')}
            tone="info"
            hint="membres (live)"
            icon={<TrendingUp className="h-4 w-4" />}
          />
        )}
      </StatCardGrid>

      <StatCardGrid cols={3}>
        <StatCard
          label="VIP in_group"
          value={inGroup}
          tone="default"
          icon={<Sparkles className="h-4 w-4" />}
        />
        <StatCard
          label="Qualifiés CPA"
          value={qualified}
          hint={`${conversionPct}% du in_group`}
          tone={qualified > 0 ? 'success' : 'default'}
        />
        <StatCard
          label="Conversion CPA"
          value={`${conversionPct}%`}
          hint="ratio qualified / in_group"
          tone="info"
          icon={<Percent className="h-4 w-4" />}
        />
      </StatCardGrid>

      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Dernières réservations</h2>
          <Link
            href="/admin/bookings"
            className="text-xs text-[var(--color-text-dim)] hover:text-[var(--color-text)] inline-flex items-center gap-1"
          >
            Voir tout
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="glass rounded-[var(--radius-lg)] divide-y divide-[var(--color-border)]">
          {recentBookings.length === 0 ? (
            <div className="p-6 text-center text-sm text-[var(--color-text-dim)]">
              Aucune réservation pour le moment.
            </div>
          ) : (
            recentBookings.map((b) => (
              <Link
                key={b.id}
                href={`/admin/bookings#${b.id}`}
                className="flex items-center gap-4 p-3 hover:bg-[var(--color-surface-tint)]"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {b.user.name}
                  </div>
                  <div className="text-xs text-[var(--color-text-dim)] truncate">
                    {b.formation.title} · {formatDate(b.createdAt)}
                  </div>
                </div>
                <Badge variant="secondary">{b.status}</Badge>
                <div className="font-mono text-xs text-[var(--color-text-dim)]">
                  {formatPrice(Number(b.formation.priceEur))}
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </AdminContainer>
  );
}
