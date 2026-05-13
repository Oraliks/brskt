import Link from 'next/link';
import { count, desc, eq } from 'drizzle-orm';
import {
  ArrowRight,
  CalendarCheck,
  CreditCard,
  Sparkles,
  Users,
} from 'lucide-react';
import { db } from '@/lib/db';
import {
  bookings,
  payments,
  users,
  vipApplications,
} from '@/lib/db/schema';
import { AdminContainer, AdminPageHeader } from '@/components/admin/page-header';
import { Badge } from '@/components/ui/badge';
import { formatDate, formatPrice } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AdminOverview() {
  const [
    [usersCount],
    [bookingsCount],
    [vipInGroup],
    [paidPayments],
    recentBookings,
  ] = await Promise.all([
    db.select({ c: count() }).from(users),
    db.select({ c: count() }).from(bookings),
    db
      .select({ c: count() })
      .from(vipApplications)
      .where(eq(vipApplications.step, 'in_group')),
    db
      .select({ c: count() })
      .from(payments)
      .where(eq(payments.status, 'completed')),
    db.query.bookings.findMany({
      orderBy: [desc(bookings.createdAt)],
      limit: 5,
      with: { formation: true, user: true },
    }),
  ]);

  const metrics = [
    { label: 'Utilisateurs', value: usersCount?.c ?? 0, icon: Users },
    { label: 'Réservations', value: bookingsCount?.c ?? 0, icon: CalendarCheck },
    { label: 'VIP actifs', value: vipInGroup?.c ?? 0, icon: Sparkles },
    {
      label: 'Paiements OK',
      value: paidPayments?.c ?? 0,
      icon: CreditCard,
    },
  ];

  return (
    <AdminContainer>
      <AdminPageHeader
        title="Overview"
        description="Vue globale de la plateforme."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <div key={m.label} className="glass rounded-[var(--radius-lg)] p-5">
            <div className="flex items-center justify-between">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-white/5 border border-[var(--color-border)]">
                <m.icon className="h-4 w-4 text-[var(--color-text-dim)]" />
              </span>
              <span className="text-xs text-[var(--color-text-dim)] uppercase tracking-wider">
                {m.label}
              </span>
            </div>
            <div className="mt-4 font-serif text-4xl text-gradient">
              {m.value}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Dernières réservations</h2>
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
            <div className="p-8 text-center text-sm text-[var(--color-text-dim)]">
              Aucune réservation pour le moment.
            </div>
          ) : (
            recentBookings.map((b) => (
              <Link
                key={b.id}
                href={`/admin/bookings#${b.id}`}
                className="flex items-center gap-4 p-4 hover:bg-white/[0.02]"
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
