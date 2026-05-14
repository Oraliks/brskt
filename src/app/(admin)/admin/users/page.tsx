import { desc, sql } from 'drizzle-orm';
import { Users as UsersIcon } from 'lucide-react';
import { db } from '@/lib/db';
import { userBans, users } from '@/lib/db/schema';
import {
  AdminContainer,
  AdminPageHeader,
} from '@/components/admin/page-header';
import { StatCard, StatCardGrid } from '@/components/admin/stat-card';
import { UsersTable, type AdminUserRow } from '@/components/admin/users-table';
import { requireAdmin } from '@/lib/auth/server';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const session = await requireAdmin();

  // LEFT JOIN avec un seul ban actif par user (revoked_at IS NULL).
  // L'index unique partiel garantit qu'il n'y en a qu'un — on peut donc
  // grouper sans risque de cardinalité.
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      telegramId: users.telegramId,
      telegramUsername: users.telegramUsername,
      telegramPhotoUrl: users.telegramPhotoUrl,
      onboardingCompletedAt: users.onboardingCompletedAt,
      createdAt: users.createdAt,
      bannedAt: userBans.createdAt,
      bannedReason: userBans.reason,
    })
    .from(users)
    .leftJoin(
      userBans,
      sql`${userBans.userId} = ${users.id} AND ${userBans.revokedAt} IS NULL`
    )
    .orderBy(desc(users.createdAt))
    .limit(500);

  const list: AdminUserRow[] = rows;

  const stats = {
    total: list.length,
    admins: list.filter((u) => u.role === 'admin').length,
    onboarding: list.filter((u) => !u.onboardingCompletedAt).length,
    banned: list.filter((u) => u.bannedAt).length,
  };

  return (
    <AdminContainer>
      <AdminPageHeader
        title="Utilisateurs"
        description="Recherche, modération, gestion des rôles. Les admins ne peuvent ni se bannir, ni se rétrograder eux-mêmes."
      />

      <StatCardGrid className="mb-5">
        <StatCard label="Total" value={stats.total} icon={<UsersIcon className="h-4 w-4" />} />
        <StatCard label="Admins" value={stats.admins} tone="info" />
        <StatCard
          label="Onboarding incomplet"
          value={stats.onboarding}
          tone={stats.onboarding > 0 ? 'warning' : 'default'}
        />
        <StatCard
          label="Bannis"
          value={stats.banned}
          tone={stats.banned > 0 ? 'danger' : 'default'}
        />
      </StatCardGrid>

      <UsersTable users={list} currentAdminId={session.user.id} />
    </AdminContainer>
  );
}
